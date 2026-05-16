'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Save, Check } from 'lucide-react';
import AdminShell from '../../AdminShell';
import { useAdminBase } from '@/lib/useAdminBase';
import PasswordInput from '@/components/PasswordInput';

type Me = { email: string; role: 'master' | 'tenant_admin' };

export default function ChangePasswordPage() {
  const router = useRouter();
  const base = useAdminBase();
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j))
      .catch(() => {});
  }, []);

  async function submit() {
    setError(null);
    if (!current || !next) {
      setError('現在のパスワードと新しいパスワードを入力してください');
      return;
    }
    if (next.length < 8) {
      setError('新しいパスワードは8文字以上必要です');
      return;
    }
    if (next !== confirm) {
      setError('新しいパスワードの確認が一致しません');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || `変更失敗（${res.status}）`);
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
      setTimeout(() => {
        router.replace(base);
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="パスワード変更" back={{ href: base }}>
      <div className="space-y-3">
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Key className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
            ログインパスワードの変更
          </h2>

          {me?.role === 'master' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              マスタアカウントは環境変数 <code>ADMIN_PASSWORD_HASH</code> で管理されています。
              この画面からは変更できません。
            </div>
          ) : (
            <>
              {me?.email && (
                <div className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200 rounded-xl p-2.5">
                  ログインID: <code className="text-stone-900">{me.email}</code>
                </div>
              )}

              {done && (
                <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-xl inline-flex items-center gap-1">
                  <Check className="w-4 h-4" strokeWidth={2.4} />
                  パスワードを変更しました
                </div>
              )}
              {error && (
                <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">現在のパスワード</label>
                <PasswordInput
                  value={current}
                  onChange={setCurrent}
                  autoComplete="current-password"
                  accent="amber"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">新しいパスワード（8文字以上）</label>
                <PasswordInput
                  value={next}
                  onChange={setNext}
                  autoComplete="new-password"
                  minLength={8}
                  accent="amber"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">新しいパスワード（確認）</label>
                <PasswordInput
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  minLength={8}
                  accent="amber"
                />
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl active:bg-amber-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" strokeWidth={2.2} />
                {saving ? '変更中…' : 'パスワードを変更'}
              </button>
            </>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
