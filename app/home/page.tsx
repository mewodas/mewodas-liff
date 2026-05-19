import { Suspense } from 'react';
import LiffGate from './_components/LiffGate';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-stone-100">
          <div className="text-stone-800">読み込み中...</div>
        </main>
      }
    >
      <LiffGate />
    </Suspense>
  );
}
