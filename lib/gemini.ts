// PFC補正係数：AIの推定精度向上により補正なし運用に変更（全て1.0）
// 必要に応じて将来再調整可能
const PFC_CALIBRATION_IMAGE = { P: 1.0, F: 1.0, C: 1.0 };
const PFC_CALIBRATION_TEXT  = { P: 1.0, F: 1.0, C: 1.0 };

const NUTRITION_SYSTEM =
  '回答はJSON形式のみで返してください。説明・挨拶は不要です。';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;
const PARALLEL_BATCH_SIZE = 4; // 全並列で最速処理。レート制限はフォールバックモデルで対応

export type NutritionDetails = {
  fiber: number; // 食物繊維(g)
  salt: number; // 食塩相当量(g)
  iron: number; // 鉄(mg)
  calcium: number; // カルシウム(mg)
  vitaminC: number; // ビタミンC(mg)
};

export type Pfc = {
  kcal: number;
  P: number;
  F: number;
  C: number;
  items: Array<{ name: string; P: number; F: number; C: number }>;
  details?: NutritionDetails; // 詳細栄養素（オプショナル）
};

// メモに「Xg/X杯/X個/X枚/X本/X切/X皿/Xml/Xcc/大さじX/小さじX」のような
// 量を明示する表現が含まれているか判定
function hasExplicitQuantity(text: string | null): boolean {
  if (!text) return false;
  return /\d+(?:\.\d+)?\s*(?:g|kg|ml|cc|個|杯|本|枚|切|皿|匹|尾|玉|束|片|缶|袋|箱|串)|大さじ\s*\d|小さじ\s*\d/i.test(
    text
  );
}

export async function analyzeImagesPfc(
  images: Array<{ base64: string; mimeType: string }>,
  supplementText: string | null
): Promise<Pfc> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');
  if (images.length === 0) throw new Error('画像が指定されていません');

  const explicit = hasExplicitQuantity(supplementText);

  // メモがある場合は常に単一AIコールで処理（写真+メモを一緒に解析）
  // → ダブルカウント（メモが写真の食材を描写する場合の重複計算）を防止
  if (supplementText) {
    return analyzeImagesSingleCall(images, supplementText, explicit);
  }

  // 複数枚（メモなし）→ 並列解析で高速化（各皿は別物として合算）
  if (images.length > 1) {
    return analyzeImagesParallel(images, null);
  }

  return analyzeImagesSingleCall(images, null, false);
}

async function analyzeImagesParallel(
  images: Array<{ base64: string; mimeType: string }>,
  supplementText: string | null
): Promise<Pfc> {
  // バッチ単位で並列解析（同時実行数を制限してレート制限を回避）
  const results: Pfc[] = [];
  for (let i = 0; i < images.length; i += PARALLEL_BATCH_SIZE) {
    const batch = images.slice(i, i + PARALLEL_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((img) => analyzeImagesSingleCall([img], supplementText, false))
    );
    results.push(...batchResults);
  }

  const total = results.reduce(
    (acc, r) => ({
      P: acc.P + r.P,
      F: acc.F + r.F,
      C: acc.C + r.C,
      items: [...acc.items, ...r.items],
    }),
    { P: 0, F: 0, C: 0, items: [] as Pfc['items'] }
  );

  const f1 = (x: number) => Math.round(x * 10) / 10;
  return {
    P: f1(total.P),
    F: f1(total.F),
    C: f1(total.C),
    kcal: Math.round(total.P * 4 + total.F * 9 + total.C * 4),
    items: total.items,
  };
}

