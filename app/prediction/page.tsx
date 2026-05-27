'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { TrendingDown, BarChart3, CheckCircle2, AlertTriangle, MessageCircle } from 'lucide-react';
import { initLiff, getLineProfile } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import { getCached, setCached } from '@/lib/clientCache';
import FooterNav from '@/components/FooterNav';

type Prediction = {
  predictedWeight: number;
  monthlyChange: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  willReachGoal: boolean | null;
  comment: string;
  recommendations: string[];
};

type PredictionData = {
  prediction: Prediction | null;
  reason?: string;
  message?: string;
  weightHistory?: Array<{ date: string; weight: number }>;
  dataPoints: {
    recordedDays: number;
    weightDays: number;
    exerciseDays: number;
  };
};

type Customer = {
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
};

export default function PredictionPage() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictionData | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (!profile) {
          setError('LINEプロフィール取得失敗');
          setReady(true);
          return;
        }
        const userId = profile.userId;
        const today = jstToday();

        // 顧客情報（体重目標）取得
        const todayRes = await apiFetch(
          `/api/today?date=${today}&t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (todayRes.ok) {
          const tj = await todayRes.json();
          setCustomer({
            currentWeight: tj.customer?.currentWeight ?? null,
            targetWeight: tj.customer?.targetWeight ?? null,
            targetDate: tj.customer?.targetDate ?? null,
          });
        }

        // 予測キャッシュチェック
        const cacheKey = `predict_v1_${userId}_${today}`;
        const cached = getCached<PredictionData>(cacheKey);
        if (cached) {
          setData(cached.data);
          if (!cached.isStale) {
            setReady(true);
            return;
          }
        }
        setLoading(true);
        const res = await apiFetch(
          `/api/predict-weight?t=${Date.now()}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`予測取得失敗（${res.status}）`);
        const json: PredictionData = await res.json();
        setData(json);
        setCached(cacheKey, json);
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        setReady(true);
        setLoading(false);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 pb-24">
      <PageHeader
        title="体重推移・AI予測"
        Icon={TrendingDown}
        subtitle="直近30日の体重推移とAI予測"
        back
      />

      <div className="px-4 py-5 space-y-4">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm font-medium p-3 rounded-xl">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
            <TrendingDown className="w-10 h-10 text-purple-500 mx-auto mb-2" strokeWidth={2}/>
            <div className="text-sm font-bold text-stone-800 mb-1">予測中…</div>
            <div className="text-[10px] text-stone-500">直近データを分析しています</div>
          </div>
        )}

        {data && data.weightHistory && data.weightHistory.length > 0 && (
          <WeightHistoryChart history={data.weightHistory} targetWeight={customer?.targetWeight ?? null} />
        )}

        {data && !data.prediction && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
            <BarChart3 className="w-10 h-10 text-emerald-500 mx-auto mb-2" strokeWidth={2}/>
            <div className="text-sm font-bold text-stone-800 mb-1">AI予測はデータ不足です</div>
            <div className="text-xs text-stone-600 leading-relaxed">
              {data.message || '体重・食事を継続的に記録すると予測できるようになります。'}
            </div>
          </div>
        )}

        {data && data.prediction && (
          <PredictionDetail prediction={data.prediction} customer={customer} />
        )}
      </div>

      <FooterNav />
    </main>
  );
}

function PredictionDetail({
  prediction: p,
  customer,
}: {
  prediction: Prediction;
  customer: Customer | null;
}) {
  const confColor =
    p.confidenceLevel === 'high'
      ? 'text-emerald-700 bg-emerald-100 border-emerald-300'
      : p.confidenceLevel === 'low'
      ? 'text-stone-700 bg-stone-100 border-stone-300'
      : 'text-amber-700 bg-amber-100 border-amber-300';
  const confLabel =
    p.confidenceLevel === 'high' ? '高' : p.confidenceLevel === 'low' ? '低' : '中';
  const changeIcon = p.monthlyChange < 0 ? '↓' : p.monthlyChange > 0 ? '↑' : '→';
  const GoalIcon = p.willReachGoal === true ? CheckCircle2 : p.willReachGoal === false ? AlertTriangle : null;
  const goalIconColor = p.willReachGoal === true ? 'text-emerald-600' : 'text-amber-600';

  return (
    <div className="space-y-4">
      {/* メイン予測 */}
      <div className="bg-white rounded-2xl shadow-md border border-stone-200 p-5">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs font-bold text-stone-700">3ヶ月後の予測体重</div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confColor}`}>
            信頼度 {confLabel}
          </span>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-3">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-bold text-purple-700">{p.predictedWeight}</span>
            <span className="text-sm font-medium text-stone-700">kg</span>
          </div>
          {customer?.targetWeight && (
            <div className="text-xs text-stone-700 inline-flex items-center gap-0.5">
              目標 {customer.targetWeight} kg
              {GoalIcon && <GoalIcon className={`w-3 h-3 ${goalIconColor}`} strokeWidth={2.2} />}
            </div>
          )}
          <div className="text-sm font-bold text-purple-800 mt-2">
            {changeIcon} 月平均 {Math.abs(p.monthlyChange)} kg/月
          </div>
        </div>
        {p.comment && (
          <div className="bg-stone-50 rounded-xl p-3 text-sm text-stone-800 leading-relaxed flex items-start gap-1.5">
            <MessageCircle className="w-4 h-4 text-stone-500 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
            {p.comment}
          </div>
        )}
      </div>

      <div className="text-[10px] text-stone-500 leading-relaxed px-2">
        ※ 直近30日の食事・運動・体重データから AI が推定した参考値です。実際の体重変化と異なる場合があります。
      </div>
    </div>
  );
}

