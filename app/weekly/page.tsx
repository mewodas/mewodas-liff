'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { initLiff, getLineProfile } from '@/lib/liff';
import { getCached, setCached } from '@/lib/clientCache';

type DailyAgg = {
  date: string;
  weekday: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  mealCount: number;
  recorded: boolean;
};

type WeeklyData = {
  customer: {
    name: string;
    goals: { kcal: number; P: number; F: number; C: number };
    currentWeight: number | null;
    targetWeight: number | null;
    targetDate: string | null;
  };
  week: {
    offset: number;
    startDate: string;
    endDate: string;
    daily: DailyAgg[];
    sum: { kcal: number; P: number; F: number; C: number };
    avg: { kcal: number; P: number; F: number; C: number };
    recordedDays: number;
  };
};

export default function WeeklyPage() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<WeeklyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

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
        setUserId(profile.userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化エラー');
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const cacheKey = `weekly_${userId}_${offset}`;
    const cached = getCached<WeeklyData>(cacheKey);
    if (cached) {
      setData(cached.data);
      setReady(true);
      if (!cached.isStale) {
        setError(null);
        return;
      }
    } else {
      setReady(false);
    }
    (async () => {
      try {
        const res = await fetch(`/api/weekly?lineUserId=${encodeURIComponent(userId)}&offset=${offset}&t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `データ取得失敗（${res.status}）`);
        }
        const json = await res.json();
        setData(json);
        setCached(cacheKey, json);
        setError(null);
      } catch (e) {
        if (!cached) setError(e instanceof Error ? e.message : '読み込みエラー');
      } finally {
        setReady(true);
      }
    })();
  }, [userId, offset]);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-800">読み込み中...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="bg-red-100 border border-red-300 text-red-800 p-4 rounded-xl text-sm mb-4">
            {error || 'データなし'}
          </div>
          <Link href="/home" className="block bg-emerald-600 text-white text-center font-bold py-3 rounded-xl">
            ホームへ
          </Link>
        </div>
      </main>
    );
  }

  const { customer, week } = data;
  const { goals } = customer;
  const weekLabel = `${fmtJp(week.startDate)} 〜 ${fmtJp(week.endDate)}`;
  const offsetLabel = offset === 0 ? '今週' : offset === -1 ? '先週' : offset > 0 ? `${offset}週後` : `${-offset}週前`;

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 pb-28">
      <div className="max-w-md mx-auto">
        {/* ヘッダー */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-stone-900">📈 週次レポート</h1>
          <p className="text-sm font-medium text-stone-700 mt-1">{offsetLabel}：{weekLabel}</p>
        </div>

        {/* 週ナビゲーション（過去のみ） */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setOffset(offset - 1)}
            className="flex-1 bg-white border border-stone-300 text-stone-900 font-bold py-2 rounded-xl text-sm active:bg-stone-50"
          >
            ← 前週
          </button>
          {offset !== 0 && (
            <>
              <button
                onClick={() => setOffset(0)}
                className="px-4 bg-emerald-600 text-white font-bold py-2 rounded-xl text-sm"
              >
                今週
              </button>
              <button
                onClick={() => setOffset(offset + 1)}
                className="flex-1 bg-white border border-stone-300 text-stone-900 font-bold py-2 rounded-xl text-sm active:bg-stone-50"
              >
                翌週 →
              </button>
            </>
          )}
        </div>

        {/* 週間平均 */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <h2 className="text-base font-bold text-stone-900 mb-3">📊 週間平均（記録日のみ）</h2>
          <p className="text-xs text-stone-600 mb-3">記録日数 {week.recordedDays}/7日</p>
          <AvgRow label="カロリー" value={week.avg.kcal} goal={goals.kcal} unit="kcal" />
          <AvgRow label="タンパク質" value={week.avg.P} goal={goals.P} unit="g" />
          <AvgRow label="脂質" value={week.avg.F} goal={goals.F} unit="g" />
          <AvgRow label="炭水化物" value={week.avg.C} goal={goals.C} unit="g" />
        </div>

        {/* 日別カロリーグラフ */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <h2 className="text-base font-bold text-stone-900 mb-3">📅 日別カロリー</h2>
          <div className="w-full h-56">
            <ResponsiveContainer>
              <BarChart data={week.daily} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis
                  dataKey="weekday"
                  tick={{ fill: '#44403c', fontSize: 12 }}
                  axisLine={{ stroke: '#d6d3d1' }}
                />
                <YAxis tick={{ fill: '#44403c', fontSize: 11 }} axisLine={{ stroke: '#d6d3d1' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v} kcal`, 'カロリー']}
                />
                <ReferenceLine
                  y={goals.kcal}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: '目標', position: 'right', fill: '#10b981', fontSize: 11 }}
                />
                <Bar dataKey="kcal" fill="#f97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 日別詳細リスト */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-4 border border-stone-200">
          <h2 className="text-base font-bold text-stone-900 mb-3">📋 日別詳細</h2>
          <div className="space-y-1">
            {week.daily.map((d) => (
              <div key={d.date} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-b-0">
                <span className="font-medium text-stone-800 text-sm">
                  {fmtMd(d.date)}（{d.weekday}）
                </span>
                {d.recorded ? (
                  <div className="text-right">
                    <div className="font-bold text-stone-900 text-sm">{d.kcal} kcal</div>
                    <div className="text-xs text-stone-600">
                      P{d.P} F{d.F} C{d.C}
                    </div>
                  </div>
                ) : (
                  <span className="text-stone-400 text-sm">未記録</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function AvgRow({ label, value, goal, unit }: { label: string; value: number; goal: number; unit: string }) {
  const pct = goal > 0 ? Math.round((value / goal) * 100) : 0;
  const status = Math.abs(pct - 100) <= 5 ? '✨' : Math.abs(pct - 100) <= 15 ? '⭕' : Math.abs(pct - 100) <= 25 ? '🔺' : '💦';
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="font-medium text-stone-800">
        {label} {status}
      </span>
      <span className="font-bold text-stone-900">
        {value} / {goal} {unit}
        <span className="text-xs font-medium text-stone-500 ml-1">（{pct}%）</span>
      </span>
    </div>
  );
}

function fmtJp(dateString: string): string {
  // 'yyyy-MM-dd' → '5/13'
  const [, m, d] = dateString.split('-').map(Number);
  return `${m}/${d}`;
}

function fmtMd(dateString: string): string {
  return fmtJp(dateString);
}
