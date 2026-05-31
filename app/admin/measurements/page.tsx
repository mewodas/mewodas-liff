'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Scale,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  Plus,
  RefreshCw,
  Database,
  Camera,
  Sparkles,
} from 'lucide-react';
import AdminShell from '../AdminShell';
import { useAdminBase } from '@/lib/useAdminBase';
import { useToast } from '@/components/Toast';
import { compressImage } from '@/lib/imageCompress';

type Customer = { pageId: string; name: string; lineUserId: string; foodStatus: string | null; storeId: string | null };

type BodyCompLog = {
  id: string;
  lineUserId: string;
  customerName: string;
  measureDate: string;
  weightKg: number;
  bodyFatPct: number;
  muscleMassKg: number;
  bodyFatMassKg: number | null;
  bodyWaterPct: number | null;
  bmi: number | null;
  basalMetabolicKcal: number | null;
  visceralFatLevel: number | null;
  skeletalMuscleMassKg: number | null;
  rightArmMuscleKg: number | null;
  leftArmMuscleKg: number | null;
  rightLegMuscleKg: number | null;
  leftLegMuscleKg: number | null;
  trunkMuscleKg: number | null;
  device: string | null;
  memo: string;
  registeredBy: string;
  createdAt: string;
};

type Me = { role: 'master' | 'tenant_admin'; email: string };

const DEVICES = ['InBody', '体組成計', '体重計', 'その他'];

