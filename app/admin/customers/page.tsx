'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Circle, ChevronRight, ClipboardCopy, Check, AlertTriangle, UserCheck, Monitor, X } from 'lucide-react';
import AdminShell from '../AdminShell';
import { useAdminBase } from '@/lib/useAdminBase';
import { useToast } from '@/components/Toast';

type SeatInfo = {
  seatLimit: number | null;
  currentSeats: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
};

type Customer = {
  pageId: string;
  name: string;
  lineUserId: string;
  foodStatus: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  storeId: string | null;
  createdTime: string | null;
};

type Store = { pageId: string; storeId: string; name: string };

const STATUSES = ['すべて', '進行中', '休止中', '卒業'];
// 承認制モードは未公開（バックエンドのみ実装済み）。UI からは個別招待モードに固定して呼ぶ。
// 将来 UI を再公開する場合は本ファイルにモード切替トグル・/api/admin/tenant-settings 連動を復活させる。

export default function AdminCustomersPage() {
  const base = useAdminBase();
  const toast = useToast();
  const isStore = base === '/store';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('すべて');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [stores, setStores] = useState<Store[]>([]);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [onboardingIncomplete, setOnboardingIncomplete] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{ lineUserId: string; name: string } | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<'sample' | 'real'>('sample');

  const loadCustomers = useCallback(async () => {
    try {
      const requests: Promise<Response>[] = [
        fetch('/api/admin/customers', { cache: 'no-store' }),
        fetch('/api/admin/stores', { cache: 'no-store' }),
        fetch('/api/admin/billing/info', { cache: 'no-store' }),
      ];
      if (isStore) {
        requests.push(fetch('/api/store/onboarding/state', { cache: 'no-store' }));
      }
      const [cRes, sRes, bRes, oRes] = await Promise.all(requests);
      if (!cRes.ok) throw new Error(`取得失敗（${cRes.status}）`);
      const cJ = await cRes.json();
      const sJ = sRes.ok ? await sRes.json() : { stores: [] };
      const bJ = bRes.ok ? await bRes.json() : null;
      setCustomers(cJ.customers || []);
      setStores(sJ.stores || []);
      if (bJ && !bJ.error) {
        setSeatInfo({
          seatLimit: bJ.seatLimit,
          currentSeats: bJ.currentSeats,
          isOverLimit: bJ.isOverLimit,
          isNearLimit: bJ.isNearLimit,
        });
      }
      if (oRes) {
        const oJ = oRes.ok ? await oRes.json() : null;
        if (oJ && !oJ.onboardingCompletedAt) setOnboardingIncomplete(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }, [isStore]);

  async function approveCustomer(e: React.MouseEvent, customerId: string, customerName: string) {
    e.preventDefault();
    e.stopPropagation();
    if (approvingId) return;
    if (!window.confirm(`「${customerName}」さんを承認しますか？\n承認すると食事管理機能が利用可能になります。`)) return;
    setApprovingId(customerId);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `承認失敗（${res.status}）`);
      }
      // 楽観的にローカル state を更新
      setCustomers((prev) => prev.map((c) => (c.pageId === customerId ? { ...c, foodStatus: '進行中' } : c)));
      toast.success(`「${customerName}」さんを承認しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '承認に失敗しました');
    } finally {
      setApprovingId(null);
    }
  }

  async function openPreview(lineUserId: string, name: string, mode: 'sample' | 'real') {
    setPreviewMode(mode);
    setPreviewTarget({ lineUserId, name });
    setPreviewToken(null);
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/admin/preview-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || 'プレビュートークンの取得に失敗しました');
        setPreviewTarget(null);
        return;
      }
      const j = await res.json();
      setPreviewToken(j.token);
    } catch {
      toast.error('プレビューを開けませんでした');
      setPreviewTarget(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewTarget(null);
    setPreviewToken(null);
  }

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filtered = useMemo(() => {
    const qn = q.trim();
    return customers.filter((c) => {
      if (statusFilter !== 'すべて' && c.foodStatus !== statusFilter) return false;
      if (storeFilter && c.storeId !== storeFilter) return false;
      if (qn && !c.name.includes(qn)) return false;
      return true;
    });
  }, [customers, q, statusFilter, storeFilter]);

  const storeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stores) m.set(s.storeId, s.name);
    return m;
  }, [stores]);

  async function copyApplyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // 読み込み中は席数情報が未取得のため、上限テナントでも誤コピーできないようガード
    if (loading || seatInfo?.isOverLimit) return;
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.fitmeal.jp';
      // 個別招待モードで 7日有効の URL を発行。承認制モードは UI 未公開（バックエンドのみ実装）。
      const inviteRes = await fetch('/api/admin/invites/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: 7, kind: 'individual' }),
      });
      let url: string;
      let expiresNote = '';
      if (inviteRes.ok) {
        const j = await inviteRes.json();
        url = `${origin}/home/register?t=${encodeURIComponent(j.token)}`;
        expiresNote = '\n（このリンクは発行から7日間有効です）';
      } else {
        // フォールバック: 旧来の平文 tenantId URL（招待API障害時の救済）
        const meRes = await fetch('/api/admin/auth/me', { cache: 'no-store' });
        const meJ = meRes.ok ? await meRes.json() : null;
        const tenantId: string = meJ?.currentTenantId || '';
        url = tenantId ? `${origin}/home/register?tenantId=${encodeURIComponent(tenantId)}` : `${origin}/home/register`;
      }
      const text = `食事管理プログラムへのご登録をお願いします。\n\n${url}\n\nご登録後、画面の案内に従って公式LINEを友だち追加してください。${expiresNote}`;
      await navigator.clipboard.writeText(text);
      toast.success('ユーザー招待URLをコピーしました（7日間有効）');
    } catch {
      toast.error('コピーに失敗しました');
    }
  }

  const realCustomers = useMemo(
    () => customers.filter((c) => !(c.lineUserId?.startsWith('SAMPLE_') || c.lineUserId?.startsWith('DEMO_'))),
    [customers]
  );
  // ヘッダー表記: 進行中（アクティブ）/ 全顧客数（サンプル・デモ除外）
  const activeCount = useMemo(
    () => realCustomers.filter((c) => c.foodStatus === '進行中').length,
    [realCustomers]
  );

  return (
    <AdminShell
      title={
        realCustomers.length > 0
          ? `顧客管理（${activeCount}/${realCustomers.length}名）`
          : '顧客管理'
      }
    >
      {/* プレビューモーダル */}
      {previewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
              <div>
                <div className="text-sm font-bold text-stone-900">
                  顧客画面プレビュー
                  {previewMode === 'sample' && (
                    <span className="ml-2 text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full">サンプル</span>
                  )}
                </div>
                <div className="text-[11px] text-stone-500">{previewTarget.name} — 読み取り専用</div>
              </div>
              <button type="button" onClick={closePreview} className="p-1 rounded-lg hover:bg-stone-100">
                <X className="w-4 h-4 text-stone-600" strokeWidth={2.2} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl bg-stone-100" style={{ minHeight: 560 }}>
              {previewLoading ? (
                <div className="flex items-center justify-center h-full text-stone-500 text-sm py-20">
                  準備中…
                </div>
              ) : previewToken ? (
                <iframe
                  src={`/home?preview_token=${encodeURIComponent(previewToken)}`}
                  className="w-full h-full border-0 rounded-b-2xl"
                  style={{ minHeight: 560 }}
                  title="顧客画面プレビュー"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">

        {/* オンボーディング未完了バナー（store のみ） */}
        {isStore && onboardingIncomplete && (
          <div className="bg-violet-50 border-2 border-violet-400 text-violet-900 text-xs p-3 rounded-xl flex gap-2 items-start w-full">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-500" strokeWidth={2.2} />
            <div className="flex-1">
              <div className="font-bold text-sm mb-0.5">LINE 連携のセットアップが未完了です</div>
              <div className="mb-2">リッチメニュー・LINE 連携を設定するとお客様がアプリをすぐに使えるようになります。</div>
              <Link
                href="/store/onboarding"
                className="inline-flex items-center gap-1 bg-violet-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
              >
                セットアップを始める →
              </Link>
            </div>
          </div>
        )}

        {/* 残り1席バナー */}
        {!seatInfo?.isOverLimit && seatInfo?.isNearLimit && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl flex gap-2 items-start w-full">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" strokeWidth={2.2} />
            <div>
              あと1名で利用可能アカウント数の上限です。早めの増枠をご検討ください。
              <Link href={`${base}/billing`} className="text-amber-800 font-bold underline ml-1">
                プランを確認する →
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" strokeWidth={2.2} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="氏名で検索"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap border ${
                  statusFilter === s
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {stores.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setStoreFilter('')}
                className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap border ${
                  storeFilter === ''
                    ? 'bg-violet-500 text-white border-violet-500'
                    : 'bg-white text-stone-700 border-stone-300'
                }`}
              >
                全店舗
              </button>
              {stores.map((s) => (
                <button
                  key={s.storeId}
                  type="button"
                  onClick={() => setStoreFilter(s.storeId)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap border ${
                    storeFilter === s.storeId
                      ? 'bg-violet-500 text-white border-violet-500'
                      : 'bg-white text-stone-700 border-stone-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative group w-full">
          {/* 上限到達時のみ: 招待ボタンにホバーで増枠案内ツールチップ（ボタン下に表示。pt-2 でボタンと接して hover が途切れない） */}
          {seatInfo?.isOverLimit && (
            <div className="absolute top-full left-0 right-0 pt-2 hidden group-hover:block z-20">
              <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-3 rounded-xl flex gap-2 items-start shadow-lg">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" strokeWidth={2.2} />
                <div className="flex-1">
                  <div className="font-bold">
                    利用可能アカウント数 {seatInfo.seatLimit}名 / 使用 {seatInfo.currentSeats}名 — 上限到達
                  </div>
                  <div>
                    新規招待には増枠が必要です。
                    <Link href={`${base}/billing`} className="text-rose-700 font-bold underline ml-1">
                      プランを変更する →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={copyApplyLink}
            disabled={loading || !!seatInfo?.isOverLimit}
            className={`flex w-full font-bold py-3 rounded-xl items-center justify-center gap-2 text-sm border ${
              loading || seatInfo?.isOverLimit
                ? 'bg-stone-100 text-stone-400 border-stone-300 opacity-60 cursor-not-allowed'
                : 'bg-sky-100 text-sky-700 border-sky-300 active:bg-sky-200'
            }`}
          >
            <ClipboardCopy className="w-4 h-4" strokeWidth={2.4} />
            {loading ? '読み込み中…' : '招待URLをコピー'}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">該当する顧客がいません</div>
        ) : (
          <ul className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100">
            {filtered.map((c) => {
              const isPending = c.foodStatus === '承認待ち';
              const isSample = !!c.lineUserId && (c.lineUserId.startsWith('SAMPLE_') || c.lineUserId.startsWith('DEMO_'));
              return (
                <li key={c.pageId}>
                  <div className="flex items-center gap-0 px-2 py-1 hover:bg-stone-50">
                    <Link
                      href={`${base}/customers/${c.pageId}`}
                      className="flex items-start gap-3 px-2 py-2 flex-1 min-w-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-bold text-stone-900 truncate">{c.name}</div>
                          {isSample && (
                            <span className="text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full">デモ</span>
                          )}
                          <StatusBadge status={c.foodStatus} />
                          {c.lineUserId ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" strokeWidth={2.4} />
                              LINE 連携済み
                            </span>
                          ) : null}
                          {c.storeId && storeNameById.get(c.storeId) && stores.length > 1 && (
                            <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                              {storeNameById.get(c.storeId)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-600 mt-0.5">
                          {c.currentWeight !== null ? `開始 ${c.currentWeight}kg` : '体重未登録'}
                          {c.targetWeight !== null ? ` → 目標 ${c.targetWeight}kg` : ''}
                          {c.goals.kcal > 0 ? ` ・ 目標 ${c.goals.kcal}kcal/日` : ''}
                          {c.goals.kcal > 0 ? ` ・ 目標PFC P${c.goals.P}・F${c.goals.F}・C${c.goals.C}g` : ''}
                        </div>
                        {isPending && (
                          <div className="mt-1.5 flex gap-2 flex-wrap items-center">
                            <button
                              type="button"
                              onClick={(e) => approveCustomer(e, c.pageId, c.name)}
                              disabled={approvingId === c.pageId}
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border ${
                                approvingId === c.pageId
                                  ? 'bg-stone-100 text-stone-400 border-stone-300 cursor-wait'
                                  : 'bg-emerald-500 text-white border-emerald-500 active:bg-emerald-600'
                              }`}
                            >
                              <UserCheck className="w-3 h-3" strokeWidth={2.4} />
                              {approvingId === c.pageId ? '承認中…' : '承認'}
                            </button>
                          </div>
                        )}
                      </div>
                    </Link>
                    {isSample && (
                      <button
                        type="button"
                        onClick={() => openPreview(c.lineUserId, c.name, 'sample')}
                        className="flex items-center gap-1 font-bold py-1.5 px-2.5 rounded-lg text-xs border bg-violet-100 text-violet-700 border-violet-300 active:bg-violet-200 whitespace-nowrap flex-shrink-0"
                        title="読み取り専用"
                      >
                        <Monitor className="w-3.5 h-3.5" strokeWidth={2.2} />
                        顧客画面を見る
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0 ml-1" strokeWidth={2.2} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-stone-100 text-stone-600 border-stone-300">
        未設定
      </span>
    );
  }
  const cls =
    status === '承認待ち'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
      : status === '進行中'
      ? 'bg-orange-100 text-orange-700 border-orange-300'
      : status === '休止中'
      ? 'bg-sky-100 text-sky-700 border-sky-300'
      : status === '卒業'
      ? 'bg-stone-100 text-stone-600 border-stone-300'
      : 'bg-stone-100 text-stone-700 border-stone-300';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cls}`}>
      <Circle className="w-2 h-2 fill-current" strokeWidth={0} />
      {status}
    </span>
  );
}
