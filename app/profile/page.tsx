'use client';

import { useEffect, useState } from 'react';
import { initLiff } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import PageHeader from '@/components/PageHeader';
import { User } from 'lucide-react';

type CustomerProfile = {
  name: string;
  furigana: string | null;
  gender: string | null;
  age: number | null;
  heightCm: number | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  storeId: string | null;
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

function formatBirthDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export default function ProfilePage() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const res = await apiFetch(`/api/customer/me`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        const c = j.customer;
        setProfile({
          name: c.name,
          furigana: c.furigana,
          gender: c.gender,
          age: c.age,
          heightCm: c.heightCm,
          birthDate: c.birthDate,
          email: c.email,
          phone: c.phone,
          storeId: c.storeId,
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
          トレーナーが管理する情報です。変更が必要な場合はトレーナーにご連絡ください。
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {profile && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <ProfileRow label="氏名" value={profile.name} />
            <ProfileRow label="フリガナ" value={profile.furigana ?? '—'} />
            <ProfileRow label="性別" value={profile.gender ?? '—'} />
            <ProfileRow label="年齢" value={profile.age !== null ? `${profile.age}歳` : '—'} />
            <ProfileRow label="身長" value={profile.heightCm !== null ? `${profile.heightCm} cm` : '—'} />
            <ProfileRow label="生年月日" value={formatBirthDate(profile.birthDate)} />
            <ProfileRow label="メールアドレス" value={maskEmail(profile.email)} />
            <ProfileRow label="電話番号" value={maskPhone(profile.phone)} last />
          </section>
        )}

        {profile?.storeId && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <ProfileRow label="所属店舗" value={profile.storeId} last />
          </section>
        )}
      </div>
    </main>
  );
}

function ProfileRow({
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
      <span className="text-xs text-stone-500 w-24 flex-shrink-0">{label}</span>
      <span className="text-sm font-bold text-stone-900 flex-1">{value}</span>
    </div>
  );
}
