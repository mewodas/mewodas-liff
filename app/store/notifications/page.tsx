'use client';

import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import AdminShell from '@/app/admin/AdminShell';
import { useToast } from '@/components/Toast';

export default function StoreNotificationsPage() {
  const toast = useToast();
  const [riskAlertEnabled, setRiskAlertEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/tenant-settings', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        setRiskAlertEnabled(!!j.riskAlertEnabled);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleToggle() {
    const next = !riskAlertEnabled;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/tenant-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskAlertEnabled: next }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setRiskAlertEnabled(next);
      toast.success(next ? '顧客リスクお知らせを有効にしました' : '顧客リスクお知らせを無効にしました');
    } catch {
      toast.error('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="通知設定">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <BellRing className="w-5 h-5 text-violet-500" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-stone-900 mb-1">顧客リスクお知らせを受け取る</div>
              <div className="text-xs text-stone-500 leading-relaxed">
                ONにすると、食事記録や体重記録が途絶えている顧客・体重が停滞している顧客の一覧が、毎日の受信お知らせに届きます（該当者なしの日はお知らせは届きません）。
              </div>
            </div>
            {loading ? (
              <Loader2 className="w-5 h-5 text-stone-400 animate-spin flex-shrink-0 mt-0.5" strokeWidth={2.2} />
            ) : (
              <button
                type="button"
                onClick={handleToggle}
                disabled={saving}
                aria-label={riskAlertEnabled ? '顧客リスクお知らせをOFFにする' : '顧客リスクお知らせをONにする'}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                  riskAlertEnabled ? 'bg-violet-600 border-violet-600' : 'bg-stone-200 border-stone-200'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    riskAlertEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`}
                />
              </button>
            )}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800 leading-relaxed">
          お知らせは毎日の定期配信と同時に送られます。<br />
          受信したお知らせは「お知らせ」画面の受信トレイで確認できます。
        </div>
      </div>
    </AdminShell>
  );
}
