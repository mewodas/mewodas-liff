'use client';

import { useEffect, useState } from 'react';
import { initLiff } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import PageHeader from '@/components/PageHeader';
import { User, TrendingDown } from 'lucide-react';

type CustomerProfile = {
  name: string;
  gender: string | null;
  age: number | null;
  heightCm: number | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  storeId: string | null;
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  goals: { kcal: number; P: number; F: number; C: number };
  plan: string | null;
  activityLevel: string | null;
};

function maskEmail(email: string | null): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local[0]}***@${domain}`;
}

function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function formatBirthDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return `${y}年${m}月${day}日`;
}

function formatGoalDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return `${y}年${m}月${day}日`;
}

function daysUntil(dateStr: string): number {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ProfilePage() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const res = await apiFetch('/api/customer/me', { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        const c = j.customer;
        setProfile({
          name: c.name,
          gender: c.gender,
          age: c.age,
          heightCm: c.heightCm,
          birthDate: c.birthDate,
          email: c.email,
          phone: c.phone,
          storeId: c.storeId,
          currentWeight: c.currentWeight,
          targetWeight: c.targetWeight,
          targetDate: c.targetDate,
          goals: c.goals,
          plan: c.plan,
          activityLevel: c.activityLevel,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setReady(true);
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
    <main className="min-h-screen bg-stone-100 pb-28">
      <PageHeader title="プロフィール" Icon={User} subtitle="登録情報" back />
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
          トレーナーが登録した情報です。変更が必要な場合はトレーナーにご連絡ください。
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {profile && (
          <>
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <ReadOnlyRow label="氏名" value={profile.name || '—'} />
              <ReadOnlyRow label="性別" value={profile.gender || '—'} />
              <ReadOnlyRow
                label="身長"
                value={profile.heightCm !== null ? `${profile.heightCm} cm` : '—'}
              />
              <ReadOnlyRow
                label="体重"
                value={profile.currentWeight !== null ? `${profile.currentWeight} kg` : '—'}
              />
              <ReadOnlyRow label="生年月日" value={formatBirthDate(profile.birthDate)} last />
            </section>

            {(profile.email || profile.phone) && (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {profile.email && (
                  <ReadOnlyRow label="メールアドレス" value={maskEmail(profile.email)} />
                )}
                {profile.phone && (
                  <ReadOnlyRow label="電話番号" value={maskPhone(profile.phone)} last />
                )}
              </section>
            )}

            {profile.storeId && (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <ReadOnlyRow label="所属店舗" value={profile.storeId} last />
              </section>
            )}

            {/* 体重目標 */}
            {(profile.currentWeight !== null || profile.targetWeight !== null) && (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                <h2 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                  体重目標
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="開始体重"
                    value={profile.currentWeight !== null ? `${profile.currentWeight}` : '—'}
                    unit="kg"
                    color="sky"
                  />
                  <StatCard
                    label="目標体重"
                    value={profile.targetWeight !== null ? `${profile.targetWeight}` : '—'}
                    unit="kg"
                    color="emerald"
                  />
                </div>
              </section>
            )}

            {/* 目標達成日 */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-bold text-stone-900 mb-3">目標達成日</h2>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-stone-900">{formatGoalDate(profile.targetDate)}</span>
                {profile.targetDate && (
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${(() => {
                      const r = daysUntil(profile.targetDate);
                      if (r <= 0) return 'bg-rose-100 text-rose-700';
                      if (r <= 30) return 'bg-amber-100 text-amber-700';
                      return 'bg-emerald-100 text-emerald-700';
                    })()}`}
                  >
                    {(() => {
                      const r = daysUntil(profile.targetDate);
                      return r <= 0 ? '期限終了' : `あと ${r} 日`;
                    })()}
                  </span>
                )}
              </div>
            </section>

            {/* 1日の栄養目標 */}
            <NutritionGoalCard goals={profile.goals} />

            {/* プラン・活動レベル */}
            {(profile.plan || profile.activityLevel) && (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {profile.plan && (
                  <div
                    className={`flex items-center px-4 py-3 gap-3 ${
                      profile.activityLevel ? 'border-b border-stone-100' : ''
                    }`}
                  >
                    <span className="text-xs text-stone-500 w-24 flex-shrink-0">プラン</span>
                    <span
                      className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                        profile.plan === '減量'
                          ? 'bg-red-100 text-red-700'
                          : profile.plan === '増量'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {profile.plan}
                    </span>
                  </div>
                )}
                {profile.activityLevel && (
                  <div className="flex items-center px-4 py-3 gap-3">
                    <span className="text-xs text-stone-500 w-24 flex-shrink-0">活動レベル</span>
                    <span className="text-sm font-bold text-stone-900">{profile.activityLevel}</span>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function NutritionGoalCard({
  goals,
}: {
  goals: { kcal: number; P: number; F: number; C: number };
}) {
  const pKcal = goals.P * 4;
  const fKcal = goals.F * 9;
  const cKcal = goals.C * 4;
  const totalPfcKcal = pKcal + fKcal + cKcal;
  const pPct = totalPfcKcal > 0 ? Math.round((pKcal / totalPfcKcal) * 100) : 0;
  const fPct = totalPfcKcal > 0 ? Math.round((fKcal / totalPfcKcal) * 100) : 0;
  const cPct = totalPfcKcal > 0 ? Math.max(0, 100 - pPct - fPct) : 0;

  const nutrients = [
    { label: 'たんぱく質', value: goals.P, unit: 'g' },
    { label: '脂質', value: goals.F, unit: 'g' },
    { label: '炭水化物', value: goals.C, unit: 'g' },
  ];

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <h2 className="text-base font-bold text-stone-900 mb-3">1日の栄養目標</h2>

      <div className="mb-4">
        <div className="text-xs text-stone-600 mb-1">カロリー</div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-stone-900">{goals.kcal}</span>
          <span className="text-sm font-medium text-stone-500">kcal</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-3 mb-4">
        {nutrients.map((n) => (
          <div key={n.label}>
            <div className="text-[11px] font-medium text-stone-700 mb-1">{n.label}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-stone-900">{n.value}</span>
              <span className="text-[10px] text-stone-500">{n.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {totalPfcKcal > 0 && (
        <div>
          <div className="text-[11px] font-bold text-stone-700 mb-1.5">PFCバランス</div>
          <div className="flex h-5 rounded-full overflow-hidden border border-stone-200">
            <div className="bg-rose-400" style={{ width: `${pPct}%` }} />
            <div className="bg-amber-400" style={{ width: `${fPct}%` }} />
            <div className="bg-sky-400" style={{ width: `${cPct}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-stone-600">
            <span className="font-medium">
              <span className="inline-block w-2 h-2 bg-rose-400 rounded-sm mr-1" />
              P {pPct}%
            </span>
            <span className="font-medium">
              <span className="inline-block w-2 h-2 bg-amber-400 rounded-sm mr-1" />
              F {fPct}%
            </span>
            <span className="font-medium">
              <span className="inline-block w-2 h-2 bg-sky-400 rounded-sm mr-1" />
              C {cPct}%
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

type ColorKey = 'sky' | 'emerald' | 'orange' | 'rose' | 'amber';

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: ColorKey;
}) {
  const bg: Record<ColorKey, string> = {
    sky: 'bg-sky-50 border-sky-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    orange: 'bg-orange-50 border-orange-200',
    rose: 'bg-rose-50 border-rose-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  const text: Record<ColorKey, string> = {
    sky: 'text-sky-700',
    emerald: 'text-emerald-700',
    orange: 'text-orange-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
  };
  return (
    <div className={`border rounded-xl px-3 py-3 ${bg[color]}`}>
      <div className="text-[11px] text-stone-600 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${text[color]}`}>{value}</span>
        <span className="text-xs text-stone-500">{unit}</span>
      </div>
    </div>
  );
}

function ReadOnlyRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center px-4 py-3 gap-3 ${last ? '' : 'border-b border-stone-100'}`}>
      <span className="text-xs text-stone-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-sm font-bold text-stone-700 flex-1">{value}</span>
    </div>
  );
}
