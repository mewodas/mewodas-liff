'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  minLength?: number;
  required?: boolean;
  /** focus ring の色トーン (login/reset の文脈別) */
  accent?: 'emerald' | 'violet' | 'amber';
};

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  autoFocus,
  minLength,
  required,
  accent = 'emerald',
}: Props) {
  const [visible, setVisible] = useState(false);
  const ringClass =
    accent === 'violet'
      ? 'focus:ring-violet-500'
      : accent === 'amber'
      ? 'focus:ring-amber-500'
      : 'focus:ring-emerald-500';

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        minLength={minLength}
        required={required}
        className={`w-full bg-white text-stone-900 border border-stone-300 rounded-xl pl-3 pr-10 py-3 text-sm focus:outline-none focus:ring-2 ${ringClass}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700 p-1 z-10"
        aria-label={visible ? 'パスワードを隠す' : 'パスワードを表示'}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="w-4 h-4" strokeWidth={2.2} />
        ) : (
          <Eye className="w-4 h-4" strokeWidth={2.2} />
        )}
      </button>
    </div>
  );
}
