'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { initLiff } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import PageHeader from '@/components/PageHeader';
import { User, Target, TrendingDown, ChevronRight } from 'lucide-react';

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

            {/* 目標サマリ（編集は /goals 経由） */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                  目標
                </h2>
                <Link
                  href="/goals"
                  className="text-xs font-bold text-emerald-700 inline-flex items-center gap-0.5 active:opacity-70"
                >
                  詳細を見る
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.4} />
                </Link>
              </div>

              {(profile.targetWeight !== null || profile.targetDate) && (
                <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" strokeWidth={2.4} />
                    体重目標
                  </div>
                  <div className="text-sm font-bold text-stone-900">
                    {profile.targetWeight !== null ? `${profile.targetWeight} kg` : '—'}
                    {profile.targetDate && (
                      <span className="text-xs font-medium text-stone-600 ml-2">
                        （{profile.targetDate.replace(/-/g, '/')}まで）
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="text-[10px] font-bold text-stone-600 mb-1.5">1日の栄養目標</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <GoalCell label="kcal" value={profile.goals.kcal} unit="" />
                <GoalCell label="P" value={profile.goals.P} unit="g" />
                <GoalCell label="F" value={profile.goals.F} unit="g" />
                <GoalCell label="C" value={profile.goals.C} unit="g" />
              </div>

              {(profile.plan || profile.activityLevel) && (
                <div className="mt-3 flex items-center gap-3 text-xs text-stone-700">
                  {profile.plan && (
                    <span>
                      プラン：<span className="font-bold text-stone-900">{profile.plan}</span>
                    </span>
                  )}
                  {profile.activityLevel && (
                    <span>
                      活動量：<span className="font-bold text-stone-900">{profile.activityLevel}</span>
                    </span>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function GoalCell({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg py-2">
      <div className="text-[10px] text-stone-500">{label}</div>
      <div className="text-sm font-bold text-stone-900">
        {value}
        {unit && <span className="text-[10px] text-stone-500 ml-0.5">{unit}</span>}
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
