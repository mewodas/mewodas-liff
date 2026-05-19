import Link from 'next/link';

export function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center bg-white rounded-2xl py-3 px-1 border border-stone-200 shadow-sm active:bg-emerald-50"
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span className="text-[11px] font-bold text-stone-900 mt-1 text-center leading-tight">
        {label}
      </span>
    </Link>
  );
}
