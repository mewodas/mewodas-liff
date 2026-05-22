'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Save, ExternalLink, Mail, Hash, Tag, Store as StoreIcon, Plus, Edit, Trash2, X, MapPin, Phone, User, Key, Copy, Check, RefreshCw, MessageCircle, Clock, CreditCard, Zap } from 'lucide-react';
import AdminShell from '../../AdminShell';
import { useToast } from '@/components/Toast';

type Tenant = {
  pageId: string;
  name: string;
  tenantId: string;
  plan: string | null;
  customerDbId: string | null;
  foodDbId: string | null;
  liffId: string | null;
  ownerEmail: string | null;
  status: string | null;
  startDate: string | null;
  lineChannelToken: string | null;
  lineAutoSendEnabled: boolean;
  autoSendTime: string | null;
  billingMode: '無制限' | '手動' | 'Stripe連動' | null;
  seatLimit: number | null;
  planCode: string | null;
  stripeSubscriptionId: string | null;
};

type PlanDef = {
  pageId: string;
  planCode: string;
  name: string;
  kind: '標準' | 'PoC' | 'エンタープライズ';
  minSeats: number;
  published: boolean;
  active: boolean;
};

const PLANS = ['5-10名', '11-20名', '21名+', 'モニター', '無料'];
const STATUSES = ['アクティブ', '休止', '解約', '商談中'];
const BILLING_MODES = ['無制限', '手動', 'Stripe連動'] as const;