async function analyzeImagesSingleCall(
  images: Array<{ base64: string; mimeType: string }>,
  supplementText: string | null,
  explicit: boolean
): Promise<Pfc> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const supplementLine = supplementText
    ? explicit
      ? `\n\n【メモを最優先・重複カウント厳禁】
顧客メモ：${supplementText}

処理手順（厳守）：
1. メモに記載された食材は、メモの量を正解として日本食品標準成分表の正確な値で計算し、items配列に含める
2. メモに記載された食材が「写真にも写っている」場合は、メモの値だけを採用（写真側からは追加カウントしない、重複させない）
3. 写真にのみ写っていて「メモに記載が無い食材」のみ、写真から推定してitemsに追加する
4. items配列にはメモの食材 + 写真にのみある食材 を両方含める（ただし重複させない）

例1：メモ「ご飯150g、鶏むね100g」+ 写真に「ご飯・鶏肉・味噌汁・サラダ」
→ ご飯と鶏むねはメモの値を採用、味噌汁とサラダは写真から追加
→ items: [{ご飯150g}, {鶏むね100g}, {味噌汁}, {サラダ}]

例2：メモ「ごぼう1kg」+ 写真に「ご飯・味噌汁・肉」（ごぼうは写真に無い）
→ メモのごぼう + 写真の全食材を追加
→ items: [{ごぼう1kg}, {ご飯}, {味噌汁}, {肉}]`
      : `\n\n補足情報（顧客メモ）：${supplementText}\nこの補足情報も考慮してPFCを推定してください。`
    : '';

  const multiNotice =
    images.length > 1
      ? '\n複数枚の写真は1食を構成する別々の皿/料理です（コース料理など）。各写真の内容をそれぞれ推定し、合算して1食分のPFCを算出してください。'
      : '';

  const accuracyRule = explicit
    ? '- メモに量が明示されている食材は標準成分表の正確な値で計算する（控えめにしない）'
    : '- 過大評価を避け、控えめ（少なめ）を基準とする';

  const prompt = `この食事のPFC（タンパク質・脂質・炭水化物）を推定してください。${multiNotice}

【最重要ルール】
- 写真に見えるものだけを素直に推定する。見えない油・調味料・隠れ食材は加算しない
${accuracyRule}
- 外食チェーン店（松屋・吉野家・マクドナルド・サイゼリヤ・すき家・CoCo壱等）が明確に写っている場合のみ公式栄養成分値を使用する

【items必須・厳守】
- "items"配列には写真から識別できた食材を必ず1つ以上記載する（空配列は禁止）
- 各食材は具体的な食材名にする（例：「ご飯」「鶏むね肉」「ブロッコリー」「サラダ」「味噌汁」など）
- "name"は「食材名（推定Xg）」の形式（例：「ご飯（推定150g）」）
- 識別が難しい場合でも「不明な料理」ではなく「ご飯と思われるもの」など推測可能な名前を入れる${supplementLine}

【詳細栄養素も推定】
PFCに加えて、以下5つも栄養学の標準値で推定してください：
- fiber: 食物繊維(g)
- salt: 食塩相当量(g)
- iron: 鉄(mg)
- calcium: カルシウム(mg)
- vitaminC: ビタミンC(mg)
推定が困難な場合は0を入れてOK。

出力JSON形式（必ずitemsを含めること）：
{
  "P": タンパク質(g)の数値,
  "F": 脂質(g)の数値,
  "C": 炭水化物(g)の数値,
  "items": [{"name": "ご飯（推定150g）", "P": 3.8, "F": 0.5, "C": 55}],
  "details": {
    "fiber": 食物繊維(g),
    "salt": 食塩相当量(g),
    "iron": 鉄(mg),
    "calcium": カルシウム(mg),
    "vitaminC": ビタミンC(mg)
  }
}`;

  const parts: Array<Record<string, unknown>> = images.map((img) => ({
    inline_data: { mime_type: img.mimeType, data: img.base64 },
  }));
  parts.push({ text: prompt });

  const text = await callGemini(parts, apiKey);
  // 明示量がある場合は補正なし（テキスト準拠）、なければ画像補正適用
  return parsePfcJson(text, explicit ? PFC_CALIBRATION_TEXT : PFC_CALIBRATION_IMAGE);
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

【items必須・厳守】
- "items"配列には記載された食材を必ず1つ以上含める（空配列は禁止）
- "name"は「食材名（推定Xg）」の形式

