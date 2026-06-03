'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarClock, Plus, Edit, Trash2, ToggleLeft, ToggleRight, X, Check } from 'lucide-react';
import AdminShell from '@/app/admin/AdminShell';
import { adminAccent } from '@/lib/adminAccent';
import { useToast } from '@/components/Toast';

type Frequency = '毎日' | '毎週' | '毎月';
type Audience = '全顧客' | '店舗';

type Rule = {
  id: string;
  tenantId: string;
  name: string;
  templateName: string;
  audience: Audience;
  targetStoreId: string | null;
  frequency: Frequency;
  weekdays: string[];
  dayOfMonth: number | null;
  time: string;
  saveInApp: boolean;
  sendLine: boolean;
  enabled: boolean;
};

type Template = { id: string; name: string; category: string };
type Store = { pageId: string; storeId: string; name: string };
type Me = {
  role: 'master' | 'tenant_admin';
  currentTenantId: string;
  availableTenants: { id: string; name: string }[];
};

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

function frequencyLabel(rule: Rule): string {
  if (rule.frequency === '毎日') return '毎日';
  if (rule.frequency === '毎週') {
    return `毎週 ${rule.weekdays.join('・')}曜`;
  }
  return `毎月 ${rule.dayOfMonth ?? '?'}日`;
}

function destinationLabel(rule: Rule): string {
  const parts: string[] = [];
  if (rule.saveInApp) parts.push('アプリ');
  if (rule.sendLine) parts.push('LINE');
  return parts.join('・');
}

const EMPTY_FORM = {
  name: '',
  templateName: '',
  audience: '全顧客' as Audience,
  targetStoreId: '',
  frequency: '毎日' as Frequency,
  weekdays: [] as string[],
  dayOfMonth: '' as number | '',
  time: '06:00',
  saveInApp: true,
  sendLine: true,
  enabled: true,
  tenantId: '',
};

