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

/** パスワード再設定リンクメール */
export function resetLinkEmail(params: {
  tenantName: string;
  ownerEmail: string;
  resetUrl: string;
}): EmailPayload {
  const body = [
    `${params.tenantName} 様`,
    '',
    'FitMeal のパスワード再設定リクエストを受け付けました。',
    '',
    '下記URLから1時間以内に新しいパスワードを設定してください。',
    '',
    params.resetUrl,
    '',
    '※リンクの有効期限は1時間です。期限を過ぎた場合は再度パスワード再設定をリクエストしてください。',
    '※心当たりがない場合はこのメールを無視してください。',
    '',
    '--',
    'FitMeal',
  ].join('\n');
  return {
    to: params.ownerEmail,
    subject: `【FitMeal】パスワード再設定のご案内`,
    body,
    fromName: 'FitMeal',
  };
}

/** パスワード変更完了通知 */
export function resetCompletedEmail(params: {
  tenantName: string;
  ownerEmail: string;
  loginUrl?: string;
}): EmailPayload {
  const loginUrl = params.loginUrl || 'https://app.fitmeal.jp/store/login';
  const body = [
    `${params.tenantName} 様`,
    '',
    'FitMeal のパスワードが正常に変更されました。',
    '',
    '【ログインURL】',
    loginUrl,
    '',
    '※もし心当たりがない場合は、すぐにこちらのメールに返信してご連絡ください。',
    '',
    '--',
    'FitMeal',
  ].join('\n');
  return {
    to: params.ownerEmail,
    subject: `【FitMeal】パスワード変更完了のお知らせ`,
    body,
    fromName: 'FitMeal',
  };
}

/**
 * セルフサーブ申込からのウェルカム＋ログイン情報メール。
 * trialEndDate を渡すとトライアル終了日を本文に含める。
 */
export function welcomeEmail(params: {
  tenantName: string;
  ownerEmail: string;
  password: string;
  trialEndDate?: string;
  loginUrl?: string;
  lineGuideUrl?: string;
}): EmailPayload {
  const loginUrl = params.loginUrl || 'https://app.fitmeal.jp/store/login';
  const lineGuideUrl = params.lineGuideUrl || 'https://help.fitmeal.jp/onboarding.html';
  const trialLine = params.trialEndDate
    ? `\n【無料トライアル期間】\n本日から ${params.trialEndDate} までは¥0（カード登録のみ・期間中解約で課金ゼロ）\n`
    : '';
  const body = [
    `${params.tenantName} 様`,
    '',
    'FitMeal にお申し込みいただきありがとうございます。',
    'アカウントを発行しましたので、下記からログインしてご利用を開始してください。',
    '',
    '【ログインURL】',
    loginUrl,
    '',
    '【メールアドレス】',
    params.ownerEmail,
    '',
    '【初期パスワード】',
    params.password,
    trialLine,
    '【次の15分でやること: LINE連携】',
    'FitMeal は LINE 公式アカウント + LIFF を経由して会員様が食事を記録します。',
    '以下のガイドに沿って、ジム様の LINE 連携をセットアップしてください。',
    lineGuideUrl,
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
    subject: `【FitMeal】${params.tenantName} 様、ご登録ありがとうございます`,
    body,
    fromName: 'FitMeal',
  };
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

/** 無料トライアル終了前リマインド（終了4日前 / 前日に送信） */
export function trialEndingEmail(params: {
  tenantName: string;
  ownerEmail: string;
  daysLeft: number;
  chargeDate: string; // YYYY-MM-DD（初回請求日）
  monthlyPrice?: number | null;
  billingUrl?: string;
}): EmailPayload {
  const billingUrl = params.billingUrl || 'https://app.fitmeal.jp/store/billing';
  const priceLine = params.monthlyPrice
    ? `【初回請求額（目安）】 ¥${params.monthlyPrice.toLocaleString()}\n`
    : '';
  const body = [
    `${params.tenantName} 様`,
    '',
    `FitMeal の無料トライアルが あと ${params.daysLeft} 日 で終了します。`,
    '',
    `【初回請求日】 ${params.chargeDate}`,
    priceLine,
    'カードはご登録済みです。期間終了後は自動で本契約に移行し、上記の日付で初回のお支払いが発生します。',
    '継続される場合、お手続きは不要です。',
    '',
    '解約・カード変更は下記からいつでも行えます（期間中の解約はお支払いゼロです）。',
    billingUrl,
    '',
    'ご不明な点があればこのメールに返信してお問い合わせください。',
    '',
    '--',
    'FitMeal',
  ].join('\n');
  return {
    to: params.ownerEmail,
    subject: `【FitMeal】無料トライアルがあと${params.daysLeft}日で終了します`,
    body,
    fromName: 'FitMeal',
  };
}

/** 支払い失敗（past_due）通知。カード更新を促す */
export function paymentFailedEmail(params: {
  tenantName: string;
  ownerEmail: string;
  billingUrl?: string;
}): EmailPayload {
  const billingUrl = params.billingUrl || 'https://app.fitmeal.jp/store/billing';
  const body = [
    `${params.tenantName} 様`,
    '',
    'FitMeal 月額利用料のお支払いが確認できませんでした。',
    'カードの有効期限切れ・残高不足などが考えられます。',
    '',
    '下記からカード情報をご更新ください。更新後は自動で再請求されます。',
    billingUrl,
    '',
    '※お支払いが確認できない状態が続くと、サービスのご利用が停止される場合があります。',
    '',
    'ご不明な点があればこのメールに返信してお問い合わせください。',
    '',
    '--',
    'FitMeal',
  ].join('\n');
  return {
    to: params.ownerEmail,
    subject: `【FitMeal】お支払いの確認ができませんでした（カード更新のお願い）`,
    body,
    fromName: 'FitMeal',
  };
}

/** オンボーディング未完了の催促（登録から数日経っても LINE 連携が終わっていない店舗へ） */
export function onboardingNudgeEmail(params: {
  tenantName: string;
  ownerEmail: string;
  startUrl?: string;
}): EmailPayload {
  const startUrl = params.startUrl || 'https://app.fitmeal.jp/store/start';
  const body = [
    `${params.tenantName} 様`,
    '',
    'FitMeal のセットアップがまだ完了していないようです。',
    'LINE 公式アカウントとの連携が終わると、お客様がアプリで食事を記録できるようになります。',
    '',
    '下記のスタートガイドから、残りのステップ（LINE連携 → お客様の招待）を進めてください。所要 10〜15 分です。',
    startUrl,
    '',
    'セットアップでお困りの場合は、このメールに返信いただければサポートします。',
    '',
    '--',
    'FitMeal',
  ].join('\n');
  return {
    to: params.ownerEmail,
    subject: `【FitMeal】セットアップを完了して、お客様の利用を始めましょう`,
    body,
    fromName: 'FitMeal',
  };
}
