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

export function closeLiff() {
  if (liff.isInClient()) {
    liff.closeWindow();
  }
}
