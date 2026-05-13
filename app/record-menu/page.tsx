'use client';

import Link from 'next/link';

const items = [
  {
    href: '/record',
    icon: '📷',
    title: '食事を記録',
    desc: '写真+メモから AI がPFC算出',
    color: 'bg-orange-500',
  },
  {
    href: '/weight',
    icon: '⚖️',
    title: '体重を記録',
    desc: '当日の体重を入力',
    color: 'bg-sky-500',
  },
  {
    href: '/exercise',
    icon: '🏃',
    title: '運動を記録',
    desc: '運動有無＋内容を入力',
    color: 'bg-emerald-500',
  },
];

export default function RecordMenuPage() {
  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6 pb-28">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-stone-900">📝 記録する</h1>
        <p className="text-sm text-stone-700 mb-6">何を記録しますか？</p>

        <div className="space-y-3">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="block bg-white rounded-2xl shadow-md p-5 border border-stone-200 active:bg-stone-50"
            >
              <div className="flex items-center gap-4">
                <div className={`${it.color} text-white w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow`}>
                  {it.icon}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold text-stone-900">{it.title}</div>
                  <div className="text-xs text-stone-600 mt-0.5">{it.desc}</div>
                </div>
                <div className="text-stone-400 text-xl">›</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
