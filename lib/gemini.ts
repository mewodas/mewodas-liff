// PFC補正係数：API版Geminiの画像推定は過大評価するため画像入力時のみ適用
// テキスト入力時は量が明示されておりAIの計算が正確なので補正なし（1.0）
const PFC_CALIBRATION_IMAGE = { P: 0.55, F: 0.55, C: 0.75 };
const PFC_CALIBRATION_TEXT  = { P: 1.0,  F: 1.0,  C: 1.0  };

const NUTRITION_SYSTEM =
  '回答はJSON形式のみで返してください。説明・挨拶は不要です。';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-1.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

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
      ? '\n複数枚の写真は1食を構成する別々の皿/料理です（コース料理など）。各写真の内容をそれぞれ推定し、合算して1食分のPFCを算出してください。'
      : '';

  const prompt = `この食事のPFC（タンパク質・脂質・炭水化物）を推定してください。${multiNotice}

【最重要ルール】
- 写真に見えるものだけを素直に推定する。見えない油・調味料・隠れ食材は加算しない
- 過大評価を避け、控えめ（少なめ）を基準とする
- 外食チェーン店（松屋・吉野家・マクドナルド・サイゼリヤ・すき家・CoCo壱等）が明確に写っている場合のみ公式栄養成分値を使用する
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
  return parsePfcJson(text, PFC_CALIBRATION_IMAGE);
}

export async function analyzeTextPfc(textDesc: string): Promise<Pfc> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const prompt = `以下の食事内容のPFC（タンパク質・脂質・炭水化物）を栄養学の標準値で正確に計算してください。

【計算ルール】
- 量が明示されている食材（例：鶏むね肉100g）は、日本食品標準成分表の標準値で正確に算出する
  例：鶏むね肉(皮なし)100g = P23g/F1.5g/C0g、白米(ご飯)150g = P3.8g/F0.5g/C55g
- 量が明示されていない食材は、一般的な一人前の量で算出する
- 控えめに見積もる必要はない。標準値で正確に計算すること
- 外食チェーン店のメニューが含まれる場合は公式栄養成分値を使用する

食事内容：
${textDesc}

{
  "P": タンパク質(g)の数値,
  "F": 脂質(g)の数値,
  "C": 炭水化物(g)の数値,
  "items": [{"name": "食材名（推定Xg）", "P": 数値, "F": 数値, "C": 数値}]
}`;

  const text = await callGemini([{ text: prompt }], apiKey);
  return parsePfcJson(text, PFC_CALIBRATION_TEXT);
}

async function callGemini(
  parts: Array<Record<string, unknown>>,
  apiKey: string
): Promise<string> {
  // 主モデル + フォールバックモデル、それぞれリトライ付き
  const models = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];
  let lastError = '';
  for (const model of models) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await callGeminiOnce(model, parts, apiKey);
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        // 503/429/500系はリトライまたはフォールバック対象
        const retriable = /\b(503|429|500|502|504)\b|overloaded|UNAVAILABLE|high demand/i.test(lastError);
        if (!retriable) throw e;
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }
    // このモデルで全リトライ失敗 → 次モデル（フォールバック）へ
  }
  throw new Error(`Gemini APIに接続できません: ${lastError}`);
}

async function callGeminiOnce(
  model: string,
  parts: Array<Record<string, unknown>>,
  apiKey: string
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: NUTRITION_SYSTEM }] },
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API失敗 ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Gemini応答が空です');
  return text;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function parsePfcJson(
  text: string,
  calibration: { P: number; F: number; C: number }
): Pfc {
  const cleaned = stripMarkdown(text);
  const parsed = parseJsonLenient(cleaned);
  const f1 = (x: number) => Math.round((x || 0) * 10) / 10;
  const P = f1((parsed.P || 0) * calibration.P);
  const F = f1((parsed.F || 0) * calibration.F);
  const C = f1((parsed.C || 0) * calibration.C);
  const items = Array.isArray(parsed.items)
    ? (parsed.items as Array<Record<string, unknown>>).map((it) => ({
        name: String(it.name ?? ''),
        P: Number(it.P ?? 0),
        F: Number(it.F ?? 0),
        C: Number(it.C ?? 0),
      }))
    : [];
  return {
    kcal: Math.round(P * 4 + F * 9 + C * 4),
    P,
    F,
    C,
    items,
  };
}

// マークダウンの ```json / ``` 囲みを除去
function stripMarkdown(text: string): string {
  return text
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
    .replace(/```[\s\S]*$/i, '')
    .trim();
}

// JSON.parse + 途中切れ対応：閉じ括弧を補完しつつパースを試みる
function parseJsonLenient(text: string): { P?: number; F?: number; C?: number; items?: unknown[] } {
  // まずは素直にパース
  try {
    return JSON.parse(text);
  } catch { /* fallthrough */ }

  // {...} 部分だけを抽出
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error('JSON解析失敗（開始 { なし）: ' + text.slice(0, 200));
  }
  const body = text.slice(start);

  // 途中切れの可能性：最後の完全な数値プロパティで切り詰めて、必要分だけ閉じる
  // 戦略：items配列がある場合は items を完全に削除して P/F/C のみを抽出
  const pMatch = body.match(/"P"\s*:\s*([\d.]+)/);
  const fMatch = body.match(/"F"\s*:\s*([\d.]+)/);
  const cMatch = body.match(/"C"\s*:\s*([\d.]+)/);
  if (pMatch || fMatch || cMatch) {
    return {
      P: pMatch ? parseFloat(pMatch[1]) : 0,
      F: fMatch ? parseFloat(fMatch[1]) : 0,
      C: cMatch ? parseFloat(cMatch[1]) : 0,
      items: [],
    };
  }

  throw new Error('JSON解析失敗: ' + body.slice(0, 200));
}
