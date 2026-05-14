'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import FooterNav from '@/components/FooterNav';
import { initLiff, getLineProfile } from '@/lib/liff';
import { invalidate } from '@/lib/clientCache';
import { CheckCircle2, Camera, AlertTriangle, Search, FileText, Home } from 'lucide-react';

type ProductResult = {
  found: boolean;
  source: 'openfoodfacts' | 'none';
  title: string;
  brand: string;
  imageUrl: string | null;
  servingSize: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  perServing: boolean;
};

type MealType = '朝食' | '昼食' | '夕食' | '間食';
type DayLabel = '今日' | '昨日';

export default function ScanPage() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [lookup, setLookup] = useState<ProductResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [day, setDay] = useState<DayLabel>('今日');
  const [mealType, setMealType] = useState<MealType>('間食');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const scannerDivId = 'qr-reader';

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (profile) setUserId(profile.userId);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化失敗');
        setReady(true);
      }
    })();
    return () => {
      // クリーンアップ
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  async function startScan() {
    setError(null);
    setLookup(null);
    setBarcode('');
    setScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode(scannerDivId);
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
        },
        async (decodedText: string) => {
          // 1回スキャンしたら停止
          setBarcode(decodedText);
          await html5QrCode.stop();
          scannerRef.current = null;
          setScanning(false);
          await doLookup(decodedText);
        },
        () => {
          // スキャン失敗は無視（連続呼び出しのため）
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'カメラ起動失敗。LINEのカメラ権限を許可してください。');
      setScanning(false);
    }
  }

  async function stopScan() {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function doLookup(code: string) {
    setLooking(true);
    setError(null);
    try {
      const res = await fetch(`/api/barcode-lookup?barcode=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `検索失敗（${res.status}）`);
      setLookup(json);
      if (!json.found) {
        setError(`バーコード ${code} は商品DBに見つかりませんでした。手動で記録するか、写真撮影で記録してください。`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '商品検索エラー');
    } finally {
      setLooking(false);
    }
  }

  async function handleManualSearch() {
    if (!manualBarcode.trim()) return;
    setBarcode(manualBarcode.trim());
    await doLookup(manualBarcode.trim());
  }

  async function handleRecord() {
    if (!userId || !lookup || !lookup.found) return;
    setSubmitting(true);
    setError(null);
    try {
      const title = `${lookup.title}${lookup.brand ? `（${lookup.brand}）` : ''}`;
      const res = await fetch('/api/record/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: userId,
          mealType,
          day,
          title,
          kcal: lookup.kcal,
          P: lookup.P,
          F: lookup.F,
          C: lookup.C,
          source: 'barcode',
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `記録失敗（${res.status}）`);
      }
      invalidate('today_');
      invalidate('weekly_');
      invalidate('history_');
      setSuccess(`${lookup.title} を ${mealType} に記録しました`);
      setLookup(null);
      setBarcode('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '記録エラー');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <header className="bg-emerald-500 text-white px-4 pt-6 pb-5 shadow">
        <h1 className="text-xl font-bold">バーコードスキャン</h1>
        <p className="text-xs text-emerald-50 mt-1">市販品のJANコードから栄養素を自動取得</p>
        <p className="text-[10px] text-emerald-100 mt-1.5 leading-relaxed">
          照会先：Open Food Facts（国際的な無料食品DB）。日本製品のカバー率は約30〜50%です。
        </p>
      </header>

      <main className="px-4 py-5 space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs font-medium p-3 rounded-xl">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-sm font-medium p-3 rounded-xl">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.2}/>{success}</span>
          </div>
        )}

        {!scanning && !lookup && (
          <>
            <button
              onClick={startScan}
              className="w-full bg-emerald-500 text-white text-base font-bold py-4 rounded-xl shadow-md active:bg-emerald-700"
            >
              <span className="inline-flex items-center justify-center gap-1.5"><Camera className="w-4 h-4" strokeWidth={2.2}/>カメラでスキャン開始</span>
            </button>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              LINEから「カメラへのアクセス」を許可してください。スキャン中に他のアプリへ切り替えると停止します。
            </p>

            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
              <div className="text-sm font-bold text-stone-900 mb-2">手動でバーコード番号入力</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
                  placeholder="例：4901005101586"
                  className="flex-1 bg-white text-stone-900 placeholder:text-stone-400 border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleManualSearch}
                  disabled={!manualBarcode.trim() || looking}
                  className="bg-emerald-500 text-white font-bold px-4 rounded-xl disabled:bg-stone-300"
                >
                  検索
                </button>
              </div>
            </div>
          </>
        )}

        {scanning && (
          <div className="space-y-3">
            <div id={scannerDivId} className="rounded-2xl overflow-hidden bg-black" />
            <button
              onClick={stopScan}
              className="w-full bg-stone-200 text-stone-800 font-bold py-3 rounded-xl"
            >
              キャンセル
            </button>
          </div>
        )}

        {looking && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 text-center">
            <p className="text-sm text-stone-700">商品DB照会中…</p>
          </div>
        )}

        {lookup && lookup.found && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
              <div className="text-[10px] text-stone-500 mb-1">JANコード: {barcode}</div>
              <div className="text-base font-bold text-stone-900">{lookup.title}</div>
              {lookup.brand && (
                <div className="text-xs text-stone-600 mt-0.5">{lookup.brand}</div>
              )}
              {lookup.imageUrl && (
                <img
                  src={lookup.imageUrl}
                  alt={lookup.title}
                  className="w-32 h-32 object-cover rounded-xl mt-3 mx-auto"
                />
              )}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Stat label="kcal" value={`${lookup.kcal}`} />
                <Stat label="P (g)" value={`${lookup.P}`} />
                <Stat label="F (g)" value={`${lookup.F}`} />
                <Stat label="C (g)" value={`${lookup.C}`} />
              </div>
              <div className="text-[10px] text-stone-500 text-center mt-2">
                {lookup.servingSize} あたり ・ source: Open Food Facts
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
              <div className="text-sm font-bold text-stone-900 mb-2">いつの食事？</div>
              <div className="flex gap-2 mb-3">
                {(['今日', '昨日'] as DayLabel[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDay(d)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold ${
                      day === d ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-700 border border-stone-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['朝食', '昼食', '夕食', '間食'] as MealType[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMealType(m)}
                    className={`py-2 rounded-xl text-xs font-bold ${
                      mealType === m ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-700 border border-stone-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleRecord}
              disabled={submitting}
              className="w-full bg-emerald-500 text-white text-base font-bold py-4 rounded-xl shadow-md active:bg-emerald-700 disabled:bg-stone-300"
            >
              {submitting ? '記録中…' : (
                <span className="inline-flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4" strokeWidth={2.2}/>この内容で記録する</span>
              )}
            </button>
            <button
              onClick={() => {
                setLookup(null);
                setBarcode('');
              }}
              className="w-full bg-stone-200 text-stone-800 font-bold py-3 rounded-xl"
            >
              🔄 別の商品をスキャン
            </button>
          </div>
        )}

        {lookup && !lookup.found && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="text-sm font-bold text-amber-900 mb-1 inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" strokeWidth={2.2}/>
                JANコード {barcode} は DB に未登録です
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Open Food Facts は世界中のユーザーが投稿する無料食品DBですが、日本の市販品はまだ少なめ。下記の方法で記録できます。
              </p>
            </div>
            <Link
              href="/food-search"
              className="block bg-emerald-500 text-white text-center font-bold py-3 rounded-xl"
            >
              <span className="inline-flex items-center gap-1"><Search className="w-3.5 h-3.5" strokeWidth={2.2}/>食品DB から探す</span>
            </Link>
            <Link
              href="/record"
              className="block bg-white border border-stone-300 text-stone-900 text-center font-bold py-3 rounded-xl"
            >
              <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" strokeWidth={2.2}/>メモ・写真で記録する</span>
            </Link>
            <button
              onClick={() => {
                setLookup(null);
                setBarcode('');
              }}
              className="w-full bg-stone-200 text-stone-800 font-bold py-3 rounded-xl"
            >
              🔄 別の商品をスキャン
            </button>
          </div>
        )}

        <Link href="/home" className="block text-center text-xs text-stone-500 underline pt-2">
          <span className="inline-flex items-center gap-1"><Home className="w-3.5 h-3.5" strokeWidth={2.2}/>ホームに戻る</span>
        </Link>
      </main>

      <FooterNav />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-stone-900">{value}</div>
      <div className="text-[10px] text-stone-600">{label}</div>
    </div>
  );
}
