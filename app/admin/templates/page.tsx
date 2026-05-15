'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Edit, Trash2, Check, X, AlertTriangle, Sparkles } from 'lucide-react';
import AdminShell from '../AdminShell';
import { useAdminBase } from '@/lib/useAdminBase';

// レポート本文・タイトル・AI指示で使える変数一覧
const VARIABLES = [
  { key: '{customer}', label: '顧客名' },
  { key: '{date}', label: '日付' },
  { key: '{startDate}', label: '開始日' },
  { key: '{endDate}', label: '終了日' },
  { key: '{kcal}', label: '摂取kcal' },
  { key: '{P}', label: '摂取P(g)' },
  { key: '{F}', label: '摂取F(g)' },
  { key: '{C}', label: '摂取C(g)' },
  { key: '{targetKcal}', label: '目標kcal' },
  { key: '{targetP}', label: '目標P' },
  { key: '{targetF}', label: '目標F' },
  { key: '{targetC}', label: '目標C' },
  { key: '{kcalRatio}', label: 'kcal達成率%' },
  { key: '{weight}', label: '体重' },
  { key: '{targetWeight}', label: '目標体重' },
  { key: '{storeName}', label: '店舗名' },
  { key: '{signature}', label: '署名' },
];

type Template = {
  id: string;
  name: string;
  category: string;
  titleTemplate: string;
  bodyTemplate: string;
  useAi: boolean;
  aiPrompt: string;
};

const CATEGORIES = ['前日レポート', '週次レポート', 'カスタム'];

