'use client';

import { useEffect, useState } from 'react';
import { BellRing, Bell, Loader2 } from 'lucide-react';
import AdminShell from '@/app/admin/AdminShell';
import { useToast } from '@/components/Toast';

type RiskKey = 'riskMeal' | 'riskWeight' | 'riskWeightGoal';

const RISK_ITEMS: { key: RiskKey; label: string }[] = [
  { key: 'riskMeal', label: '食事記録の漏れ' },
  { key: 'riskWeight', label: '体重記録の漏れ' },
  { key: 'riskWeightGoal', label: '体重目標の停滞' },
];

export default function StoreNotificationsPage() {
  const toast = useToast();
  const [flags, setFlags] = useState<Record<RiskKey, boolean>>({
    riskMeal: false,
    riskWeight: false,
    riskWeightGoal: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<RiskKey | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/tenant-settings', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        setFlags({
          riskMeal: !!j.riskMeal,
          riskWeight: !!j.riskWeight,
          riskWeightGoal: !!j.riskWeightGoal,
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleToggle(key: RiskKey) {
    const next = !flags[key];
    setFlags((prev) => ({ ...prev, [key]: next }));
    setSaving(key);
    try {
      const res = await fetch('/api/admin/tenant-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success(next ? 'お知らせをONにしました' : 'お知らせをOFFにしました');
    } catch {
      setFlags((prev) => ({ ...prev, [key]: !next }));
      toast.error('保存に失敗しました');
    } finally {
      setSaving(null);
    }
  }

  return (
    <AdminShell title="通知設定">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800 leading-relaxed">
          お知らせは毎日の定期配信と同時に送られます。<br />
          受信したお知らせは画面右上のベルマーク
          <Bell className="inline-block w-3.5 h-3.5 mx-0.5 -mt-0.5" strokeWidth={2.2} aria-hidden />
          から確認できます。
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-emerald-500" strokeWidth={2.2} />
            <span className="font-bold text-sm text-stone-900">顧客リスクお知らせを受け取る</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-5 h-5 text-stone-400 animate-spin" strokeWidth={2.2} />
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {RISK_ITEMS.map((item) => {
                const isOn = flags[item.key];
                const isSaving = saving === item.key;
                return (
                  <div key={item.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0 text-sm font-medium text-stone-800">{item.label}</div>
                    <button
                      type="button"
                      onClick={() => handleToggle(item.key)}
                      disabled={isSaving}
                      aria-label={isOn ? `${item.label}をOFFにする` : `${item.label}をONにする`}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                        isOn ? 'bg-emerald-600 border-emerald-600' : 'bg-stone-200 border-stone-200'
                      } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                          isOn ? 'translate-x-5' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
