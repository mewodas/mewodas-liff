// 日付（YYYY-MM-DD）ベースの日数計算ユーティリティ。
// 両端を UTC 0時として差を取るため、サーバーTZに依存せず日数がぶれない。
// 「今日」は JST 基準で算出する（cron が JST 運用のため）。

export function ymdToUtc(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function todayYmdJst(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** from(YYYY-MM-DD) → to(YYYY-MM-DD) の日数差。不正な入力は null。 */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number | null {
  const a = ymdToUtc(fromYmd);
  const b = ymdToUtc(toYmd);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}
