'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail, Send, ArrowLeft, Check } from 'lucide-react';

function Inner() {
  const pathname = usePathname() || '';
  const isStore = pathname.startsWith('/store');
  const loginPath = isStore ? '/store/login' : '/admin/login';
  const accent = isStore ? 'violet' : 'emerald';

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `エラー（${res.status}）`);
      }
      setDone(true);
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
          <Mail className={`w-5 h-5 text-${accent}-600`} strokeWidth={2.2} />
          <h1 className="text-lg font-bold text-stone-900">パスワード再設定</h1>
        </div>
        <p className="text-xs text-stone-600 text-center mb-5">
          登録メールアドレスに新しいパスワードを送信します
        </p>

        {done ? (
          <div className="space-y-4">
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-sm p-3 rounded-xl inline-flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.4} />
              <div>
                <div className="font-bold">送信完了</div>
                <div className="text-xs mt-1 leading-relaxed">
                  入力されたメールアドレスが登録済みの場合、新しいパスワードを記載したメールを送信しました。届かない場合は迷惑メールフォルダもご確認ください。
                </div>
              </div>
            </div>
            <Link
              href={loginPath}
              className={`w-full bg-${accent}-500 text-white font-bold py-3 rounded-xl active:bg-${accent}-700 flex items-center justify-center gap-2`}
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2.2} />
              ログイン画面へ
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl mb-3">
                {error}
              </div>
            )}
            <label className="block text-xs font-bold text-stone-700 mb-1">登録メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
              className={`w-full bg-white text-stone-900 border border-stone-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-${accent}-500 mb-4`}
            />
            <button
              type="submit"
              disabled={submitting || !email}
              className={`w-full text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 ${
                isStore ? 'bg-violet-500 active:bg-violet-700' : 'bg-emerald-500 active:bg-emerald-700'
              }`}
            >
              <Send className="w-4 h-4" strokeWidth={2.2} />
              {submitting ? '送信中…' : '再設定メールを送信'}
            </button>
            <div className="mt-4 text-center">
              <Link href={loginPath} className="text-xs text-stone-600 hover:text-stone-900 inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" strokeWidth={2.4} />
                ログイン画面に戻る
              </Link>
            </div>
          </>
        )}
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-stone-100">読み込み中…</main>}>
      <Inner />
    </Suspense>
  );
}
