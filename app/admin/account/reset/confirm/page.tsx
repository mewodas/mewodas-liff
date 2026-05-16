'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Key, Save, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import PasswordInput from '@/components/PasswordInput';

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname() || '';
  const isStore = pathname.startsWith('/store');
  const loginPath = isStore ? '/store/login' : '/admin/login';
  const accent = isStore ? 'violet' : 'emerald';

  const token = sp.get('token') || '';

  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError('リンクが不正です。再度パスワード再設定をリクエストしてください。');
      return;
    }
    if (next.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }
    if (next !== confirm) {
      setError('新しいパスワードと確認用が一致しません');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: next }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || `エラー（${res.status}）`);
      setDone(true);
      // 2秒後にログイン画面へ自動遷移
      setTimeout(() => router.replace(loginPath), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 border border-stone-200 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" strokeWidth={2.2} />
          <h1 className="text-base font-bold text-stone-900">リンクが不正です</h1>
          <p className="text-xs text-stone-600 mt-2 leading-relaxed">
            URLに必要なトークンが含まれていません。
            <br />
            再度パスワード再設定をリクエストしてください。
          </p>
          <Link
            href={isStore ? '/store/account/reset' : '/admin/account/reset'}
            className={`mt-4 inline-block bg-${accent}-500 text-white font-bold text-sm px-4 py-2 rounded-xl`}
          >
            パスワード再設定へ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 border border-stone-200"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <Key className={`w-5 h-5 text-${accent}-600`} strokeWidth={2.2} />
          <h1 className="text-lg font-bold text-stone-900">新しいパスワード設定</h1>
        </div>
        <p className="text-xs text-stone-600 text-center mb-5">
          8文字以上で新しいパスワードを入力してください
        </p>

        {done ? (
          <div className="space-y-3">
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-sm p-3 rounded-xl inline-flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.4} />
              <div>
                <div className="font-bold">設定完了しました</div>
                <div className="text-xs mt-1">2秒後にログイン画面へ移動します…</div>
              </div>
            </div>
            <Link
              href={loginPath}
              className={`block text-center bg-${accent}-500 text-white font-bold py-2.5 rounded-xl active:bg-${accent}-700`}
            >
              今すぐログインへ
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl mb-3">
                {error}
              </div>
            )}
            <label className="block text-xs font-bold text-stone-700 mb-1">新しいパスワード（8文字以上）</label>
            <div className="mb-3">
              <PasswordInput
                value={next}
                onChange={setNext}
                autoComplete="new-password"
                autoFocus
                minLength={8}
                required
                accent={isStore ? 'violet' : 'emerald'}
              />
            </div>
            <label className="block text-xs font-bold text-stone-700 mb-1">確認用（同じものを再入力）</label>
            <div className="mb-4">
              <PasswordInput
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                minLength={8}
                required
                accent={isStore ? 'violet' : 'emerald'}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || next.length < 8 || next !== confirm}
              className={`w-full text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 ${
                isStore ? 'bg-violet-500 active:bg-violet-700' : 'bg-emerald-500 active:bg-emerald-700'
              }`}
            >
              <Save className="w-4 h-4" strokeWidth={2.2} />
              {submitting ? '設定中…' : 'パスワードを設定する'}
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

export default function ResetConfirmPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-stone-100">読み込み中…</main>}>
      <Inner />
    </Suspense>
  );
}
