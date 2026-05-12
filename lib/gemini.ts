// PFC補正係数（GAS側と同じ）：API版Geminiの過大評価をWeb版相当に補正
const PFC_CALIBRATION = { P: 0.55, F: 0.55, C: 0.75 };

const NUTRITION_SYSTEM =
  '回答はJSON形式のみで返してください。説明・挨拶は不要です。';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type Pfc = {
  kcal: number;
  P: number;
  F: number;
  C: number;
  items: Array<{ name: string; P: number; F: number; C: number }>;
};

export async function analyzeImagesPfc(
  images: Array<{ base64: string; mimeType: string }>,
  supplementText: string | null
): Promise<Pfc> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');
  if (images.length === 0) throw new Error('画像が指定されていません');

  const supplementLine = supplementText
    ? `\n\n補足情報（顧客メモ）：${supplementText}\nこの補足情報も考慮してPFCを推定してください。`
    : '';

  const multiNotice =
    images.length > 1
      ? '\n複数枚は同じ食事を別角度から撮影したものです。重複なく1つの食事として推定してください。'
      : '';

  const prompt = `この食事のPFC（タンパク質・脂質・炭水化物）を推定してください。${multiNotice}

【最重要ルール】
- 写真に見えるものだけを素直に推定する。見えない油・調味料・隠れ食材は加算しない
- 過大評価を避け、控えめ（少なめ）を基準とする
- 外食チェーン店（松屋・吉野家・マクドナルド・サイゼリヤ・すき家・CoCo壱等）が明確に写っている場合のみ公式栄養成分値を使用する
- 複数枚に同じ食材が写っている場合は1回だけカウントする
${supplementLine}

{
  "P": タンパク質(g)の数値,
  "F": 脂質(g)の数値,
  "C": 炭水化物(g)の数値,
  "items": [{"name": "食材名（推定Xg）", "P": 数値, "F": 数値, "C": 数値}]
}`;

  const parts: Array<Record<string, unknown>> = images.map((img) => ({
    inline_data: { mime_type: img.mimeType, data: img.base64 },
  }));
  parts.push({ text: prompt });

  const text = await callGemini(parts, apiKey);
  return parsePfcJson(text);
}

export async function analyzeTextPfc(textDesc: string): Promise<Pfc> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const prompt = `以下の食事内容のPFC（タンパク質・脂質・炭水化物）を推定してください。

【最重要ルール】
- 記述された食材・量から素直に推定する。見えない油・調味料・隠れ食材は加算しない
- 過大評価を避け、控えめ（少なめ）を基準とする
- 外食チェーン店のメニューが含まれる場合のみ公式栄養成分値を使用する

食事内容：
${textDesc}

{
  "P": タンパク質(g)の数値,
  "F": 脂質(g)の数値,
  "C": 炭水化物(g)の数値,
  "items": [{"name": "食材名（推定Xg）", "P": 数値, "F": 数値, "C": 数値}]
}`;

  const text = await callGemini([{ text: prompt }], apiKey);
  return parsePfcJson(text);
}

async function callGemini(
  parts: Array<Record<string, unknown>>,
  apiKey: string
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: NUTRITION_SYSTEM }] },
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API失敗 ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Gemini応答が空です');
  return text;
}

function parsePfcJson(text: string): Pfc {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON解析失敗: ' + text.slice(0, 100));
  const parsed = JSON.parse(match[0]);
  const f1 = (x: number) => Math.round((x || 0) * 10) / 10;
  const P = f1((parsed.P || 0) * PFC_CALIBRATION.P);
  const F = f1((parsed.F || 0) * PFC_CALIBRATION.F);
  const C = f1((parsed.C || 0) * PFC_CALIBRATION.C);
  return {
    kcal: Math.round(P * 4 + F * 9 + C * 4),
    P,
    F,
    C,
    items: parsed.items || [],
  };
}
