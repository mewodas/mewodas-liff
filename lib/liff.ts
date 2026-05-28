import liff, { type Liff } from '@line/liff';
import { isDemoMode } from './demoClient';

let initialized = false;
let currentLiffId: string | null = null;

export async function initLiff(overrideLiffId?: string): Promise<Liff> {
  // デモモード時は LIFF SDK を初期化しない（LINE ログイン不要）
  if (isDemoMode()) return liff;
  const liffId = overrideLiffId ?? process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) throw new Error('NEXT_PUBLIC_LIFF_ID is not set');
  if (initialized && currentLiffId === liffId) return liff;
  if (initialized && currentLiffId !== liffId) {
    initialized = false;
  }
  await liff.init({ liffId });
  initialized = true;
  currentLiffId = liffId;
  return liff;
}

export async function refreshLiff(): Promise<void> {
  initialized = false;
  await initLiff();
}

export async function getLineUserId(): Promise<string | null> {
  if (isDemoMode()) return 'DEMO';
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }
  const profile = await liff.getProfile();
  return profile.userId;
}

export async function getLineProfile() {
  if (isDemoMode()) return { userId: 'DEMO', displayName: 'デモユーザー', pictureUrl: undefined, statusMessage: undefined };
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }
  return liff.getProfile();
}

export async function getIdToken(): Promise<string | null> {
  if (isDemoMode()) return null;
  await initLiff();
  return liff.getIDToken();
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
