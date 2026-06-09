export type RangeType = '昨日' | '今日' | '先週' | '今週' | '先月' | '今月' | 'カスタム';

function jstToday(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mmdd(d: Date): string {
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
}

// 直前の同期間（前週/前月相当）を返す。startDate の前日を終端とし、
// 同じ日数ぶん遡った範囲。週次レポートの「前週平均」算出に使用。
export function previousPeriod(
  startDate: string,
  endDate: string
): { startDate: string; endDate: string } {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (spanDays - 1));
  return { startDate: fmt(prevStart), endDate: fmt(prevEnd) };
}

export function resolveDateRange(
  rangeType: RangeType | undefined,
  fallback?: { startDate: string; endDate: string }
): { startDate: string; endDate: string; rangeLabel: string } {
  const today = jstToday();

  if (!rangeType || rangeType === 'カスタム') {
    if (fallback) {
      const label =
        fallback.startDate === fallback.endDate
          ? fallback.startDate
          : `${fallback.startDate}〜${fallback.endDate}`;
      return { ...fallback, rangeLabel: label };
    }
    const todayStr = fmt(today);
    return { startDate: todayStr, endDate: todayStr, rangeLabel: todayStr };
  }

  if (rangeType === '今日') {
    const s = fmt(today);
    return { startDate: s, endDate: s, rangeLabel: '今日' };
  }

  if (rangeType === '昨日') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const s = fmt(yesterday);
    return { startDate: s, endDate: s, rangeLabel: '昨日' };
  }

  if (rangeType === '今週') {
    const dow = today.getDay(); // 0=日
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dow === 0 ? 7 : dow) - 1));
    const startStr = fmt(monday);
    const endStr = fmt(today);
    return {
      startDate: startStr,
      endDate: endStr,
      rangeLabel: `今週（${mmdd(monday)}〜${mmdd(today)}）`,
    };
  }

  if (rangeType === '先週') {
    const dow = today.getDay();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - ((dow === 0 ? 7 : dow) - 1) - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    const startStr = fmt(lastMonday);
    const endStr = fmt(lastSunday);
    return {
      startDate: startStr,
      endDate: endStr,
      rangeLabel: `先週（${mmdd(lastMonday)}〜${mmdd(lastSunday)}）`,
    };
  }

  if (rangeType === '今月') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const startStr = fmt(firstDay);
    const endStr = fmt(today);
    return {
      startDate: startStr,
      endDate: endStr,
      rangeLabel: `今月（${mmdd(firstDay)}〜${mmdd(today)}）`,
    };
  }

  if (rangeType === '先月') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    const startStr = fmt(firstDay);
    const endStr = fmt(lastDay);
    return {
      startDate: startStr,
      endDate: endStr,
      rangeLabel: `先月（${mmdd(firstDay)}〜${mmdd(lastDay)}）`,
    };
  }

  const s = fmt(today);
  return { startDate: s, endDate: s, rangeLabel: s };
}
