import liff, { type Liff } from '@line/liff';

let initialized = false;

export async function initLiff(): Promise<Liff> {
  if (!initialized) {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) throw new Error('NEXT_PUBLIC_LIFF_ID is not set');
    await liff.init({ liffId });
    initialized = true;
  }
  return liff;
}

export async function getLineUserId(): Promise<string | null> {
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }
  const profile = await liff.getProfile();
  return profile.userId;
}

export async function getLineProfile() {
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }
  return liff.getProfile();
}

export async function closeLiff(): Promise<void> {
  // 初期化前に呼ばれる可能性に備えてinitLiffを保証
  try {
    await initLiff();
  } catch (e) {
    console.error('LIFF init失敗（closeLiff時）:', e);
  }

  // LIFFブラウザ（LINE内）の場合
  try {
    if (typeof liff.isInClient === 'function' && liff.isInClient()) {
      liff.closeWindow();
      return;
    }
  } catch (e) {
    console.error('liff.closeWindow失敗:', e);
  }

  // 外部ブラウザ用フォールバック
  if (typeof window !== 'undefined') {
    try {
      window.close();
    } catch {
      /* ignore */
    }
    // window.closeが効かない場合は履歴を戻す
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && !window.closed) {
          window.history.back();
        }
      } catch {
        /* ignore */
      }
    }, 200);
  }
}
