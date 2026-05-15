'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Edit, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import AdminShell from '../AdminShell';
import { useAdminBase } from '@/lib/useAdminBase';

type Template = {
  id: string;
  name: string;
  category: string;
  titleTemplate: string;
  bodyTemplate: string;
  useAi: boolean;
  aiPrompt: string;
};

// 本文・タイトルに使える変数（カテゴリ別）
const VARIABLE_GROUPS = [
  {
    title: '基本',
    vars: [
      { key: '{customer}', label: '顧客名' },
      { key: '{date}', label: '日付' },
      { key: '{storeName}', label: '店舗名' },
      { key: '{signature}', label: '署名' },
    ],
  },
  {
    title: '食事（合計）',
    vars: [
      { key: '{kcal}', label: 'kcal' },
      { key: '{P}', label: 'P(g)' },
      { key: '{F}', label: 'F(g)' },
      { key: '{C}', label: 'C(g)' },
    ],
  },
  {
    title: '目標値',
    vars: [
      { key: '{targetKcal}', label: '目標kcal' },
      { key: '{targetP}', label: '目標P' },
      { key: '{targetF}', label: '目標F' },
      { key: '{targetC}', label: '目標C' },
      { key: '{kcalRatio}', label: 'kcal達成率%' },
    ],
  },
  {
    title: '体重',
    vars: [
      { key: '{weight}', label: '現在体重' },
      { key: '{targetWeight}', label: '目標体重' },
    ],
  },
  {
    title: '食事別',
    vars: [
      { key: '{breakfast_kcal}', label: '朝食kcal' },
      { key: '{breakfast_P}', label: '朝食P' },
      { key: '{breakfast_F}', label: '朝食F' },
      { key: '{breakfast_C}', label: '朝食C' },
      { key: '{lunch_kcal}', label: '昼食kcal' },
      { key: '{lunch_P}', label: '昼食P' },
      { key: '{lunch_F}', label: '昼食F' },
      { key: '{lunch_C}', label: '昼食C' },
      { key: '{dinner_kcal}', label: '夕食kcal' },
      { key: '{dinner_P}', label: '夕食P' },
      { key: '{dinner_F}', label: '夕食F' },
      { key: '{dinner_C}', label: '夕食C' },
      { key: '{snack_kcal}', label: '間食kcal' },
      { key: '{snack_P}', label: '間食P' },
      { key: '{snack_F}', label: '間食F' },
      { key: '{snack_C}', label: '間食C' },
    ],
  },
  {
    title: '範囲レポート',
    vars: [
      { key: '{startDate}', label: '開始日' },
      { key: '{endDate}', label: '終了日' },
    ],
  },
  {
    title: '✨ AIコメント自動生成（送信時に Gemini が書く）',
    vars: [
      { key: '{ai_summary}', label: '全体評価' },
      { key: '{ai_good_points}', label: '良かった点' },
      { key: '{ai_advice}', label: 'アドバイス' },
      { key: '{ai_one_word}', label: '応援一言' },
      { key: '{ai_keep_doing}', label: '続けたいこと' },
      { key: '{ai_improvement}', label: '改善ポイント' },
    ],
  },
];