【詳細栄養素も推定】
PFCに加えて、以下5つも栄養学の標準値で推定してください：
- fiber: 食物繊維(g)
- salt: 食塩相当量(g)
- iron: 鉄(mg)
- calcium: カルシウム(mg)
- vitaminC: ビタミンC(mg)

食事内容：
${textDesc}

出力JSON形式：
{
  "P": タンパク質(g)の数値,
  "F": 脂質(g)の数値,
  "C": 炭水化物(g)の数値,
  "items": [{"name": "鶏むね肉100g", "P": 23, "F": 1.5, "C": 0}],
  "details": {
    "fiber": 食物繊維(g),
    "salt": 食塩相当量(g),
    "iron": 鉄(mg),
    "calcium": カルシウム(mg),
    "vitaminC": ビタミンC(mg)
  }
}`;

  const text = await callGemini([{ text: prompt }], apiKey);
  return parsePfcJson(text, PFC_CALIBRATION_TEXT);
}

// 体重予測：過去データから3ヶ月後の体重を予測
export type WeightPrediction = {
  predictedWeight: number; // 3ヶ月後の予測体重(kg)
  monthlyChange: number; // 月平均の体重変化(kg/月)
  confidenceLevel: 'high' | 'medium' | 'low';
  willReachGoal: boolean | null; // 目標体重を期限内に達成できるか（目標未設定ならnull）
  comment: string; // 総評コメント（30文字以内）
  recommendations: string[]; // アドバイス3つ以内
};

export async function predictWeight(params: {
  weightHistory: Array<{ date: string; weight: number }>; // 直近30日
  avgKcal: number; // 直近30日の平均カロリー
  goalKcal: number;
  avgP: number; // 平均PFC
  avgF: number;
  avgC: number;
  exerciseDays: number; // 直近30日の運動日数
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
}): Promise<WeightPrediction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const {
    weightHistory,
    avgKcal,
    goalKcal,
    avgP,
    avgF,
    avgC,
    exerciseDays,
    currentWeight,
    targetWeight,
    targetDate,
  } = params;

  const weightTrendStr = weightHistory
    .map((w) => `${w.date}: ${w.weight}kg`)
    .join('\n  ');

  const targetInfo =
    targetWeight && targetDate
      ? `\n【目標】\n- 目標体重: ${targetWeight}kg\n- 目標達成日: ${targetDate}`
      : '\n【目標】未設定';

  const prompt = `あなたは管理栄養士・パーソナルトレーナーです。
顧客の直近データから3ヶ月後の体重を科学的に予測してください。

【直近30日のデータ】
- 平均カロリー摂取: ${avgKcal} kcal/日（目標: ${goalKcal} kcal）
- 平均PFC: P${avgP}g / F${avgF}g / C${avgC}g
- 運動日数: ${exerciseDays}日 / 30日
- 体重推移（${weightHistory.length}日分）:
  ${weightTrendStr || '（データなし）'}
- 現在体重: ${currentWeight ?? '不明'} kg
${targetInfo}

【予測ロジック】
- カロリー収支から月平均の体重変化を算出（1kg脂肪 ≒ 7,200kcal）
- 運動による消費カロリーを加味
- 体重推移の実測値を最重視
- データが少ない場合は信頼度を下げる