function jstToday(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function fmt(v: number | null, unit = ''): string {
  if (v === null) return '—';
  return `${v}${unit}`;
}

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

type FormState = {
  measureDate: string;
  weightKg: string;
  bodyFatPct: string;
  muscleMassKg: string;
  bodyFatMassKg: string;
  bodyWaterPct: string;
  bmi: string;
  basalMetabolicKcal: string;
  visceralFatLevel: string;
  skeletalMuscleMassKg: string;
  rightArmMuscleKg: string;
  leftArmMuscleKg: string;
  rightLegMuscleKg: string;
  leftLegMuscleKg: string;
  trunkMuscleKg: string;
  device: string;
  memo: string;
};

const EMPTY_FORM: FormState = {
  measureDate: jstToday(),
  weightKg: '',
  bodyFatPct: '',
  muscleMassKg: '',
  bodyFatMassKg: '',
  bodyWaterPct: '',
  bmi: '',
  basalMetabolicKcal: '',
  visceralFatLevel: '',
  skeletalMuscleMassKg: '',
  rightArmMuscleKg: '',
  leftArmMuscleKg: '',
  rightLegMuscleKg: '',
  leftLegMuscleKg: '',
  trunkMuscleKg: '',
  device: 'InBody',
  memo: '',
};

function logToForm(log: BodyCompLog): FormState {
  return {
    measureDate: log.measureDate,
    weightKg: log.weightKg === 0 ? '' : String(r1(log.weightKg)),
    bodyFatPct: log.bodyFatPct === 0 ? '' : String(r1(log.bodyFatPct)),
    muscleMassKg: log.muscleMassKg === 0 ? '' : String(r1(log.muscleMassKg)),
    bodyFatMassKg: log.bodyFatMassKg !== null ? String(r1(log.bodyFatMassKg)) : '',
    bodyWaterPct: log.bodyWaterPct !== null ? String(r1(log.bodyWaterPct)) : '',
    bmi: log.bmi !== null ? String(r1(log.bmi)) : '',
    basalMetabolicKcal: log.basalMetabolicKcal !== null ? String(log.basalMetabolicKcal) : '',
    visceralFatLevel: log.visceralFatLevel !== null ? String(log.visceralFatLevel) : '',
    skeletalMuscleMassKg: log.skeletalMuscleMassKg !== null ? String(r1(log.skeletalMuscleMassKg)) : '',
    rightArmMuscleKg: log.rightArmMuscleKg !== null ? String(r1(log.rightArmMuscleKg)) : '',
    leftArmMuscleKg: log.leftArmMuscleKg !== null ? String(r1(log.leftArmMuscleKg)) : '',
    rightLegMuscleKg: log.rightLegMuscleKg !== null ? String(r1(log.rightLegMuscleKg)) : '',
    leftLegMuscleKg: log.leftLegMuscleKg !== null ? String(r1(log.leftLegMuscleKg)) : '',
    trunkMuscleKg: log.trunkMuscleKg !== null ? String(r1(log.trunkMuscleKg)) : '',
    device: log.device || 'InBody',
    memo: log.memo || '',
  };
}

export default function MeasurementsPage() {
  const base = useAdminBase();
  const toast = useToast();

  const [me, setMe] = useState<Me | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [logs, setLogs] = useState<BodyCompLog[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBodyCompDb, setHasBodyCompDb] = useState<boolean | null>(null);
  const [provisioning, setProvisioning] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<BodyCompLog | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [expandExtra, setExpandExtra] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [detailLog, setDetailLog] = useState<BodyCompLog | null>(null);

  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [photos, setPhotos] = useState<{ dataUrl: string; base64: string; mimeType: string }[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setMe(j); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/customers', { cache: 'no-store' });
        if (!res.ok) throw new Error(`顧客取得失敗（${res.status}）`);
        const j = await res.json();
        setCustomers(j.customers || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'エラー');
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCustomer) {
      setLogs([]);
      setHasBodyCompDb(null);
      return;
    }
    fetchLogs(selectedCustomer.lineUserId);
  }, [selectedCustomer]);

  async function fetchLogs(lineUserId: string) {
    setLoadingLogs(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/body-composition?lineUserId=${encodeURIComponent(lineUserId)}`, { cache: 'no-store' });
      if (res.status === 500) {
        const j = await res.json().catch(() => null);
        const msg = j?.error || '';
        if (msg.includes('体組成DB ID 未設定') || msg.includes('未設定')) {
          setHasBodyCompDb(false);
          setLogs([]);
          return;
        }
        throw new Error(msg || `取得失敗（${res.status}）`);
      }
      if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
      const j = await res.json();
      setLogs(j.logs || []);
      setHasBodyCompDb(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
      setHasBodyCompDb(true);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function provisionDb() {
    setProvisioning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/body-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'provision-db' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `失敗（${res.status}）`);
      toast.success('体組成DBを作成しました');
      setHasBodyCompDb(true);
      if (selectedCustomer) fetchLogs(selectedCustomer.lineUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setProvisioning(false);
    }
  }

  async function addPhotos(files: File[]) {
    if (files.length === 0) return;
    setAnalyzing(true);
    try {
      const added: { dataUrl: string; base64: string; mimeType: string }[] = [];
      for (const file of files) {
        const compressed = await compressImage(file, 1280, 0.85);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressed);
        });
        added.push({ dataUrl, base64: dataUrl.split(',')[1], mimeType: compressed.type || 'image/jpeg' });
      }
      const allPhotos = [...photos, ...added];
      setPhotos(allPhotos);

      // 蓄積した全写真を1リクエストで解析（複数枚＝表裏/別項目を統合読み取り）
      const res = await fetch('/api/admin/body-composition/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: allPhotos.map((p) => ({ base64: p.base64, mimeType: p.mimeType })) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `解析失敗（${res.status}）`);

      const r = j.result as Record<string, number | string | null>;
      const filled = new Set<string>();
      const numFields: Array<[keyof FormState, number | null]> = [
        ['weightKg', r.weightKg as number | null],
        ['bodyFatPct', r.bodyFatPct as number | null],
        ['muscleMassKg', r.muscleMassKg as number | null],
        ['bodyFatMassKg', r.bodyFatMassKg as number | null],
        ['bodyWaterPct', r.bodyWaterPct as number | null],
        ['bmi', r.bmi as number | null],
        ['basalMetabolicKcal', r.basalMetabolicKcal as number | null],
        ['visceralFatLevel', r.visceralFatLevel as number | null],
        ['skeletalMuscleMassKg', r.skeletalMuscleMassKg as number | null],
        ['rightArmMuscleKg', r.rightArmMuscleKg as number | null],
        ['leftArmMuscleKg', r.leftArmMuscleKg as number | null],
        ['rightLegMuscleKg', r.rightLegMuscleKg as number | null],
        ['leftLegMuscleKg', r.leftLegMuscleKg as number | null],
        ['trunkMuscleKg', r.trunkMuscleKg as number | null],
      ];
      const updates: Partial<FormState> = {};
      for (const [key, val] of numFields) {
        if (val !== null) {
          updates[key] = String(Math.round(val * 10) / 10);
          filled.add(key);
        }
      }
      if (r.device && typeof r.device === 'string') {
        updates.device = r.device;
        filled.add('device');
      }
      if (filled.size === 0) {
        toast.error('数値を読み取れませんでした。画像を確認してください。');
      } else {
        setForm((prev) => ({ ...prev, ...updates }));
        setAiFields(filled);
        if (r.rightArmMuscleKg !== null || r.leftArmMuscleKg !== null || r.rightLegMuscleKg !== null || r.leftLegMuscleKg !== null || r.trunkMuscleKg !== null) {
          setExpandExtra(true);
        }
        toast.success(`${filled.size}項目を自動入力しました。内容を確認してください。`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '解析に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  }

  function openNewForm() {
    setEditingLog(null);
    setForm({ ...EMPTY_FORM, measureDate: jstToday() });
    setExpandExtra(false);
    setSaveError(null);
    setAiFields(new Set());
    setPhotos([]);
    setLightboxSrc(null);
    setShowForm(true);
  }

  function openEditForm(log: BodyCompLog) {
    setDetailLog(null);
    setEditingLog(log);
    setForm(logToForm(log));
    setExpandExtra(
      !!(log.rightArmMuscleKg || log.leftArmMuscleKg || log.rightLegMuscleKg || log.leftLegMuscleKg || log.trunkMuscleKg)
    );
    setSaveError(null);
    setAiFields(new Set());
    setPhotos([]);
    setLightboxSrc(null);
    setShowForm(true);
  }

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveForm() {
    if (!selectedCustomer) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        // 編集時は対象レコードIDを送り、元データを上書き（計測日を変えても複製しない）
        id: editingLog?.id,
        lineUserId: selectedCustomer.lineUserId,
        customerName: selectedCustomer.name,
        measureDate: form.measureDate,
        weightKg: form.weightKg,
        bodyFatPct: form.bodyFatPct,
        muscleMassKg: form.muscleMassKg,
        bodyFatMassKg: form.bodyFatMassKg,
        bodyWaterPct: form.bodyWaterPct,
        bmi: form.bmi,
        basalMetabolicKcal: form.basalMetabolicKcal,
        visceralFatLevel: form.visceralFatLevel,
        skeletalMuscleMassKg: form.skeletalMuscleMassKg,
        rightArmMuscleKg: form.rightArmMuscleKg,
        leftArmMuscleKg: form.leftArmMuscleKg,
        rightLegMuscleKg: form.rightLegMuscleKg,
        leftLegMuscleKg: form.leftLegMuscleKg,
        trunkMuscleKg: form.trunkMuscleKg,
        device: form.device,
        memo: form.memo,
        registeredBy: me?.email || '',
      };

      const res = await fetch('/api/admin/body-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `保存失敗（${res.status}）`);

      toast.success(editingLog ? '更新しました' : '保存しました');
      setShowForm(false);
      await fetchLogs(selectedCustomer.lineUserId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'エラー');
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id: string, dateLabel: string) {
    if (!confirm(`この計測記録を削除します。\n\n計測日: ${dateLabel}\n\n削除すると元に戻せません。よろしいですか？`)) return;
    try {
      const res = await fetch(`/api/admin/body-composition?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `削除失敗（${res.status}）`);
      toast.success('削除しました');
      setDetailLog(null);
      if (selectedCustomer) await fetchLogs(selectedCustomer.lineUserId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '削除に失敗しました');
    }
  }

  return (
    <AdminShell title="体組成計測記録">
      <div className="space-y-3">
        {/* 顧客選択 */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 space-y-2">
          <div className="text-xs font-bold text-stone-700">顧客を選択</div>
          {loadingCustomers ? (
            <div className="text-sm text-stone-500">顧客読み込み中…</div>
          ) : (
            <select
              value={selectedCustomer?.pageId || ''}
              onChange={(e) => {
                const c = customers.find((c) => c.pageId === e.target.value) || null;
                setSelectedCustomer(c);
                setShowForm(false);
                setDetailLog(null);
              }}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">顧客を選択してください</option>
              {customers.map((c) => (
                <option key={c.pageId} value={c.pageId}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </section>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">{error}</div>
        )}

        {/* 体組成DB未設定 */}
        {selectedCustomer && hasBodyCompDb === false && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-800">
              <Database className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} />
              <div className="text-sm font-bold">体組成計測記録DBが未設定です</div>
            </div>
            <div className="text-xs text-amber-700">このテナントに体組成計測記録DBが作成されていません。</div>
            {me?.role === 'master' && (
              <button
                type="button"
                onClick={provisionDb}
                disabled={provisioning}
                className="inline-flex items-center gap-1.5 bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {provisioning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={2.2} />
                    作成中…
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" strokeWidth={2.2} />
                    体組成DBを作成
                  </>
                )}
              </button>
            )}
            {me?.role !== 'master' && (
              <div className="text-xs text-amber-600">運営（master）がDBを作成する必要があります。</div>
            )}
          </section>
        )}

        {/* 顧客選択済み・DB OK */}
        {selectedCustomer && hasBodyCompDb === true && (
          <>
            {/* 新規追加ボタン */}
            {!showForm && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={openNewForm}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white font-bold text-sm px-4 py-2 rounded-xl active:bg-emerald-700"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.4} />
                  計測記録を追加
                </button>
              </div>
            )}

            {/* 入力フォーム */}
            {showForm && (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                    {editingLog ? '計測記録を編集' : '計測記録を追加'}
                    <span className="text-xs font-medium text-stone-500 ml-1">（{selectedCustomer.name}）</span>
                  </div>
                  <button type="button" onClick={() => setShowForm(false)} className="text-stone-500 p-1">
                    <X className="w-4 h-4" strokeWidth={2.2} />
                  </button>
                </div>

                {/* 写真から自動入力 */}
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-2">
                  <div className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" strokeWidth={2.2} />
                    写真から自動入力（AI）
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 0) await addPhotos(files);
                      e.target.value = '';
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={analyzing}
                      className="inline-flex items-center gap-1.5 bg-sky-600 text-white font-bold text-xs px-3 py-2 rounded-lg disabled:opacity-50"
                    >
                      {analyzing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={2.2} />
                          解析中…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" strokeWidth={2.2} />
                          {photos.length > 0 ? '写真を追加' : '体組成計の写真を選択（複数可）'}
                        </>
                      )}
                    </button>
                    {photos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setPhotos([]); setAiFields(new Set()); }}
                        className="text-sky-500 text-xs underline"
                      >
                        リセット
                      </button>
                    )}
                  </div>
                  {photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {photos.map((p, i) => (
                        <div key={i} className="relative group">
                          <button
                            type="button"
                            onClick={() => setLightboxSrc(p.dataUrl)}
                            className="block"
                            title="拡大表示"
                          >
                            <img
                              src={p.dataUrl}
                              alt={`体組成計の写真 ${i + 1}`}
                              className="w-20 h-20 object-cover rounded-lg border border-sky-200 bg-white cursor-zoom-in"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-stone-700 text-white flex items-center justify-center shadow"
                            aria-label="この写真を削除"
                          >
                            <X className="w-3 h-3" strokeWidth={2.6} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {aiFields.size > 0 && (
                    <div className="text-[11px] text-sky-700">
                      <span className="inline-flex items-center gap-0.5 bg-sky-100 border border-sky-300 rounded px-1.5 py-0.5 font-bold">
                        AI
                      </span>{' '}
                      バッジのフィールドはAIが読み取った値です。必ず確認・修正してから保存してください。
                    </div>
                  )}
                </div>

                {/* マスト入力 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[11px] font-bold text-stone-700 block mb-0.5">
                      計測日 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.measureDate}
                      onChange={(e) => setField('measureDate', e.target.value)}
                      className="w-full border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <FormNumField label="体重(kg)" required value={form.weightKg} onChange={(v) => setField('weightKg', v)} isAi={aiFields.has('weightKg')} />
                  <FormNumField label="体脂肪率(%)" required value={form.bodyFatPct} onChange={(v) => setField('bodyFatPct', v)} isAi={aiFields.has('bodyFatPct')} />
                  <FormNumField label="筋肉量(kg)" required value={form.muscleMassKg} onChange={(v) => setField('muscleMassKg', v)} isAi={aiFields.has('muscleMassKg')} />
                  <FormNumField label="体脂肪量(kg)" value={form.bodyFatMassKg} onChange={(v) => setField('bodyFatMassKg', v)} isAi={aiFields.has('bodyFatMassKg')} />
                  <FormNumField label="体水分率(%)" value={form.bodyWaterPct} onChange={(v) => setField('bodyWaterPct', v)} isAi={aiFields.has('bodyWaterPct')} />
                  <FormNumField label="BMI" value={form.bmi} onChange={(v) => setField('bmi', v)} isAi={aiFields.has('bmi')} />
                  <FormNumField label="基礎代謝(kcal)" value={form.basalMetabolicKcal} onChange={(v) => setField('basalMetabolicKcal', v)} isAi={aiFields.has('basalMetabolicKcal')} />
                  <FormNumField label="内臓脂肪レベル" value={form.visceralFatLevel} onChange={(v) => setField('visceralFatLevel', v)} isAi={aiFields.has('visceralFatLevel')} />
                  <FormNumField label="骨格筋量(kg)" value={form.skeletalMuscleMassKg} onChange={(v) => setField('skeletalMuscleMassKg', v)} isAi={aiFields.has('skeletalMuscleMassKg')} />
                </div>

                {/* 測定機器 */}
                <div>
                  <label className="text-[11px] font-bold text-stone-700 mb-0.5 flex items-center gap-1">
                    測定機器
                    {aiFields.has('device') && (
                      <span className="ml-auto text-[9px] font-bold bg-sky-100 border border-sky-300 text-sky-700 rounded px-1 leading-tight">
                        AI
                      </span>
                    )}
                  </label>
                  <select
                    value={form.device}
                    onChange={(e) => setField('device', e.target.value)}
                    className="w-full border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {DEVICES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* 部位別筋肉量 折りたたみ */}
                <button
                  type="button"
                  onClick={() => setExpandExtra((v) => !v)}
                  className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-800"
                >
                  {expandExtra ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.4} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.4} />}
                  部位別筋肉量（任意）
                </button>
                {expandExtra && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    <FormNumField label="右腕筋肉量(kg)" value={form.rightArmMuscleKg} onChange={(v) => setField('rightArmMuscleKg', v)} isAi={aiFields.has('rightArmMuscleKg')} />
                    <FormNumField label="左腕筋肉量(kg)" value={form.leftArmMuscleKg} onChange={(v) => setField('leftArmMuscleKg', v)} isAi={aiFields.has('leftArmMuscleKg')} />
                    <FormNumField label="右脚筋肉量(kg)" value={form.rightLegMuscleKg} onChange={(v) => setField('rightLegMuscleKg', v)} isAi={aiFields.has('rightLegMuscleKg')} />
                    <FormNumField label="左脚筋肉量(kg)" value={form.leftLegMuscleKg} onChange={(v) => setField('leftLegMuscleKg', v)} isAi={aiFields.has('leftLegMuscleKg')} />
                    <FormNumField label="体幹筋肉量(kg)" value={form.trunkMuscleKg} onChange={(v) => setField('trunkMuscleKg', v)} isAi={aiFields.has('trunkMuscleKg')} />
                  </div>
                )}

                {/* メモ */}
                <div>
                  <label className="text-[11px] font-bold text-stone-700 block mb-0.5">メモ</label>
                  <textarea
                    value={form.memo}
                    onChange={(e) => setField('memo', e.target.value)}
                    rows={2}
                    className="w-full border border-stone-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    placeholder="任意メモ"
                  />
                </div>

                {saveError && (
                  <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-2 rounded-lg">{saveError}</div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveForm}
                    disabled={saving}
                    className="flex-1 bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                        保存中…
                      </>
                    ) : '保存する'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 border border-stone-300 text-stone-700 font-bold text-sm rounded-xl"
                  >
                    キャンセル
                  </button>
                </div>
              </section>
            )}

            {/* 履歴テーブル */}
            {loadingLogs ? (
              <div className="text-center text-stone-500 py-8 text-sm">読み込み中…</div>
            ) : logs.length === 0 ? (
              <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200 text-sm">
                計測記録がありません
              </div>
            ) : (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                    計測履歴
                  </h3>
                  <span className="text-[11px] text-stone-500">{logs.length}件</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-stone-100 text-stone-500">
                        <th className="px-3 py-2 text-left font-bold">計測日</th>
                        <th className="px-3 py-2 text-right font-bold">体重(kg)</th>
                        <th className="px-3 py-2 text-right font-bold">体脂肪率(%)</th>
                        <th className="px-3 py-2 text-right font-bold">筋肉量(kg)</th>
                        <th className="px-3 py-2 text-right font-bold">BMI</th>
                        <th className="px-3 py-2 text-left font-bold">機器</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {logs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-stone-50 cursor-pointer active:bg-stone-100"
                          onClick={() => setDetailLog(log)}
                        >
                          <td className="px-3 py-2.5 font-bold text-stone-900">{log.measureDate}</td>
                          <td className="px-3 py-2.5 text-right text-stone-800">{fmt(r1(log.weightKg), 'kg')}</td>
                          <td className="px-3 py-2.5 text-right text-stone-800">{fmt(r1(log.bodyFatPct), '%')}</td>
                          <td className="px-3 py-2.5 text-right text-stone-800">{fmt(r1(log.muscleMassKg), 'kg')}</td>
                          <td className="px-3 py-2.5 text-right text-stone-800">{fmt(log.bmi !== null ? r1(log.bmi) : null)}</td>
                          <td className="px-3 py-2.5 text-stone-500">{log.device || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {/* 詳細モーダル */}
        {detailLog && (
          <DetailModal
            log={detailLog}
            onClose={() => setDetailLog(null)}
            onEdit={() => openEditForm(detailLog)}
            onDelete={() => doDelete(detailLog.id, detailLog.measureDate)}
            base={base}
          />
        )}

        {/* 写真拡大ライトボックス */}
        {lightboxSrc && (
          <div
            className="fixed inset-0 bg-black/80 z-[90] flex items-center justify-center p-4"
            onClick={() => setLightboxSrc(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" strokeWidth={2.4} />
            </button>
            <img
              src={lightboxSrc}
              alt="体組成計の写真（拡大）"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function FormNumField({
  label,
  required,
  value,
  onChange,
  isAi,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  isAi?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-stone-700 block mb-0.5 flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
        {isAi && (
          <span className="ml-auto text-[9px] font-bold bg-sky-100 border border-sky-300 text-sky-700 rounded px-1 leading-tight">
            AI
          </span>
        )}
      </label>
      <input
        type="number"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={`w-full border rounded-xl p-2 text-sm focus:outline-none focus:ring-2 ${
          isAi
            ? 'border-sky-400 bg-sky-50 focus:ring-sky-400'
            : 'border-stone-300 focus:ring-emerald-500'
        }`}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (value === '—') return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-stone-100 last:border-0 text-sm">
      <span className="text-stone-500 text-xs">{label}</span>
      <span className="font-bold text-stone-900">{value}</span>
    </div>
  );
}

function DetailModal({
  log,
  onClose,
  onEdit,
  onDelete,
  base: _base,
}: {
  log: BodyCompLog;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  base: string;
}) {
  function fmt(v: number | null, unit = ''): string {
    if (v === null) return '—';
    return `${Math.round(v * 10) / 10}${unit}`;
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center px-4 py-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900 inline-flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
            {log.customerName} ・ {log.measureDate}
          </h2>
          <button type="button" onClick={onClose} className="text-stone-500 p-1">
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {/* 主要値 */}
          <div className="grid grid-cols-3 gap-2">
            <KeyMetric label="体重" value={fmt(log.weightKg, 'kg')} />
            <KeyMetric label="体脂肪率" value={fmt(log.bodyFatPct, '%')} />
            <KeyMetric label="筋肉量" value={fmt(log.muscleMassKg, 'kg')} />
          </div>

          {/* 詳細 */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-0.5">
            <DetailRow label="体脂肪量(kg)" value={fmt(log.bodyFatMassKg, 'kg')} />
            <DetailRow label="体水分率(%)" value={fmt(log.bodyWaterPct, '%')} />
            <DetailRow label="BMI" value={fmt(log.bmi)} />
            <DetailRow label="基礎代謝(kcal)" value={fmt(log.basalMetabolicKcal, 'kcal')} />
            <DetailRow label="内臓脂肪レベル" value={fmt(log.visceralFatLevel)} />
            <DetailRow label="骨格筋量(kg)" value={fmt(log.skeletalMuscleMassKg, 'kg')} />
            <DetailRow label="右腕筋肉量(kg)" value={fmt(log.rightArmMuscleKg, 'kg')} />
            <DetailRow label="左腕筋肉量(kg)" value={fmt(log.leftArmMuscleKg, 'kg')} />
            <DetailRow label="右脚筋肉量(kg)" value={fmt(log.rightLegMuscleKg, 'kg')} />
            <DetailRow label="左脚筋肉量(kg)" value={fmt(log.leftLegMuscleKg, 'kg')} />
            <DetailRow label="体幹筋肉量(kg)" value={fmt(log.trunkMuscleKg, 'kg')} />
          </div>

          {log.device && (
            <div className="text-xs text-stone-500">測定機器: {log.device}</div>
          )}
          {log.memo && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs text-stone-800 whitespace-pre-wrap break-words">{log.memo}</div>
          )}
          {log.registeredBy && (
            <div className="text-xs text-stone-400">登録者: {log.registeredBy}</div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs py-2.5 rounded-xl"
            >
              編集する
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs px-3 py-2.5 rounded-xl"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
              削除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
      <div className="text-[10px] font-bold text-emerald-700">{label}</div>
      <div className="text-base font-bold text-emerald-900 mt-0.5">{value}</div>
    </div>
  );
}
