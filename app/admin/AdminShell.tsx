'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Users, ChevronLeft } from 'lucide-react';

export default function AdminShell({
  title,
  back,
  children,
}: {
  title: string;
  back?: { href: string } | null;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {back ? (
              <Link
                href={back.href}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 flex-shrink-0"
                aria-label="戻る"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
              </Link>
            ) : (
              <Users className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={2.2} />
            )}
            <h1 className="text-sm sm:text-base font-bold text-stone-900 truncate">{title}</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-xs font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1 px-2 py-1 rounded-full hover:bg-stone-100"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={2.2} />
            ログアウト
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