【出力JSON形式（必ずこの形式）】
{
  "predictedWeight": 3ヶ月後の予測体重(kg)数値,
  "monthlyChange": 月平均の体重変化(kg/月)数値（減量はマイナス）,
  "confidenceLevel": "high" | "medium" | "low",
  "willReachGoal": 目標達成見込みtrue/false（目標未設定ならnull）,
  "comment": "30文字以内の総評",
  "recommendations": ["アドバイス1", "アドバイス2", "アドバイス3"]
}`;

  const text = await callGemini([{ text: prompt }], apiKey);
  return parseWeightPredictionJson(text);
}

function parseWeightPredictionJson(text: string): WeightPrediction {
  const cleaned = stripMarkdown(text);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    if (start === -1) throw new Error('予測JSON解析失敗');
    parsed = JSON.parse(cleaned.slice(start));
  }
  return {
    predictedWeight: Math.round(Number(parsed.predictedWeight ?? 0) * 10) / 10,
    monthlyChange: Math.round(Number(parsed.monthlyChange ?? 0) * 10) / 10,
    confidenceLevel:
      parsed.confidenceLevel === 'high'
        ? 'high'
        : parsed.confidenceLevel === 'low'
        ? 'low'
        : 'medium',
    willReachGoal:
      parsed.willReachGoal === true
        ? true
        : parsed.willReachGoal === false
        ? false
        : null,
    comment: String(parsed.comment ?? ''),
    recommendations: Array.isArray(parsed.recommendations)
      ? (parsed.recommendations as unknown[]).map((r) => String(r)).slice(0, 3)
      : [],
  };
}

// AI食事相談チャット
export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function chatWithAi(params: {
  message: string;
  history: ChatMessage[];
  customerContext: {
    name: string;
    goals: { kcal: number; P: number; F: number; C: number };
    todayTotals: { kcal: number; P: number; F: number; C: number };
    todayMealTypes: string[]; // ['朝食', '昼食']
    currentHour: number;
    currentWeight?: number | null;
    targetWeight?: number | null;
  };
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const { message, history, customerContext } = params;
  const { name, goals, todayTotals, todayMealTypes, currentHour, currentWeight, targetWeight } =
    customerContext;

  const remaining = {
    kcal: Math.round(goals.kcal - todayTotals.kcal),
    P: Math.round((goals.P - todayTotals.P) * 10) / 10,
    F: Math.round((goals.F - todayTotals.F) * 10) / 10,
    C: Math.round((goals.C - todayTotals.C) * 10) / 10,
  };

  const systemPrompt = `あなたは${name}さん専属のパーソナル管理栄養士です。
ジムの会員の食事相談に、明るく親身に答えてください。

【${name}さんの今日の状況】
- 現在時刻：${currentHour}時頃
- 目標：${goals.kcal}kcal / P${goals.P}g / F${goals.F}g / C${goals.C}g
- 今日の摂取：${todayTotals.kcal}kcal / P${todayTotals.P}g / F${todayTotals.F}g / C${todayTotals.C}g
- 残り目標：${remaining.kcal}kcal / P${remaining.P}g / F${remaining.F}g / C${remaining.C}g
- 既に記録済み：${todayMealTypes.length > 0 ? todayMealTypes.join('、') : 'まだ記録なし'}
${currentWeight ? `- 現在体重：${currentWeight}kg` : ''}
${targetWeight ? `- 目標体重：${targetWeight}kg` : ''}

【回答ルール】
- 200文字以内で簡潔に答える
- 数値で答える時は具体的に（例：「鶏胸肉100gはP23g」）
- 励まし・共感を入れる
- 「ご飯食べていい？」のような相談には、残りPFCを元に判断
- 「これ食べたい」相談には、量や代替案も提示
- 食事以外の質問（運動・体重・睡眠）にも一般的な範囲で答えてOK
- 医療的な診断は避ける（必要なら専門家相談を促す）
- 絵文字は1〜2個まで控えめに`;

  // Gemini APIの content 配列形式に変換
  const contents = [
    ...history.slice(-10).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.7,
        topP: 0.9,
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Chat失敗 ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text.trim();
}

export type MealSuggestion = {
  title: string;
  tag: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  reason: string;
};

// 残りPFCに合う料理提案を3つ生成
export async function suggestMeals(params: {
  remaining: { kcal: number; P: number; F: number; C: number };
  hour: number; // 0-23 JST
  recordedMealTypes: string[]; // ['朝食', '昼食'] 等
}): Promise<MealSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const { remaining, hour, recordedMealTypes } = params;

  // 時間帯に応じた食事種別の優先度
  let mealHint = '';
  if (hour >= 5 && hour < 10) mealHint = '朝食';
  else if (hour >= 10 && hour < 14) mealHint = '昼食';
  else if (hour >= 17 && hour < 22) mealHint = '夕食';
  else if (hour >= 14 && hour < 17) mealHint = '間食または早めの夕食';
  else mealHint = '軽めの食事または夜食';

  const recordedText =
    recordedMealTypes.length > 0
      ? `既に記録済み：${recordedMealTypes.join('、')}`
      : '本日まだ記録なし';

  const prompt = `あなたは管理栄養士です。顧客の本日の残り栄養素を3つの具体的な料理で埋める提案をしてください。

