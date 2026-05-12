// Drive保存をGAS経由で非同期実行（waitUntil用）
// Notionページ作成後にこの関数を呼び、Drive保存→Notionに画像URL追記する

export async function saveImagesToDriveAsync(params: {
  notionPageId: string;
  customerName: string;
  lineUserId: string;
  photos: Array<{ base64: string; mimeType: string }>;
}): Promise<void> {
  const endpoint = process.env.GAS_RECORD_ENDPOINT;
  if (!endpoint) {
    console.warn('GAS_RECORD_ENDPOINT 未設定のためDrive保存をスキップ');
    return;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        type: 'liff_save_images_async',
        notionPageId: params.notionPageId,
        customerName: params.customerName,
        lineUserId: params.lineUserId,
        photos: params.photos,
      }),
    });
    if (!res.ok) {
      console.error(
        'Drive保存(GAS)エラー:',
        res.status,
        (await res.text()).slice(0, 300)
      );
    }
  } catch (e) {
    console.error('Drive保存(GAS)失敗:', e);
  }
}
