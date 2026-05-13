'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initLiff, getLineProfile } from '@/lib/liff';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

const SUGGESTED_QUESTIONS = [
  '今夜ラーメン食べていい？',
  '残りでおすすめの夕食教えて',
  '体重がなかなか減らないんだけど',
  '間食したいけど何が良い？',
  'タンパク質をもっと増やしたい',
];

export default function ChatPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        await initLiff();
        const profile = await getLineProfile();
        if (!profile) {
          setError('LINEプロフィール取得失敗');
          setReady(true);
          return;
        }
        setUserId(profile.userId);
        // 初回ウェルカムメッセージ
        setMessages([
          {
            role: 'assistant',
            content: `こんにちは、${profile.displayName}さん！🌿\n食事や運動について、お気軽にご相談ください。例えば「今夜ラーメン食べていい？」「残りでおすすめの夕食は？」など、なんでもどうぞ💬`,
            timestamp: Date.now(),
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'LIFF初期化エラー');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(messageText?: string) {
    const text = (messageText ?? input).trim();
    if (!text || !userId || sending) return;
    setError(null);
    const newUserMessage: Message = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setInput('');
    setSending(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: userId, message: text, history }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `送信失敗（${res.status}）`);
      }
      const json = await res.json();
      const newAssistantMessage: Message = {
        role: 'assistant',
        content: json.reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信エラー');
    } finally {
      setSending(false);
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
    <main className="min-h-screen bg-stone-100 flex flex-col pb-28">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-white border-b border-stone-200 px-4 py-3 z-10 flex items-center gap-2">
        <button
          onClick={() => router.push('/home')}
          className="text-stone-600 active:text-stone-900 px-2 -ml-2"
          aria-label="戻る"
        >
          ←
        </button>
        <div>
          <h1 className="text-base font-bold text-stone-900">💬 AIに相談</h1>
          <p className="text-[10px] text-stone-500">あなた専属のAI管理栄養士</p>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {sending && (
          <div className="flex gap-2 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm flex-shrink-0">
              💬
            </div>
            <div className="bg-white rounded-2xl px-4 py-3 max-w-[75%] border border-stone-200">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"></span>
                <span
                  className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                ></span>
                <span
                  className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                ></span>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 提案質問（初回のみ） */}
      {messages.length === 1 && (
        <div className="px-4 pb-3">
          <div className="text-[10px] text-stone-500 mb-2 font-medium">こんなことが聞けます</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="bg-white border border-stone-300 text-stone-700 text-xs px-3 py-1.5 rounded-full active:bg-stone-100"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 入力欄 */}
      <div className="fixed bottom-14 left-0 right-0 bg-white border-t border-stone-200 px-3 py-2">
        <div className="max-w-md mx-auto flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            rows={1}
            className="flex-1 bg-stone-50 border border-stone-300 rounded-2xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-24"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !sending) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || sending}
            className="bg-emerald-600 text-white font-bold w-10 h-10 rounded-full active:bg-emerald-700 disabled:bg-stone-300 flex items-center justify-center flex-shrink-0"
            aria-label="送信"
          >
            ↑
          </button>
        </div>
      </div>
    </main>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
          isUser ? 'bg-stone-300 text-stone-700' : 'bg-emerald-500 text-white'
        }`}
      >
        {isUser ? '👤' : '💬'}
      </div>
      <div
        className={`rounded-2xl px-4 py-2.5 max-w-[75%] text-sm whitespace-pre-wrap leading-relaxed ${
          isUser ? 'bg-emerald-500 text-white' : 'bg-white text-stone-900 border border-stone-200'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