export default function AdminTemplatesPage() {
  const base = useAdminBase();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/templates', { cache: 'no-store' });
      if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
      const j = await res.json();
      setTemplates(j.templates || []);
      if (j.error) setError(j.hint || j.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell title="レポート文面管理" back={{ href: `${base}/reports` }}>
      <div className="space-y-3">
        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3 rounded-xl inline-flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
            <div>{error}</div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5 mb-1">
            <FileText className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            レポート文面一覧（{templates.length}件）
          </h2>
          <p className="text-[10px] text-stone-500">
            ジムオーナーが顧客に送るレポート文章のひな形。本文に変数（例：<code>{'{customer}'}</code>）を入れると送信時に実データに自動置換されます。
          </p>
        </div>

        {!addOpen && !editingId && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} />
            新規レポート文面追加
          </button>
        )}

        {addOpen && (
          <TemplateEditor
            onCancel={() => setAddOpen(false)}
            onSaved={async () => {
              setAddOpen(false);
              await load();
            }}
          />
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : templates.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">
            レポート文面がありません
          </div>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) =>
              editingId === t.id ? (
                <li key={t.id}>
                  <TemplateEditor
                    initial={t}
                    onCancel={() => setEditingId(null)}
                    onSaved={async () => {
                      setEditingId(null);
                      await load();
                    }}
                    onDeleted={async () => {
                      setEditingId(null);
                      await load();
                    }}
                  />
                </li>
              ) : (
                <li key={t.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-stone-900 truncate">{t.name}</div>
                      {t.titleTemplate && (
                        <div className="text-[11px] text-stone-500 mt-0.5 truncate">
                          📨 送信タイトル: {t.titleTemplate}
                        </div>
                      )}
                      {t.bodyTemplate && (
                        <div className="text-[11px] text-stone-600 mt-1 line-clamp-3 whitespace-pre-wrap">
                          {t.bodyTemplate}
                        </div>
                      )}
                    </div>
                    {!t.id.startsWith('default-') && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingId(t.id)}
                          className="text-[11px] font-bold text-emerald-700 border border-emerald-500 px-2.5 py-1 rounded-full active:bg-emerald-50 inline-flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" strokeWidth={2.4} />
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`テンプレ「${t.name}」を削除しますか？`)) return;
                            try {
                              const res = await fetch(`/api/admin/templates/${t.id}`, { method: 'DELETE' });
                              if (!res.ok) throw new Error(`削除失敗（${res.status}）`);
                              await load();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : '削除エラー');
                            }
                          }}
                          className="text-[11px] font-bold text-rose-700 border border-rose-300 px-2.5 py-1 rounded-full active:bg-rose-50 inline-flex items-center gap-1"
                          aria-label="削除"
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={2.2} />
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function TemplateEditor({
  initial,
  onCancel,
  onSaved,
  onDeleted,
}: {
  initial?: Template;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [titleTemplate, setTitleTemplate] = useState(initial?.titleTemplate || '');
  const [bodyTemplate, setBodyTemplate] = useState(initial?.bodyTemplate || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertAtCursor(text: string) {
    const ta = bodyRef.current;
    if (!ta) {
      setBodyTemplate(bodyTemplate + text);
      return;
    }
    const start = ta.selectionStart ?? bodyTemplate.length;
    const end = ta.selectionEnd ?? bodyTemplate.length;
    const newValue = bodyTemplate.slice(0, start) + text + bodyTemplate.slice(end);
    setBodyTemplate(newValue);
    setTimeout(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error('テンプレ名は必須です');
      const url = initial ? `/api/admin/templates/${initial.id}` : '/api/admin/templates';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: 'カスタム', // 後方互換のため固定値で送信
          titleTemplate,
          bodyTemplate,
          useAi: false,
          aiPrompt: '',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    if (!confirm(`テンプレ「${initial.name}」を削除しますか？`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/templates/${initial.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`削除失敗（${res.status}）`);
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-400 shadow-md p-3 space-y-3">
      <div className="text-sm font-bold text-emerald-700">{initial ? 'レポート文面を編集' : '新規レポート文面'}</div>

      <div>
        <label className="text-[10px] font-bold text-stone-700 block mb-1">
          ① 文面名 <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：前日レポート"
          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="text-[10px] text-stone-500 mt-0.5">レポート送付画面で識別する名前（顧客には見えません）</div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-stone-700 block mb-1">② 送信タイトル（任意）</label>
        <input
          type="text"
          value={titleTemplate}
          onChange={(e) => setTitleTemplate(e.target.value)}
          placeholder="例：{date}の振り返り"
          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="text-[10px] text-stone-500 mt-0.5">通知の見出しに使われる（変数 {'{date}'} {'{customer}'} 等使用可）</div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-stone-700 block mb-1">
          ③ 本文 <span className="text-rose-500">*</span>
        </label>
        <textarea
          ref={bodyRef}
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          rows={12}
          placeholder={`{customer}さん、お疲れさまです！\n\n【{date} の振り返り】\nカロリー: {kcal}kcal / {targetKcal}kcal`}
          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y font-mono"
        />
        <div className="text-[10px] text-stone-500 mt-0.5">
          ボタンで変数を挿入できます。送信時に実データに自動置換。
        </div>
      </div>

      {/* 変数挿入パネル（カテゴリ別） */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 space-y-2">
        <div className="text-[10px] font-bold text-stone-700">📌 変数を挿入</div>
        {VARIABLE_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="text-[9px] font-bold text-stone-500 mb-1">{group.title}</div>
            <div className="flex gap-1 flex-wrap">
              {group.vars.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertAtCursor(v.key)}
                  className="text-[10px] font-bold text-stone-700 bg-white hover:bg-emerald-50 border border-stone-300 px-2 py-0.5 rounded-full"
                  title={`「${v.key}」を挿入`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-lg">{error}</div>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim()}
          className="flex-1 bg-emerald-500 text-white text-sm font-bold py-2.5 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
        >
          <Check className="w-4 h-4" strokeWidth={2.4} />
          {saving ? '保存中…' : initial ? '更新' : '追加'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-white border border-stone-300 text-stone-700 text-sm font-bold px-3 py-2.5 rounded-xl active:bg-stone-50"
        >
          <X className="w-4 h-4" strokeWidth={2.4} />
        </button>
        {initial && (
          <button
            type="button"
            onClick={remove}
            className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-3 py-2.5 rounded-xl active:bg-rose-100"
            aria-label="削除"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}
