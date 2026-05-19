'use client';

import { useEffect, useState } from 'react';
import { initLiff } from '@/lib/liff';
import { apiFetch } from '@/lib/apiFetch';
import PageHeader from '@/components/PageHeader';
import { User, Save } from 'lucide-react';

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
};

type EditForm = {
  name: string;
  gender: string;
  heightCm: string;
  currentWeight: string;
  birthDate: string;
};

const GENDER_OPTIONS = ['男性', '女性', 'その他', '回答しない'];

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

function profileToForm(c: CustomerProfile): EditForm {
  return {
    name: c.name,
    gender: c.gender ?? '',
    heightCm: c.heightCm !== null ? String(c.heightCm) : '',
    currentWeight: c.currentWeight !== null ? String(c.currentWeight) : '',
    birthDate: c.birthDate ?? '',
  };
}

export default function ProfilePage() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const res = await apiFetch('/api/customer/me', { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        const c = j.customer;
        const p: CustomerProfile = {
          name: c.name,
          gender: c.gender,
          age: c.age,
          heightCm: c.heightCm,
          birthDate: c.birthDate,
          email: c.email,
          phone: c.phone,
          storeId: c.storeId,
          currentWeight: c.currentWeight,
        };
        setProfile(p);
        setForm(profileToForm(p));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const body: Record<string, unknown> = {};
      if (form.name.trim()) body.name = form.name.trim();
      body.gender = form.gender || null;
      body.heightCm = form.heightCm ? parseFloat(form.heightCm) : null;
      body.currentWeight = form.currentWeight ? parseFloat(form.currentWeight) : null;
      body.birthDate = form.birthDate || null;

      const res = await apiFetch('/api/customer/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `保存失敗（${res.status}）`);
      }
      const j = await res.json();
      const c = j.customer;
      const p: CustomerProfile = {
        name: c.name,
        gender: c.gender,
        age: c.age,
        heightCm: c.heightCm,
        birthDate: c.birthDate,
        email: c.email,
        phone: c.phone,
        storeId: c.storeId,
        currentWeight: c.currentWeight,
      };
      setProfile(p);
      setForm(profileToForm(p));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存エラー');
    } finally {
      setSaving(false);
    }
  }

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
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}
        {saveError && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-xl">保存しました</div>
        )}

        {form && (
          <>
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <EditRow label="氏名" required>
                <input
                  className="w-full text-sm font-bold text-stone-900 bg-transparent outline-none"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="氏名を入力"
                />
              </EditRow>
              <EditRow label="性別">
                <select
                  className="text-sm font-bold text-stone-900 bg-transparent outline-none w-full"
                  value={form.gender}
                  onChange={e => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">未設定</option>
                  {GENDER_OPTIONS.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </EditRow>
              <EditRow label="身長 (cm)">
                <input
                  className="w-full text-sm font-bold text-stone-900 bg-transparent outline-none"
                  type="number"
                  min={50}
                  max={250}
                  step={0.1}
                  value={form.heightCm}
                  onChange={e => setForm({ ...form, heightCm: e.target.value })}
                  placeholder="例: 165.0"
                />
              </EditRow>
              <EditRow label="体重 (kg)">
                <input
                  className="w-full text-sm font-bold text-stone-900 bg-transparent outline-none"
                  type="number"
                  min={20}
                  max={300}
                  step={0.1}
                  value={form.currentWeight}
                  onChange={e => setForm({ ...form, currentWeight: e.target.value })}
                  placeholder="例: 65.0"
                />
              </EditRow>
              <EditRow label="生年月日" last>
                <input
                  className="w-full text-sm font-bold text-stone-900 bg-transparent outline-none"
                  type="date"
                  value={form.birthDate}
                  onChange={e => setForm({ ...form, birthDate: e.target.value })}
                />
              </EditRow>
            </section>

            {(profile?.email || profile?.phone) && (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {profile.email && (
                  <ReadOnlyRow label="メールアドレス" value={maskEmail(profile.email)} />
                )}
                {profile.phone && (
                  <ReadOnlyRow label="電話番号" value={maskPhone(profile.phone)} last />
                )}
              </section>
            )}

            {profile?.storeId && (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <ReadOnlyRow label="所属店舗" value={profile.storeId} last />
              </section>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-stone-300 text-white font-bold text-sm py-3.5 rounded-2xl transition-colors"
            >
              <Save className="w-4 h-4" strokeWidth={2.2} />
              {saving ? '保存中...' : '保存する'}
            </button>
          </>
        )}

      </div>
    </main>
  );
}

function EditRow({
  label,
  required,
  last = false,
  children,
}: {
  label: string;
  required?: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center px-4 py-3 gap-3 ${last ? '' : 'border-b border-stone-100'}`}>
      <span className="text-xs text-stone-500 w-28 flex-shrink-0">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      <div className="flex-1">{children}</div>
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
      <span className="text-sm text-stone-400 flex-1">{value}</span>
    </div>
  );
}
