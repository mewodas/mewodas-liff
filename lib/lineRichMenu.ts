// LINE Messaging API リッチメニューラッパー
// POST /v2/bot/richmenu → 作成
// POST /v2/bot/richmenu/{id}/content → 画像アップロード
// POST /v2/bot/user/all/richmenu/{id} → 既定設定

import * as fs from 'fs';
import * as path from 'path';

const LINE_API = 'https://api.line.me/v2/bot';
const LINE_DATA_API = 'https://api-data.line.me/v2/bot';

async function lineRequest(
  method: string,
  base: string,
  endpoint: string,
  channelToken: string,
  body?: object | Uint8Array,
  contentType?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${channelToken}`,
  };
  let fetchBody: BodyInit | undefined;
  if (body instanceof Uint8Array) {
    headers['Content-Type'] = contentType ?? 'image/png';
    // Uint8Array.buffer は SharedArrayBuffer になりうるので slice() で ArrayBuffer を確保
    fetchBody = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }
  return fetch(`${base}${endpoint}`, { method, headers, body: fetchBody });
}

export type RichMenuButtonLabels = {
  open?: string;
  register?: string;
};

export async function createRichMenu(
  channelToken: string,
  opts: {
    liffId: string;
    tenantId: string;
    gymName: string;
    buttonLabels?: RichMenuButtonLabels;
  }
): Promise<string> {
  const openLabel = opts.buttonLabels?.open ?? 'アプリを開く';
  const registerLabel = opts.buttonLabels?.register ?? '新規登録';
  const openUrl = `https://liff.line.me/${opts.liffId}?tenantId=${opts.tenantId}`;
  const registerUrl = `https://liff.line.me/${opts.liffId}/register?tenantId=${opts.tenantId}`;

  const richMenuBody = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: `FitMeal - ${opts.gymName}`,
    chatBarText: 'メニュー',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 1686 },
        action: { type: 'uri', label: openLabel, uri: openUrl },
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
        action: { type: 'uri', label: registerLabel, uri: registerUrl },
      },
    ],
  };

  const createRes = await lineRequest('POST', LINE_API, '/richmenu', channelToken, richMenuBody);
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`リッチメニュー作成失敗 ${createRes.status}: ${text.slice(0, 300)}`);
  }
  const { richMenuId } = (await createRes.json()) as { richMenuId: string };

  const imagePath = path.join(process.cwd(), 'public', 'richmenu-default.png');
  const imageBuffer: Uint8Array = fs.readFileSync(imagePath);

  const uploadRes = await lineRequest(
    'POST',
    LINE_DATA_API,
    `/richmenu/${richMenuId}/content`,
    channelToken,
    imageBuffer,
    'image/png'
  );
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    await deleteRichMenu(channelToken, richMenuId).catch(() => {});
    throw new Error(`リッチメニュー画像アップロード失敗 ${uploadRes.status}: ${text.slice(0, 300)}`);
  }

  const setDefaultRes = await lineRequest(
    'POST',
    LINE_API,
    `/user/all/richmenu/${richMenuId}`,
    channelToken
  );
  if (!setDefaultRes.ok) {
    const text = await setDefaultRes.text();
    throw new Error(`リッチメニュー既定設定失敗 ${setDefaultRes.status}: ${text.slice(0, 300)}`);
  }

  return richMenuId;
}

export async function deleteRichMenu(channelToken: string, richMenuId: string): Promise<void> {
  const res = await lineRequest('DELETE', LINE_API, `/richmenu/${richMenuId}`, channelToken);
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`リッチメニュー削除失敗 ${res.status}: ${text.slice(0, 300)}`);
  }
}