type Store = {
  pageId: string;
  storeId: string;
  name: string;
  tenantId: string;
  address: string;
  phone: string;
  hours: string;
  manager: string;
  signature: string;
  active: boolean;
};

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [liffId, setLiffId] = useState('');
  const [plan, setPlan] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [status, setStatus] = useState('');
  const [lineChannelToken, setLineChannelToken] = useState('');
  const [lineAutoSendEnabled, setLineAutoSendEnabled] = useState(false);
  const [autoSendTime, setAutoSendTime] = useState('06:00');
  const [billingMode, setBillingMode] = useState<'無制限' | '手動' | 'Stripe連動' | ''>('');
  const [seatLimit, setSeatLimit] = useState<number | ''>('');
  const [planCode, setPlanCode] = useState('');
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [applyStripeSeats, setApplyStripeSeats] = useState<number>(3);
  const [applyStripeLoading, setApplyStripeLoading] = useState(false);
  const [applyStripeMsg, setApplyStripeMsg] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeFormOpen, setStoreFormOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);

  async function loadStores() {
    try {
      const res = await fetch(`/api/admin/tenants/${id}/stores`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        setStores(j.stores || []);
      }
    } catch {
      // 失敗時は空のまま
    }
  }

  async function loadPlans() {
    try {
      const res = await fetch('/api/admin/plans', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        setPlans((j.plans || []).filter((p: PlanDef) => p.active));
      }
    } catch {
      // 失敗時は空のまま
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/tenants/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
        const j = await res.json();
        const t: Tenant = j.tenant;
        setTenant(t);
        setLiffId(t.liffId || '');
        setPlan(t.plan || '');
        setOwnerEmail(t.ownerEmail || '');
        setStatus(t.status || '');
        setLineChannelToken(t.lineChannelToken || '');
        setLineAutoSendEnabled(!!t.lineAutoSendEnabled);
        setAutoSendTime(t.autoSendTime || '06:00');
        setBillingMode(t.billingMode || '');
        setSeatLimit(t.seatLimit !== null && t.seatLimit !== undefined ? t.seatLimit : '');
        setPlanCode(t.planCode || '');
        const selectedPlanCode = t.planCode || 'standard';
        const foundPlan = plans.find((p) => p.planCode === selectedPlanCode);
        setApplyStripeSeats(t.seatLimit ?? foundPlan?.minSeats ?? 3);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoading(false);
      }
    })();
    loadStores();
    loadPlans();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    if (!tenant) return;
    setSaving(true);
    setError(null);
    try {
      const patchBody: Record<string, unknown> = {
        liffId: liffId || null,
        plan,
        ownerEmail,
        status,
        lineChannelToken: lineChannelToken || null,
        lineAutoSendEnabled,
        autoSendTime: autoSendTime || null,
        billingMode: billingMode || null,
        planCode: planCode || null,
      };
      if (billingMode === '手動') {
        patchBody.seatLimit = seatLimit !== '' ? Number(seatLimit) : null;
      }
      const res = await fetch(`/api/admin/tenants/${tenant.pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      toast.success('保存しました');
      // 再取得
      const refreshed = await fetch(`/api/admin/tenants/${id}`, { cache: 'no-store' }).then((r) => r.json());
      if (refreshed?.tenant) setTenant(refreshed.tenant);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function applyStripe() {
    if (!tenant) return;
    setApplyStripeLoading(true);
    setApplyStripeMsg(null);
    setError(null);
    const effectivePlanCode = planCode || 'standard';
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.pageId}/apply-stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats: applyStripeSeats, planCode: effectivePlanCode }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `${res.status}`);
      if (j.action === 'checkout' && j.url) {
        setApplyStripeMsg(`Checkout URL を発行しました。顧客に送付してください:\n${j.url}`);
        toast.success('Checkout URL を発行しました');
      } else if (j.action === 'updated') {
        setApplyStripeMsg('Stripe のサブスクリプションを更新しました');
        toast.success('Stripe を更新しました');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : 'Stripe 反映に失敗しました');
    } finally {
      setApplyStripeLoading(false);
    }
  }

  return (
    <AdminShell title={tenant?.name || 'テナント詳細'} back={{ href: '/admin/tenants' }}>
      {loading ? (
        <div className="text-center text-stone-500 py-10">読み込み中…</div>
      ) : !tenant ? (
        <div className="text-center text-stone-500 py-10">{error || 'テナントが見つかりません'}</div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
          )}

          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
              <h2 className="text-sm font-bold text-stone-900">基本情報</h2>
            </div>
            <Row label="ジム名" value={tenant.name} />
            <Row label="tenant_id" value={tenant.tenantId} mono />
            <Row label="契約開始日" value={tenant.startDate || '-'} />
            <div className="grid grid-cols-2 gap-2 mt-1">
              {tenant.customerDbId && (
                <a
                  href={`https://www.notion.so/${tenant.customerDbId.replace(/-/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-stone-700 border border-stone-300 px-3 py-2 rounded-xl hover:bg-stone-50 inline-flex items-center justify-center gap-1"
                >
                  顧客DB <ExternalLink className="w-3 h-3" strokeWidth={2.4} />
                </a>
              )}
              {tenant.foodDbId && (
                <a
                  href={`https://www.notion.so/${tenant.foodDbId.replace(/-/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-stone-700 border border-stone-300 px-3 py-2 rounded-xl hover:bg-stone-50 inline-flex items-center justify-center gap-1"
                >
                  食事DB <ExternalLink className="w-3 h-3" strokeWidth={2.4} />
                </a>
              )}
            </div>
          </section>

          {/* パスワード発行 */}
          <PasswordSection tenantPageId={tenant.pageId} ownerEmail={tenant.ownerEmail || ''} tenantName={tenant.name} />

          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-violet-600" strokeWidth={2.2} />
              LIFF ID
            </h2>
            <input
              type="text"
              value={liffId}
              onChange={(e) => setLiffId(e.target.value)}
              placeholder="例: 2007123456-AbcDeFgh"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="text-[11px] text-stone-600 bg-violet-50 border border-violet-200 rounded-xl p-2.5">
              ジムが LINE Developers コンソールで発行した LIFF ID。ジムから貰ったらここに入力。
              {liffId && (
                <div className="mt-1">
                  テスト用URL:{' '}
                  <a href={`https://liff.line.me/${liffId}`} target="_blank" rel="noopener noreferrer" className="text-violet-700 underline">
                    https://liff.line.me/{liffId}
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* 店舗管理 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                <StoreIcon className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                店舗（{stores.length}件）
              </h2>
              {!storeFormOpen && !editingStoreId && (
                <button
                  type="button"
                  onClick={() => setStoreFormOpen(true)}
                  className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full hover:bg-emerald-100 inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" strokeWidth={2.4} />
                  店舗追加
                </button>
              )}
            </div>

            {storeFormOpen && tenant && (
              <StoreForm
                tenantPageId={tenant.pageId}
                onCancel={() => setStoreFormOpen(false)}
                onSaved={() => {
                  setStoreFormOpen(false);
                  loadStores();
                }}
              />
            )}

            {stores.length === 0 && !storeFormOpen ? (
              <div className="text-[11px] text-stone-500 text-center py-3 bg-stone-50 rounded-xl border border-stone-200">
                店舗が登録されていません
              </div>
            ) : (
              <ul className="space-y-1.5">
                {stores.map((s) =>
                  editingStoreId === s.pageId ? (
                    <li key={s.pageId}>
                      <StoreForm
                        tenantPageId={tenant!.pageId}
                        initial={s}
                        onCancel={() => setEditingStoreId(null)}
                        onSaved={() => {
                          setEditingStoreId(null);
                          loadStores();
                        }}
                      />
                    </li>
                  ) : (
                    <li key={s.pageId} className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 flex items-start gap-2">
                      <StoreIcon className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-stone-900">{s.name}</span>
                          <span className="text-[10px] font-mono text-stone-500">[{s.storeId}]</span>
                        </div>
                        <div className="text-[11px] text-stone-600 mt-0.5 space-y-0.5">
                          {s.address && (
                            <div className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" strokeWidth={2.2} />
                              {s.address}
                            </div>
                          )}
                          {s.phone && (
                            <div className="inline-flex items-center gap-1 ml-2">
                              <Phone className="w-3 h-3" strokeWidth={2.2} />
                              {s.phone}
                            </div>
                          )}
                          {s.manager && (
                            <div className="inline-flex items-center gap-1 ml-2">
                              <User className="w-3 h-3" strokeWidth={2.2} />
                              {s.manager}
                            </div>
                          )}
                        </div>
                        {s.signature && (
                          <div className="text-[10px] text-stone-500 mt-0.5 italic truncate">署名: 「{s.signature}」</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingStoreId(s.pageId)}
                        className="text-stone-500 hover:text-stone-900 p-1 flex-shrink-0"
                        aria-label="編集"
                      >
                        <Edit className="w-3.5 h-3.5" strokeWidth={2.2} />
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}
          </section>

          {/* LINE Messaging API（push送信用） */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-green-600" strokeWidth={2.2} />
              LINE 配信設定
            </h2>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">Channel Access Token</label>
              <input
                type="text"
                value={lineChannelToken}
                onChange={(e) => setLineChannelToken(e.target.value)}
                placeholder="LINE Developers の「Messaging API設定」で発行した長期トークン"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="text-[10px] text-stone-500 mt-1 leading-relaxed">
                ジムの LINE 公式から顧客にレポートを push 送信するために必要。<br />
                <a
                  href="https://developers.line.biz/console/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 underline"
                >
                  LINE Developers Console
                </a>
                {' '}→ チャネル選択 →「Messaging API設定」タブ →「チャネルアクセストークン（長期）」発行
              </div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={lineAutoSendEnabled}
                  onChange={(e) => setLineAutoSendEnabled(e.target.checked)}
                  className="w-4 h-4 accent-green-500"
                />
                <span className="font-bold text-stone-900">前日レポートを自動送信する</span>
              </label>
              <div className="grid grid-cols-[auto,1fr] items-center gap-2 pl-6">
                <Clock className="w-3.5 h-3.5 text-stone-500" strokeWidth={2.2} />
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={autoSendTime}
                    onChange={(e) => setAutoSendTime(e.target.value)}
                    disabled={!lineAutoSendEnabled}
                    className="bg-white border border-stone-300 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  />
                  <span className="text-[10px] text-stone-500">JST に「メヲダス前日レポート」テンプレで全顧客へ送信</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              契約情報
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">プラン</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">—</option>
                  {PLANS.map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">契約状態</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">—</option>
                  {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-stone-600" strokeWidth={2.2} />
                オーナーメール
              </label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </section>

          {/* 課金モード・プラン・Stripe反映 */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              課金制御
            </h2>
            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">課金モード</label>
              <select
                value={billingMode}
                onChange={(e) => setBillingMode(e.target.value as typeof billingMode)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—（未設定）</option>
                {BILLING_MODES.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>
              <div className="text-[10px] text-stone-500 mt-1 space-y-0.5">
                <div>無制限: 利用可能アカウント数のゲートなし（社内テスト・デモ）</div>
                <div>手動: 下の利用可能アカウント数入力が真実（PoC・特例契約）</div>
                <div>Stripe連動: Stripe webhook が利用可能アカウント数を同期（通常有償）</div>
              </div>
            </div>

            {billingMode === '手動' && (
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">利用可能アカウント数（手動モード必須）</label>
                <input
                  type="number"
                  value={seatLimit}
                  onChange={(e) => setSeatLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  min={1}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="例: 10"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-stone-700 mb-1 block">プランコード</label>
              <select
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">—（未設定 = standard）</option>
                {plans.map((p) => (
                  <option key={p.planCode} value={p.planCode}>{p.name}（{p.planCode}）</option>
                ))}
              </select>
            </div>
          </section>

          {/* Stripe反映 */}
          {(billingMode === 'Stripe連動' || billingMode === '') && (
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" strokeWidth={2.2} />
                Stripe 反映
              </h2>
              <div className="text-[11px] text-stone-600 bg-amber-50 border border-amber-200 rounded-xl p-2.5 space-y-1">
                <div>未契約 → Checkout Session URL を発行して顧客に送付</div>
                <div>契約済み → Subscription を更新（プラン変更・利用可能アカウント数変更）</div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 mb-1 block">利用可能アカウント数</label>
                <input
                  type="number"
                  value={applyStripeSeats}
                  onChange={(e) => setApplyStripeSeats(Number(e.target.value))}
                  min={1}
                  className="w-full bg-white border border-stone-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              {applyStripeMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl whitespace-pre-wrap break-all">{applyStripeMsg}</div>
              )}
              <button
                type="button"
                onClick={applyStripe}
                disabled={applyStripeLoading}
                className="w-full bg-amber-500 text-white font-bold py-2.5 rounded-xl active:bg-amber-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
              >
                <Zap className="w-4 h-4" strokeWidth={2.2} />
                {applyStripeLoading ? '処理中…' : 'Stripe に反映'}
              </button>
              <div className="text-[10px] text-stone-500 text-center">
                ※ 先に「変更を保存」でプランコードを保存してから反映すると確実です
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" strokeWidth={2.2} />
            {saving ? '保存中…' : '変更を保存'}
          </button>

          <Link
            href={`/admin/tenants/${tenant.pageId}/edit-in-notion`}
            onClick={(e) => {
              e.preventDefault();
              window.open(`https://www.notion.so/${tenant.pageId.replace(/-/g, '')}`, '_blank');
            }}
            className="block text-center text-xs font-bold text-stone-600 hover:text-stone-900 py-2"
          >
            Notion で開いて編集 →
          </Link>
        </div>
      )}
    </AdminShell>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[7rem,1fr] gap-2 py-0.5 text-sm">
      <div className="text-stone-600">{label}</div>
      <div className={`text-stone-900 break-all ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</div>
    </div>
  );
}

function StoreForm({
  tenantPageId,
  initial,
  onCancel,
  onSaved,
}: {
  tenantPageId: string;
  initial?: Store;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name || '');
  const [storeId, setStoreId] = useState(initial?.storeId || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [manager, setManager] = useState(initial?.manager || '');
  const [signature, setSignature] = useState(initial?.signature || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name || !storeId) {
      setError('店舗名・店舗ID 必須');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = initial ? `/api/admin/stores/${initial.pageId}` : `/api/admin/tenants/${tenantPageId}/stores`;
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, storeId, address, phone, manager, signature }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `保存失敗（${res.status}）`);
      }
      toast.success(initial ? '保存しました' : '作成しました');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!initial) return;
    if (!confirm(`「${initial.name}」を削除しますか？`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/stores/${initial.pageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`削除失敗（${res.status}）`);
      toast.success('削除しました');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 space-y-2">
      <div className="text-[11px] font-bold text-emerald-700">{initial ? '店舗を編集' : '新規店舗'}</div>
      {error && <div className="bg-red-100 border border-red-300 text-red-800 text-[11px] p-1.5 rounded-lg">{error}</div>}
      <div className="grid grid-cols-2 gap-1.5">
        <SmallField label="店舗名（必須）" value={name} onChange={setName} />
        <SmallField label="店舗ID（必須・英数字）" value={storeId} onChange={setStoreId} mono />
      </div>
      <SmallField label="住所" value={address} onChange={setAddress} />
      <div className="grid grid-cols-2 gap-1.5">
        <SmallField label="電話番号" value={phone} onChange={setPhone} />
        <SmallField label="担当者" value={manager} onChange={setManager} />
      </div>
      <SmallField label="レポート署名" value={signature} onChange={setSignature} />
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 bg-emerald-600 text-white font-bold text-xs py-1.5 rounded-lg active:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
        >
          <Save className="w-3 h-3" strokeWidth={2.4} />
          {saving ? '保存中…' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-white border border-stone-300 text-stone-700 font-bold text-xs px-2.5 py-1.5 rounded-lg active:bg-stone-50"
        >
          <X className="w-3 h-3" strokeWidth={2.4} />
        </button>
        {initial && (
          <button
            type="button"
            onClick={archive}
            disabled={saving}
            className="bg-red-50 border border-red-200 text-red-700 font-bold text-xs px-2.5 py-1.5 rounded-lg active:bg-red-100"
            aria-label="削除"
          >
            <Trash2 className="w-3 h-3" strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}

function PasswordSection({
  tenantPageId,
  ownerEmail,
  tenantName,
}: {
  tenantPageId: string;
  ownerEmail: string;
  tenantName: string;
}) {
  const [mode, setMode] = useState<'idle' | 'confirm' | 'result'>('idle');
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [mailResult, setMailResult] = useState<{ sent: boolean; reason?: string; mailtoUrl?: string; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function doReset() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantPageId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', sendMail: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `保存失敗（${res.status}）`);
      // メール送信成功時は平文パスワードを表示しない（手動コピー不要）
      setGeneratedPassword(j.mail?.sent ? null : j.password);
      setMailResult(j.mail || null);
      setMode('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setSaving(false);
    }
  }

  function copyAll() {
    if (!generatedPassword) return;
    const text = `${tenantName} ログイン情報\n\nURL: https://app.fitmeal.jp/store/login\nメール: ${ownerEmail}\nパスワード: ${generatedPassword}\n※初回ログイン後、必ずパスワードを変更してください`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
        <Key className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
        ログインパスワード
      </h2>

      {!ownerEmail && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800">
          オーナーメールが未設定です。先に契約情報のメールを保存してください。
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-xl">{error}</div>
      )}

      {mode === 'idle' && ownerEmail && (
        <div className="space-y-2">
          <div className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200 rounded-xl p-2.5">
            <div className="font-bold">ログインID: <code className="text-stone-900">{ownerEmail}</code></div>
            <div className="mt-1 text-stone-600">
              テナント作成時に初期パスワードを自動発行＆メール送信済み。<br />
              ユーザーがパスワードを忘れた場合はリセットボタンで再発行できます（自動メール送信）。
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMode('confirm')}
            disabled={saving}
            className="w-full bg-amber-500 text-white font-bold text-xs py-2 rounded-xl active:bg-amber-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.4} />
            パスワードをリセット
          </button>
        </div>
      )}

      {mode === 'confirm' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
          <div className="text-[11px] font-bold text-amber-900">⚠️ 既存パスワードは無効になります</div>
          <div className="text-[11px] text-amber-800">
            新しいパスワードを自動生成し、{ownerEmail} にメール送信します。よろしいですか？
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doReset}
              disabled={saving}
              className="flex-1 bg-amber-600 text-white font-bold text-xs py-2 rounded-xl active:bg-amber-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} strokeWidth={2.4} />
              {saving ? 'リセット中…' : 'リセット実行'}
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              disabled={saving}
              className="bg-white border border-stone-300 text-stone-700 font-bold text-xs px-3 py-2 rounded-xl active:bg-stone-50"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}

      {mode === 'result' && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 space-y-2">
          <div className="text-[11px] font-bold text-emerald-800">✅ パスワード設定完了</div>

          {/* メール送信結果 */}
          {mailResult && (
            mailResult.sent ? (
              <div className="bg-white border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-800 inline-flex items-center gap-1">
                <Mail className="w-3 h-3" strokeWidth={2.4} />
                メール送信済み（→ {ownerEmail}）
              </div>
            ) : mailResult.reason === 'no_provider' && mailResult.mailtoUrl ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-800 space-y-1.5">
                <div className="inline-flex items-center gap-1 font-bold">
                  <Mail className="w-3 h-3" strokeWidth={2.4} />
                  メール自動送信は未設定（RESEND_API_KEY）
                </div>
                <div className="opacity-90">下記ボタンで標準メーラー起動 → そのまま送信できます</div>
                <a
                  href={mailResult.mailtoUrl}
                  className="block text-center bg-amber-600 text-white font-bold text-xs py-1.5 rounded-lg active:bg-amber-700"
                >
                  メーラーを開いて送信
                </a>
              </div>
            ) : mailResult.reason === 'error' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-[11px] text-red-700">
                メール送信失敗: {mailResult.error}
              </div>
            ) : null
          )}

          {generatedPassword && (
            <>
              <div className="text-[10px] text-emerald-700">⚠️ メール送信に失敗したため、下記を手動でジムオーナーに伝えてください。</div>
              <div className="bg-white border border-emerald-300 rounded-lg p-2 space-y-1 text-[11px]">
                <div><span className="text-stone-600">URL:</span> <code className="text-stone-900">https://app.fitmeal.jp/store/login</code></div>
                <div><span className="text-stone-600">メール:</span> <code className="text-stone-900">{ownerEmail}</code></div>
                <div><span className="text-stone-600">パスワード:</span> <code className="text-stone-900 font-mono font-bold">{generatedPassword}</code></div>
              </div>
              <button
                type="button"
                onClick={copyAll}
                className="w-full bg-emerald-600 text-white font-bold text-xs py-2 rounded-xl active:bg-emerald-700 inline-flex items-center justify-center gap-1"
              >
                {copied ? <><Check className="w-3.5 h-3.5" strokeWidth={2.4} /> コピーしました</> : <><Copy className="w-3.5 h-3.5" strokeWidth={2.4} /> 全部コピー</>}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => { setMode('idle'); setGeneratedPassword(null); setMailResult(null); }}
            className="w-full text-[11px] text-stone-600 hover:text-stone-900 py-1"
          >
            閉じる
          </button>
        </div>
      )}
    </section>
  );
}

function SmallField({
  label,
  value,
  onChange,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-[9px] font-bold text-stone-700 block mb-0.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}
