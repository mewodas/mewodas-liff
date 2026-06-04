// Slack 通知（任意）。
// SLACK_WEBHOOK_URL（Incoming Webhook URL）が設定されていれば POST する。
// 未設定なら no-op。失敗しても呼び出し元を壊さない（必ず boolean を返す）。
export async function notifySlack(text: string): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
