// メール送信ヘルパー
// - RESEND_API_KEY が設定されていれば Resend 経由で自動送信
// - 未設定なら sent: false で内容を返す → フロントで mailto: にフォールバック

export type EmailPayload = {
  to: string;
  subject: string;
  body: string; // プレーンテキスト
  fromName?: string;
};

export type EmailResult =
  | { sent: true; provider: 'resend' }
  | { sent: false; reason: 'no_provider'; body: string; subject: string }
  | { sent: false; reason: 'error'; error: string };

const DEFAULT_FROM_EMAIL =
  process.env.EMAIL_FROM || 'FitMeal <no-reply@fitmeal.jp>';
const DEFAULT_FROM_NAME = 'FitMeal';

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      sent: false,
      reason: 'no_provider',
      subject: payload.subject,
      body: payload.body,
    };
  }
  try {
    const fromHeader = payload.fromName
      ? `${payload.fromName} <${DEFAULT_FROM_EMAIL.match(/<(.+)>/)?.[1] || DEFAULT_FROM_EMAIL}>`
      : DEFAULT_FROM_EMAIL;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [payload.to],
        subject: payload.subject,
        text: payload.body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { sent: false, reason: 'error', error: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    return { sent: true, provider: 'resend' };
  } catch (e) {
    return { sent: false, reason: 'error', error: e instanceof Error ? e.message : 'unknown' };
  }
}

/** mailto: フォールバック用 URL を生成 */
export function buildMailtoUrl(payload: EmailPayload): string {
  const params = new URLSearchParams({
    subject: payload.subject,
    body: payload.body,
  });
  return `mailto:${encodeURIComponent(payload.to)}?${params.toString()}`;
}

/** ログイン情報案内メールのテンプレート */
export function loginInfoEmail(params: {
  tenantName: string;
  ownerEmail: string;
  password: string;
  loginUrl?: string;
}): EmailPayload {
  const loginUrl = params.loginUrl || 'https://app.fitmeal.jp/store/login';
  const body = [
    `${params.tenantName} 様`,
    '',
    'FitMeal 食事管理サービスのログイン情報をお送りします。',
    '',
    '【ログインURL】',
    loginUrl,
    '',
    '【メールアドレス】',
    params.ownerEmail,
    '',
    '【初期パスワード】',
    params.password,
    '',
    '※初回ログイン後、画面右上のアカウントメニューから必ずパスワードを変更してください。',
    '※スマートフォンでアクセスすると「ホーム画面に追加」でアプリのように使えます。',
    '',
    'ご不明な点があればこのメールに返信してお問い合わせください。',
    '',
    '--',
    'FitMeal',
  ].join('\n');
  return {
    to: params.ownerEmail,
    subject: `【FitMeal】${params.tenantName} のログイン情報`,
    body,
    fromName: 'FitMeal',
  };
}