【現状】
- 現在時刻：${hour}時頃（時間帯ヒント：${mealHint}）
- ${recordedText}

【残り栄養素（これに近づける）】
- カロリー：${remaining.kcal} kcal
- タンパク質：${remaining.P} g
- 脂質：${remaining.F} g
- 炭水化物：${remaining.C} g

【条件】
- 3つの具体的な料理（品名・分量を明記）を提案
- 多様性を持たせる（自炊・外食・コンビニのバリエーション）
- 残り栄養素にできるだけ近く、超過しないように
- titleは具体的な品名と分量（例：「鶏胸肉のソテー200g + 玄米150g + 茹でブロッコリー100g」）
- tagは「自炊」「外食」「コンビニ」のいずれか
- reasonは20文字以内で簡潔に

【出力JSON形式（必ずこの形式）】
{
  "suggestions": [
    { "title": "...", "tag": "自炊", "kcal": 数値, "P": 数値, "F": 数値, "C": 数値, "reason": "..." },
    { "title": "...", "tag": "外食", "kcal": 数値, "P": 数値, "F": 数値, "C": 数値, "reason": "..." },
    { "title": "...", "tag": "コンビニ", "kcal": 数値, "P": 数値, "F": 数値, "C": 数値, "reason": "..." }
  ]
}`;

  const text = await callGemini([{ text: prompt }], apiKey);
  return parseSuggestionsJson(text);
}

function parseSuggestionsJson(text: string): MealSuggestion[] {
  const cleaned = stripMarkdown(text);
  let parsed: { suggestions?: unknown[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // 抽出を試みる
    const start = cleaned.indexOf('{');
    if (start === -1) return [];
    try {
      parsed = JSON.parse(cleaned.slice(start));
    } catch {
      return [];
    }
  }
  const arr = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  return arr
    .map((s) => {
      const item = s as Record<string, unknown>;
      return {
        title: String(item.title ?? ''),
        tag: String(item.tag ?? ''),
        kcal: Math.round(Number(item.kcal ?? 0)),
        P: Math.round(Number(item.P ?? 0) * 10) / 10,
        F: Math.round(Number(item.F ?? 0) * 10) / 10,
        C: Math.round(Number(item.C ?? 0) * 10) / 10,
        reason: String(item.reason ?? ''),
      };
    })
    .filter((s) => s.title);
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
        temperature: 0.1, // 同じ入力で結果が大きく変わらないよう低めに設定
        topP: 0.8,
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
  // 詳細栄養素のパース（オプショナル）
  const detailsRaw = (parsed as Record<string, unknown>).details as
    | Record<string, unknown>
    | undefined;
  const details = detailsRaw
    ? {
        fiber: f1(Number(detailsRaw.fiber ?? 0)),
        salt: f1(Number(detailsRaw.salt ?? 0)),
        iron: f1(Number(detailsRaw.iron ?? 0)),
        calcium: Math.round(Number(detailsRaw.calcium ?? 0)),
        vitaminC: Math.round(Number(detailsRaw.vitaminC ?? 0)),
      }
    : undefined;
  return {
    kcal: Math.round(P * 4 + F * 9 + C * 4),
    P,
    F,
    C,
    items,
    details,
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
function parseJsonLenient(text: string): {
  P?: number;
  F?: number;
  C?: number;
  items?: unknown[];
  details?: unknown;
} {
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
