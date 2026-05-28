'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Send, AlertTriangle, Pin, ChevronDown, ChevronUp } from 'lucide-react';
import AdminShell from '../AdminShell';
import { useToast } from '@/components/Toast';

type AnnouncementImportance = '通常' | '重要';
type AnnouncementScope = 'all' | 'tenant';

type Announcement = {
  id: string;
  title: string;
  body: string;
  importance: AnnouncementImportance;
  audience: string;
  pinned: boolean;
  publishedAt: string | null;
  status: string;
  targetTenants: string[];
};

type Me = {
  role: 'master' | 'tenant_admin';
  currentTenantId: string;
  availableTenants: { id: string; name: string }[];
};

export default function AdminAnnouncementsPage() {
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  const [scope, setScope] = useState<AnnouncementScope>('all');
  const [targetTenantId, setTargetTenantId] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [importance, setImportance] = useState<AnnouncementImportance>('通常');
  const [pinned, setPinned] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setMe(j); })
      .catch(() => {});
  }, []);

  async function loadAnnouncements() {
    try {
      const res = await fetch('/api/admin/announcements', { cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      setConfigured(j.configured !== false);
      setAnnouncements(j.announcements || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAnnouncements(); }, []);

  const isMaster = me?.role === 'master';
  const showTenantSelect = scope === 'tenant';

  async function submit() {
    if (!annTitle.trim() || !annBody.trim()) {
      setFormError('タイトルと本文は必須です');
      return;
    }
    setSending(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        title: annTitle.trim(),
        body: annBody.trim(),
        audience: '店舗向け',
        importance,
        pinned,
        scope,
      };
      if (scope === 'tenant' && targetTenantId) {
        payload.targetTenantId = targetTenantId;
      }
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setFormError(j.error || '送信に失敗しました');
        toast.error(j.error || '送信に失敗しました');
        return;
      }
      toast.success('お知らせを送信しました');
      setAnnTitle('');
      setAnnBody('');
      setPinned(false);
      setImportance('通常');
      setScope('all');
      setTargetTenantId('');
      await loadAnnouncements();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '送信に失敗しました';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  if (me && !isMaster) {
    return (
      <AdminShell title="店舗へのお知らせ">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          この画面は運営（master）専用です。
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="店舗へのお知らせ">
      <div className="space-y-3">
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 text-xs text-violet-800">
          <span className="font-bold">運営から店舗オーナーへのお知らせを作成します。</span>
          顧客には表示されません。店舗ダッシュボードのベルアイコンから受信できます。
        </div>

        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-800">
            <Megaphone className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
            新しいお知らせを作成
          </div>

          <div>
            <label className="text-[10px] font-bold text-stone-700 block mb-1">対象店舗</label>
            <div className="flex gap-2 mb-2">
              {([['all', '全店舗'], ['tenant', '特定店舗']] as [AnnouncementScope, string][]).map(([s, label]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                    scope === s
                      ? 'bg-violet-500 text-white border-violet-500'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {showTenantSelect && (
              <select
                value={targetTenantId}
                onChange={(e) => setTargetTenantId(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">テナントを選択</option>
                {(me?.availableTenants || []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-stone-700 block mb-1">タイトル</label>
            <input
              type="text"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="例：新機能リリースのお知らせ"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-stone-700 block mb-1">本文</label>
            <textarea
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              rows={6}
              placeholder="お知らせの内容を入力してください"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="text-[10px] font-bold text-stone-700 block mb-1">重要度</label>
              <div className="flex gap-2">
                {(['通常', '重要'] as AnnouncementImportance[]).map((imp) => (
                  <button
                    key={imp}
                    type="button"
                    onClick={() => setImportance(imp)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border inline-flex items-center gap-1 ${
                      importance === imp
                        ? imp === '重要'
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-violet-500 text-white border-violet-500'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    {imp === '重要' && <AlertTriangle className="w-3 h-3" strokeWidth={2.4} />}
                    {imp}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="w-4 h-4 accent-violet-500"
              />
              <Pin className="w-3.5 h-3.5 text-stone-500" strokeWidth={2.2} />
              ピン留め
            </label>
          </div>

          {formError && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">
              {formError}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={sending || !annTitle.trim() || !annBody.trim()}
            className="w-full bg-violet-500 text-white font-bold py-3 rounded-xl active:bg-violet-700 disabled:bg-stone-300 inline-flex items-center justify-center gap-2 text-sm"
          >
            <Send className="w-4 h-4" strokeWidth={2.2} />
            {sending ? '送信中…' : '店舗へ送信'}
          </button>
        </section>

        {/* 送信履歴 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
          <div className="text-sm font-bold text-stone-800 mb-3">送信履歴</div>
          {!configured && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              NOTION_ANNOUNCEMENTS_DB_ID が未設定です。
            </div>
          )}
          {configured && loading && (
            <div className="text-xs text-stone-400 py-2">読み込み中…</div>
          )}
          {configured && !loading && announcements.length === 0 && (
            <div className="text-xs text-stone-400 py-2">送信履歴はありません</div>
          )}
          {configured && !loading && announcements.length > 0 && (
            <div className="space-y-2">
              {announcements.map((a) => (
                <AnnouncementRow key={a.id} announcement={a} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

function AnnouncementRow({ announcement: a }: { announcement: Announcement }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-50"
      >
        {a.pinned && <Pin className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" strokeWidth={2.2} />}
        {a.importance === '重要' && (
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" strokeWidth={2.2} />
        )}
        <span className="text-xs font-bold text-stone-800 flex-1 truncate">{a.title}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {a.targetTenants.length > 0 && (
            <span className="text-[10px] text-stone-500">{a.targetTenants.join(', ')}</span>
          )}
          <span className="text-[10px] text-stone-400">{a.publishedAt || '—'}</span>
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-stone-400" strokeWidth={2.2} />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" strokeWidth={2.2} />
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-stone-100 px-3 py-2.5 bg-stone-50">
          <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">{a.body}</p>
          <div className="flex gap-2 mt-2">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                a.status === '公開'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : a.status === '下書き'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-stone-100 text-stone-500 border-stone-200'
              }`}
            >
              {a.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