export default function AdminTemplatesPage() {
  const base = useAdminBase();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [configured, setConfigured] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/templates', { cache: 'no-store' });
      if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
      const j = await res.json();
      setConfigured(!!j.configured);
      setTemplates(j.templates || []);
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
    <AdminShell title="テンプレート管理" back={{ href: `${base}/reports` }}>
      <div className="space-y-3">
        {!configured && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.2} />
            <div>
              <div className="font-bold mb-1">テンプレDB が未設定です（デフォルトを表示中）</div>
              <p className="leading-relaxed">
                Notion でテンプレ用 DB を作成し、環境変数 <code className="font-mono bg-amber-100 px-1 rounded">NOTION_TEMPLATES_DB_ID</code> をセットしてください。
              </p>
              <p className="text-[10px] mt-1 leading-relaxed">
                スキーマ：名前(title) / カテゴリ(select) / タイトル雛形(rich_text) / 本文雛形(rich_text) / AI生成(checkbox) / AIプロンプト(rich_text)
              </p>
            </div>
          </div>
        )}

        {error && <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            テンプレ一覧（{templates.length}件）
          </h2>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!configured}
            className="inline-flex items-center gap-1 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full active:bg-emerald-700 disabled:bg-stone-300"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
            新規追加
          </button>
        </div>

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
            テンプレートがありません
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-stone-100 text-stone-700 border-stone-300">
                      {t.category}
                    </span>
                    {t.useAi && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-300">
                        <Sparkles className="w-2.5 h-2.5" strokeWidth={2.4} />
                        AI生成
                      </span>
                    )}
                    <div className="flex-1 text-sm font-bold text-stone-900 truncate">{t.name}</div>
                    {configured && !t.id.startsWith('default-') && (
                      <button
                        type="button"
                        onClick={() => setEditingId(t.id)}
                        className="text-[11px] font-bold text-emerald-700 border border-emerald-500 px-2.5 py-1 rounded-full active:bg-emerald-50 inline-flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" strokeWidth={2.4} />
                        編集
                      </button>
                    )}
                  </div>
                  {t.titleTemplate && (
                    <div className="text-[11px] text-stone-600 mt-1">
                      <span className="font-bold">タイトル:</span> {t.titleTemplate}
                    </div>
                  )}
                  {t.useAi && t.aiPrompt && (
                    <div className="text-[11px] text-stone-600 mt-0.5 line-clamp-2">
                      <span className="font-bold">AI指示:</span> {t.aiPrompt}
                    </div>
                  )}
                  {!t.useAi && t.bodyTemplate && (
                    <div className="text-[11px] text-stone-600 mt-0.5 line-clamp-2">
                      <span className="font-bold">本文:</span> {t.bodyTemplate}
                    </div>
                  )}
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
  const [category, setCategory] = useState(initial?.category || 'カスタム');
  const [titleTemplate, setTitleTemplate] = useState(initial?.titleTemplate || '');
  const [bodyTemplate, setBodyTemplate] = useState(initial?.bodyTemplate || '');
  const [useAi, setUseAi] = useState(initial?.useAi ?? false);
  const [aiPrompt, setAiPrompt] = useState(initial?.aiPrompt || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const aiRef = useRef<HTMLTextAreaElement>(null);

  function insertAtCursor(
    ref: React.RefObject<HTMLTextAreaElement | null>,
    current: string,
    setter: (v: string) => void,
    text: string
  ) {
    const ta = ref.current;
    if (!ta) {
      setter(current + text);
      return;
    }
    const start = ta.selectionStart ?? current.length;
    const end = ta.selectionEnd ?? current.length;
    const newValue = current.slice(0, start) + text + current.slice(end);
    setter(newValue);
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
      if (!name.trim()) throw new Error('名前は必須です');
      const url = initial ? `/api/admin/templates/${initial.id}` : '/api/admin/templates';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          titleTemplate,
          bodyTemplate,
          useAi,
          aiPrompt,
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
    <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-3 space-y-2">
      <div>
        <label className="text-[10px] font-bold text-stone-700 block mb-1">名前 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-stone-700 block mb-1">カテゴリ</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-bold text-stone-700 block mb-1">
          タイトル雛形 <span className="text-[9px] font-normal text-stone-500">変数: {'{date} {customer} {startDate} {endDate}'}</span>
        </label>
        <input
          type="text"
          value={titleTemplate}
          onChange={(e) => setTitleTemplate(e.target.value)}
          placeholder="例：{date}の振り返り"
          className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
        <span className="text-stone-700 font-bold">AI で本文を自動生成する</span>
      </label>
      {useAi ? (
        <div>
          <label className="text-[10px] font-bold text-stone-700 block mb-1">AI への指示</label>
          <textarea
            ref={aiRef}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={6}
            placeholder="例：昨日の食事・運動から達成度・改善点・今日のアドバイスを5-8行で。"
            className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y leading-relaxed"
          />
          <VariableChips
            label="変数を挿入"
            onInsert={(v) => insertAtCursor(aiRef, aiPrompt, setAiPrompt, v)}
          />
        </div>
      ) : (
        <div>
          <label className="text-[10px] font-bold text-stone-700 block mb-1">本文（変数を含めると送信時に自動置換）</label>
          <textarea
            ref={bodyRef}
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            rows={10}
            placeholder="{customer}さん、お疲れさまです！\n\n【{date} の振り返り】\n摂取カロリー: {kcal}kcal / {targetKcal}kcal"
            className="w-full bg-white border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y leading-relaxed font-mono"
          />
          <VariableChips
            label="変数を挿入"
            onInsert={(v) => insertAtCursor(bodyRef, bodyTemplate, setBodyTemplate, v)}
          />
        </div>
      )}
      {error && <div className="text-xs text-red-700">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-1 bg-emerald-500 text-white text-xs font-bold py-2 rounded-xl active:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
          {saving ? '保存中…' : initial ? '更新' : '追加'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-1 bg-white border border-stone-300 text-stone-700 text-xs font-bold px-3 py-2 rounded-xl active:bg-stone-50"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.4} />
          キャンセル
        </button>
        {initial && (
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center justify-center gap-1 bg-white border border-rose-300 text-rose-700 text-xs font-bold px-3 py-2 rounded-xl active:bg-rose-50"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
            削除
          </button>
        )}
      </div>
    </div>
  );
}

function VariableChips({ label, onInsert }: { label: string; onInsert: (v: string) => void }) {
  return (
    <div className="mt-1.5">
      <div className="text-[10px] font-bold text-stone-500 mb-1">{label}</div>
      <div className="flex gap-1 flex-wrap">
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onInsert(v.key)}
            className="text-[10px] font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
            title={`「${v.key}」を挿入`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
