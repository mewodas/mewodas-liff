'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Lock, LogIn, Store } from 'lucide-react';

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname() || '';
  const isStore = pathname.startsWith('/store');
  const from = sp.get('from') || (isStore ? '/store' : '/admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `ログイン失敗（${res.status}）`);
      }
      router.replace(from);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 border border-stone-200"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          {isStore ? (
            <Store className="w-5 h-5 text-violet-600" strokeWidth={2.2} />
          ) : (
            <Lock className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
          )}
          <h1 className="text-lg font-bold text-stone-900">
            {isStore ? '店舗ログイン' : '管理者ログイン'}
          </h1>
        </div>
        <p className="text-xs text-stone-600 text-center mb-5">
          {isStore ? 'FitMeal 店舗管理' : 'FitMeal 管理画面'}
        </p>
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl mb-3">
            {error}
          </div>
        )}
        <label className="block text-xs font-bold text-stone-700 mb-1">メールアドレス</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
        />
        <label className="block text-xs font-bold text-stone-700 mb-1">パスワード</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
        />
        <button
          type="submit"
          disabled={submitting}
          className={`w-full text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 ${
            isStore
              ? 'bg-violet-500 active:bg-violet-700'
              : 'bg-emerald-500 active:bg-emerald-700'
          }`}
        >
          <LogIn className="w-4 h-4" strokeWidth={2.2} />
          {submitting ? 'ログイン中…' : 'ログイン'}
        </button>
        <div className="mt-4 text-center">
          <Link
            href={isStore ? '/store/account/reset' : '/admin/account/reset'}
            className="text-xs text-stone-600 hover:text-stone-900 underline"
          >
            パスワードを忘れた方
          </Link>
        </div>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-stone-100">読み込み中…</main>}>
      <LoginInner />
    </Suspense>
  );
}