function WeightHistoryChart({
  history,
  targetWeight,
}: {
  history: Array<{ date: string; weight: number }>;
  targetWeight: number | null;
}) {
  if (history.length === 0) return null;
  // 日付昇順にソート
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map((h) => h.weight);
  const minW = Math.min(...weights, targetWeight || Infinity);
  const maxW = Math.max(...weights, targetWeight || -Infinity);
  // 余白を上下1kgずつ取る
  const yMin = Math.floor(minW - 1);
  const yMax = Math.ceil(maxW + 1);
  const yRange = Math.max(1, yMax - yMin);

  const latest = sorted[sorted.length - 1];
  const oldest = sorted[0];
  const change = Math.round((latest.weight - oldest.weight) * 10) / 10;
  const changeColor = change < 0 ? 'text-emerald-700' : change > 0 ? 'text-rose-700' : 'text-stone-700';
  const changeIcon = change < 0 ? '↓' : change > 0 ? '↑' : '→';

  // SVG座標生成
  const width = 320;
  const height = 160;
  const padL = 36;
  const padR = 8;
  const padT = 12;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const xFor = (i: number) =>
    sorted.length === 1 ? padL + innerW / 2 : padL + (i / (sorted.length - 1)) * innerW;
  const yFor = (w: number) => padT + ((yMax - w) / yRange) * innerH;

  const polyPoints = sorted.map((p, i) => `${xFor(i)},${yFor(p.weight)}`).join(' ');
  const targetY = targetWeight && targetWeight >= yMin && targetWeight <= yMax ? yFor(targetWeight) : null;

  const yTicks = [yMin, yMin + Math.round(yRange / 2), yMax];

  return (
    <div className="bg-white rounded-2xl shadow-md border border-stone-200 p-5">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
          <TrendingDown className="w-4 h-4 text-purple-600" strokeWidth={2.2}/>
          体重推移
        </h2>
        <span className="text-[11px] text-stone-500">直近{history.length}日分</span>
      </div>

      <div className="flex items-baseline gap-3 mb-3">
        <div>
          <div className="text-[10px] text-stone-500">最新</div>
          <div className="text-2xl font-bold text-stone-900">
            {latest.weight}
            <span className="text-xs font-medium text-stone-600 ml-1">kg</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-stone-500">期間変化</div>
          <div className={`text-base font-bold ${changeColor}`}>
            {changeIcon} {Math.abs(change)} kg
          </div>
        </div>
        {targetWeight && (
          <div>
            <div className="text-[10px] text-stone-500">目標</div>
            <div className="text-base font-bold text-purple-700">{targetWeight} kg</div>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-40"
        preserveAspectRatio="none"
      >
        {/* グリッド線 */}
        {yTicks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e7e5e4" strokeDasharray="2 3" />
              <text x={padL - 4} y={y + 3} fontSize="10" textAnchor="end" fill="#78716c">
                {t}
              </text>
            </g>
          );
        })}

        {/* 目標ライン */}
        {targetY !== null && (
          <>
            <line
              x1={padL}
              y1={targetY}
              x2={width - padR}
              y2={targetY}
              stroke="#a855f7"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text x={width - padR} y={targetY - 4} fontSize="9" textAnchor="end" fill="#a855f7">
              目標 {targetWeight}kg
            </text>
          </>
        )}

        {/* 線グラフ */}
        <polyline
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyPoints}
        />

        {/* データ点 */}
        {sorted.map((p, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(p.weight)} r="2.5" fill="#0ea5e9" />
        ))}

        {/* X軸ラベル（最古・中央・最新） */}
        {sorted.length > 0 && (
          <>
            <text x={xFor(0)} y={height - 8} fontSize="9" textAnchor="start" fill="#78716c">
              {fmtMd(sorted[0].date)}
            </text>
            <text x={width / 2} y={height - 8} fontSize="9" textAnchor="middle" fill="#78716c">
              {fmtMd(sorted[Math.floor(sorted.length / 2)].date)}
            </text>
            <text x={width - padR} y={height - 8} fontSize="9" textAnchor="end" fill="#78716c">
              {fmtMd(sorted[sorted.length - 1].date)}
            </text>
          </>
        )}
      </svg>

      <div className="text-[10px] text-stone-500 mt-2 leading-relaxed">
        ※ 体重を記録した日のみ線でつないでいます。空白日があると線がスキップされます。
      </div>
    </div>
  );
}

function fmtMd(dateString: string): string {
  const [, m, d] = dateString.split('-').map(Number);
  return `${m}/${d}`;
}

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
