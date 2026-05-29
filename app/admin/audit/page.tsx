'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';
import AdminShell from '../AdminShell';

type AuditRow = {
  id: string;
  ts: string;
  action: string;
  outcome: string;
  actor_type: string;
  actor_id: string | null;
  tenant_id: string | null;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  env: string | null;
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbMissing, setDbMissing] = useState(false);

  const [filterAction, setFilterAction] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');
  const [filterEnv, setFilterEnv] = useState('production');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (filterAction) sp.set('action', filterAction);
      if (filterOutcome) sp.set('outcome', filterOutcome);
      sp.set('env', filterEnv);
      const res = await fetch(`/api/admin/audit-logs?${sp}`, { cache: 'no-store' });
      if (res.status === 403) {
        setError('この画面は master ロールのみ閲覧できます');
        return;
      }
      if (!res.ok) throw new Error(`取得失敗（${res.status}）`);
      const j = await res.json();
      if (j.error === 'db_not_connected') {
        setDbMissing(true);
        setRows([]);
        return;
      }
      setDbMissing(false);
      setRows(j.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー');
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterOutcome, filterEnv]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminShell title="監査ログ">
      <div className="space-y-4">
        {/* フィルタ */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[11px] text-stone-500 font-bold">アクション</label>
            <input
              type="text"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              placeholder="例: auth.login"
              className="text-xs border border-stone-300 rounded-lg px-2 py-1.5 w-full"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-[11px] text-stone-500 font-bold">結果</label>
            <select
              value={filterOutcome}
              onChange={(e) => setFilterOutcome(e.target.value)}
              className="text-xs border border-stone-300 rounded-lg px-2 py-1.5"
            >
              <option value="">すべて</option>
              <option value="success">success</option>
              <option value="failure">failure</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-[11px] text-stone-500 font-bold">環境</label>
            <select
              value={filterEnv}
              onChange={(e) => setFilterEnv(e.target.value)}
              className="text-xs border border-stone-300 rounded-lg px-2 py-1.5"
            >
              <option value="production">production</option>
              <option value="preview">preview</option>
              <option value="development">development</option>
            </select>
          </div>
          <button
            type="button"
            onClick={load}
            className="bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-600 active:bg-emerald-700"
          >
            絞り込む
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}

        {dbMissing && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm p-4 rounded-xl">
            DB未接続（DATABASE_URL が未設定です）
          </div>
        )}

        {loading ? (
          <div className="text-center text-stone-500 py-10">読み込み中…</div>
        ) : !dbMissing && rows.length === 0 ? (
          <div className="text-center text-stone-500 py-10 bg-white rounded-2xl border border-stone-200">
            該当ログなし
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-200 shadow-sm bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  {['日時', 'action', '結果', 'actorType', 'actorId', 'tenantId', 'target', 'IP', 'metadata'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-bold text-stone-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.id} className={r.outcome === 'failure' ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2 whitespace-nowrap text-stone-500 font-mono">
                      {new Date(r.ts).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-stone-800">{r.action}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded-full font-bold text-[10px] ${
                          r.outcome === 'success'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {r.outcome}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-stone-600">{r.actor_type}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-stone-600 max-w-[120px] truncate" title={r.actor_id ?? ''}>
                      {r.actor_id}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-stone-500 font-mono">{r.tenant_id}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-stone-500 font-mono max-w-[120px] truncate" title={`${r.target_type ?? ''}${r.target_id ? ':' + r.target_id : ''}`}>
                      {r.target_type}{r.target_id ? `:${r.target_id.slice(0, 8)}…` : ''}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-stone-500 font-mono">{r.ip}</td>
                    <td className="px-3 py-2 text-stone-500 font-mono max-w-[200px] truncate" title={r.metadata ? JSON.stringify(r.metadata) : ''}>
                      {r.metadata ? JSON.stringify(r.metadata) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-stone-400 text-right flex items-center justify-end gap-1">
          <ShieldCheck className="w-3 h-3" strokeWidth={2.2} />
          直近7日・最大100件（master のみ）
        </p>
      </div>
    </AdminShell>
  );
}