export default function ScheduledReportsPage() {
  const toast = useToast();
  const pathname = usePathname() || '';
  const isStore = pathname.startsWith('/store');
  const ac = adminAccent(isStore);

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [me, setMe] = useState<Me | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scheduled-reports', { cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      setConfigured(j.configured !== false);
      setRules(j.rules || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
    fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setMe(j); })
      .catch(() => {});
    fetch('/api/admin/templates', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.templates) setTemplates(j.templates); })
      .catch(() => {});
    fetch('/api/admin/stores', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.stores) setStores(j.stores); })
      .catch(() => {});
  }, [loadRules]);

  const isMaster = me?.role === 'master';

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, tenantId: me?.currentTenantId || '' });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(rule: Rule) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      templateName: rule.templateName,
      audience: rule.audience,
      targetStoreId: rule.targetStoreId || '',
      frequency: rule.frequency,
      weekdays: [...rule.weekdays],
      dayOfMonth: rule.dayOfMonth ?? '',
      time: rule.time,
      saveInApp: rule.saveInApp,
      sendLine: rule.sendLine,
      enabled: rule.enabled,
      tenantId: rule.tenantId,
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  function toggleWeekday(day: string) {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day],
    }));
  }

  async function submitForm() {
    setFormError(null);
    if (!form.name.trim()) { setFormError('ルール名は必須です'); return; }
    if (!form.templateName.trim()) { setFormError('テンプレは必須です'); return; }
    if (!form.time || !/^\d{2}:\d{2}$/.test(form.time)) { setFormError('時刻を HH:MM で入力してください'); return; }
    if (form.frequency === '毎週' && form.weekdays.length === 0) {
      setFormError('毎週の場合は曜日を選択してください'); return;
    }
    if (form.frequency === '毎月' && (form.dayOfMonth === '' || Number(form.dayOfMonth) < 1 || Number(form.dayOfMonth) > 31)) {
      setFormError('毎月の場合は日（1〜31）を入力してください'); return;
    }
    if (!form.saveInApp && !form.sendLine) { setFormError('アプリ内保存・LINE送信のいずれかを選択してください'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        templateName: form.templateName.trim(),
        audience: form.audience,
        targetStoreId: form.audience === '店舗' ? (form.targetStoreId || null) : null,
        frequency: form.frequency,
        weekdays: form.weekdays,
        dayOfMonth: form.dayOfMonth !== '' ? Number(form.dayOfMonth) : null,
        time: form.time,
        saveInApp: form.saveInApp,
        sendLine: form.sendLine,
        enabled: form.enabled,
      };
      if (!isStore && isMaster && form.tenantId) {
        payload.tenantId = form.tenantId;
      }

      const url = editingId
        ? `/api/admin/scheduled-reports/${editingId}`
        : '/api/admin/scheduled-reports';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setFormError(j.error || '保存に失敗しました');
        toast.error(j.error || '保存に失敗しました');
        return;
      }
      toast.success(editingId ? '更新しました' : '作成しました');
      closeForm();
      await loadRules();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'エラー';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(rule: Rule) {
    try {
      const res = await fetch(`/api/admin/scheduled-reports/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error || '更新に失敗しました');
        return;
      }
      toast.success(rule.enabled ? '無効にしました' : '有効にしました');
      await loadRules();
    } catch {
      toast.error('更新に失敗しました');
    }
  }

  async function deleteRule(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/scheduled-reports/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error || '削除に失敗しました');
        return;
      }
      toast.success('削除しました');
      await loadRules();
    } catch {
      toast.error('削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell title="定期レポート設定">
      <div className="space-y-3">
        {!configured && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800">
            SCHEDULED_REPORTS_DB_ID が未設定です。環境変数を設定してください。
          </div>
        )}

        {configured && (
          <>
            <div className="flex items-center justify-between">
              <div className="text-xs text-stone-500">
                設定したスケジュールで顧客へレポートを自動送信します
              </div>
              <button
                type="button"
                onClick={openCreate}
                className={`flex items-center gap-1.5 text-xs font-bold ${ac.btn} text-white px-3 py-2 rounded-xl hover:${ac.btn}`}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
                新規作成
              </button>
            </div>

            {loading && (
              <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center text-xs text-stone-400">
                読み込み中…
              </div>
            )}

            {!loading && rules.length === 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
                <CalendarClock className="w-10 h-10 text-stone-300 mx-auto mb-2" strokeWidth={1.5} />
                <div className="text-sm font-bold text-stone-700 mb-1">定期レポートルールがありません</div>
                <div className="text-xs text-stone-500">「新規作成」から設定を追加してください</div>
              </div>
            )}

            {!loading && rules.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100 overflow-hidden">
                {rules.map((rule) => (
                  <div key={rule.id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-sm font-bold ${rule.enabled ? 'text-stone-900' : 'text-stone-400'}`}>
                            {rule.name}
                          </span>
                          {!rule.enabled && (
                            <span className="text-[10px] font-bold text-stone-400 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded-full">
                              無効
                            </span>
                          )}
                          {isMaster && !isStore && (
                            <span className="text-[10px] text-stone-400 bg-stone-50 border border-stone-200 px-1.5 py-0.5 rounded-full">
                              {rule.tenantId}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-600">
                          <span>{frequencyLabel(rule)} {rule.time}</span>
                          <span>宛先: {rule.audience === '店舗' ? `店舗(${rule.targetStoreId || '—'})` : '全顧客'}</span>
                          <span>送信先: {destinationLabel(rule)}</span>
                          <span>テンプレ: {rule.templateName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleEnabled(rule)}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                          title={rule.enabled ? '無効にする' : '有効にする'}
                        >
                          {rule.enabled ? (
                            <ToggleRight className="w-5 h-5 text-emerald-500" strokeWidth={2} />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-stone-400" strokeWidth={2} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(rule)}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                          title="編集"
                        >
                          <Edit className="w-4 h-4" strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule.id)}
                          disabled={deletingId === rule.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 disabled:opacity-50"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* 作成/編集フォーム モーダル */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90dvh] flex flex-col">
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-stone-100 flex-shrink-0">
                <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  <CalendarClock className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                  {editingId ? 'ルールを編集' : '新規ルール作成'}
                </div>
                <button type="button" onClick={closeForm} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500">
                  <X className="w-4 h-4" strokeWidth={2.4} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
                {/* master のみ: 対象テナント */}
                {!isStore && isMaster && (
                  <div>
                    <label className="text-[10px] font-bold text-stone-700 block mb-1">対象テナント</label>
                    <select
                      value={form.tenantId}
                      onChange={(e) => setForm((p) => ({ ...p, tenantId: e.target.value }))}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">テナントを選択</option>
                      {(me?.availableTenants || []).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* ルール名 */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 block mb-1">ルール名</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="例: 毎朝前日レポート"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* テンプレ選択 */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 block mb-1">テンプレ</label>
                  {templates.length > 0 ? (
                    <select
                      value={form.templateName}
                      onChange={(e) => setForm((p) => ({ ...p, templateName: e.target.value }))}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">テンプレを選択</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form.templateName}
                      onChange={(e) => setForm((p) => ({ ...p, templateName: e.target.value }))}
                      placeholder="テンプレ名を入力"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  )}
                </div>

                {/* 宛先 */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 block mb-1">宛先</label>
                  <div className="flex gap-2">
                    {(['全顧客', '店舗'] as Audience[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, audience: a }))}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                          form.audience === a
                            ? ac.pillActive
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  {form.audience === '店舗' && (
                    <div className="mt-2">
                      <label className="text-[10px] font-bold text-stone-500 block mb-1">対象店舗</label>
                      {stores.length > 0 ? (
                        <select
                          value={form.targetStoreId}
                          onChange={(e) => setForm((p) => ({ ...p, targetStoreId: e.target.value }))}
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">店舗を選択</option>
                          {stores.map((s) => (
                            <option key={s.pageId} value={s.storeId}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={form.targetStoreId}
                          onChange={(e) => setForm((p) => ({ ...p, targetStoreId: e.target.value }))}
                          placeholder="storeId を入力"
                          className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* 頻度 */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 block mb-1">頻度</label>
                  <div className="flex gap-2">
                    {(['毎日', '毎週', '毎月'] as Frequency[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, frequency: f }))}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                          form.frequency === f
                            ? ac.pillActive
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  {form.frequency === '毎週' && (
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      {WEEKDAYS.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWeekday(day)}
                          className={`w-8 h-8 text-xs font-bold rounded-full border ${
                            form.weekdays.includes(day)
                              ? ac.pillActive
                              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.frequency === '毎月' && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={form.dayOfMonth}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, dayOfMonth: e.target.value === '' ? '' : Number(e.target.value) }))
                        }
                        placeholder="例: 1"
                        className="w-20 bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-stone-600">日（1〜31）</span>
                    </div>
                  )}
                </div>

                {/* 時刻 */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 block mb-1">送信時刻（JST）</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                    className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">※現在は配信日（毎日／曜日／日）に毎朝まとめて自動配信されます。時刻の細かい指定は今後対応予定です。</p>
                </div>

                {/* 送信先 */}
                <div>
                  <label className="text-[10px] font-bold text-stone-700 block mb-1">送信先</label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.saveInApp}
                        onChange={(e) => setForm((p) => ({ ...p, saveInApp: e.target.checked }))}
                        className="w-4 h-4 accent-emerald-500"
                      />
                      <span className="text-stone-700">FitMeal アプリ内に保存</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.sendLine}
                        onChange={(e) => setForm((p) => ({ ...p, sendLine: e.target.checked }))}
                        className="w-4 h-4 accent-emerald-500"
                      />
                      <span className="text-stone-700">LINE に送信</span>
                    </label>
                  </div>
                </div>

                {/* 有効 */}
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <span className="font-bold text-stone-700">このルールを有効にする</span>
                </label>

                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl">
                    {formError}
                  </div>
                )}
              </div>

              <div className="flex gap-2 px-4 pb-4 pt-3 border-t border-stone-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 text-sm font-bold text-stone-700 border border-stone-300 py-2.5 rounded-xl hover:bg-stone-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={submitForm}
                  disabled={saving}
                  className={`flex-1 ${ac.btn} text-white text-sm font-bold py-2.5 rounded-xl hover:${ac.btn} disabled:opacity-50 inline-flex items-center justify-center gap-1.5`}
                >
                  {saving ? (
                    <>保存中…</>
                  ) : (
                    <>
                      <Check className="w-4 h-4" strokeWidth={2.4} />
                      {editingId ? '更新する' : '作成する'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
