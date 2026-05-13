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

// 栄養成分表ラベル（パッケージ裏の表）から数値を抽出
export type NutritionLabelResult = {
  name: string; // 商品名（不明なら「食品」）
  servingLabel: string; // 1食あたり / 100gあたり / 1袋あたり 等
  servings: number; // 内容量の何食分か（例: 1袋に3食分なら 3）。不明なら 1
  perServing: { kcal: number; P: number; F: number; C: number };
  perWhole?: { kcal: number; P: number; F: number; C: number };
  note: string;
};

export async function analyzeNutritionLabel(
  images: Array<{ base64: string; mimeType: string }>
): Promise<NutritionLabelResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');
  if (images.length === 0) throw new Error('画像が指定されていません');

  const prompt = `あなたは栄養士です。写真に写っている「栄養成分表示」（パッケージ裏の表）から数値を正確に読み取ってJSONで返してください。

【読み取り対象】
- 商品名（パッケージから読み取れれば、なければ「食品」）
- 1食/1袋/100g等の表記単位（servingLabel）
- 1食あたりの エネルギー(kcal)・たんぱく質(P g)・脂質(F g)・炭水化物(C g)
- 内容量が複数食分の場合は servings に整数（例：1袋3食分→3）、不明なら1

【ルール】
- 数値はそのまま読み取り、推測しない
- 単位を間違えない（mg と g、kJ と kcal）
- 1kcal = 4.184kJ なので kJ 表記しかない場合は変換
- 読めない/写っていない値は 0 にする
- noteには読み取り時の注意点や曖昧な点を30字程度で

【出力JSON】
{
  "name": "商品名 or 食品",
  "servingLabel": "1食あたり",
  "servings": 1,
  "perServing": { "kcal": 数値, "P": 数値, "F": 数値, "C": 数値 },
  "perWhole": { "kcal": 数値, "P": 数値, "F": 数値, "C": 数値 },
  "note": "..."
}`;

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      servingLabel: { type: 'string' },
      servings: { type: 'integer' },
      perServing: {
        type: 'object',
        properties: {
          kcal: { type: 'number' },
          P: { type: 'number' },
          F: { type: 'number' },
          C: { type: 'number' },
        },
        required: ['kcal', 'P', 'F', 'C'],
      },
      perWhole: {
        type: 'object',
        properties: {
          kcal: { type: 'number' },
          P: { type: 'number' },
          F: { type: 'number' },
          C: { type: 'number' },
        },
      },
      note: { type: 'string' },
    },
    required: ['name', 'servingLabel', 'servings', 'perServing', 'note'],
  };

  const parts: Array<Record<string, unknown>> = images.map((img) => ({
    inline_data: { mime_type: img.mimeType, data: img.base64 },
  }));
  parts.push({ text: prompt });

  const text = await callGeminiStructured(parts, apiKey, schema);
  const cleaned = stripMarkdown(text);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = JSON.parse(repairLlmJson(cleaned));
  }

  const ps = (parsed.perServing as Record<string, unknown>) || {};
  const pw = (parsed.perWhole as Record<string, unknown>) || {};
  const r1 = (n: unknown) => Math.round((Number(n) || 0) * 10) / 10;

  return {
    name: String(parsed.name || '食品'),
    servingLabel: String(parsed.servingLabel || '1食あたり'),
    servings: Math.max(1, Math.round(Number(parsed.servings) || 1)),
    perServing: {
      kcal: Math.round(Number(ps.kcal) || 0),
      P: r1(ps.P),
      F: r1(ps.F),
      C: r1(ps.C),
    },
    perWhole:
      Object.keys(pw).length > 0
        ? {
            kcal: Math.round(Number(pw.kcal) || 0),
            P: r1(pw.P),
            F: r1(pw.F),
            C: r1(pw.C),
          }
        : undefined,
    note: String(parsed.note || ''),
  };
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
1. メモに記載された料理は、メモの量を正解として日本食品標準成分表の正確な値で計算し、items配列に含める
2. メモに記載された料理が「写真にも写っている」場合は、メモの値だけを採用（写真側からは追加カウントしない、重複させない）
3. 写真にのみ写っていて「メモに記載が無い料理」のみ、写真から推定してitemsに追加する
4. items配列にはメモの料理 + 写真にのみある料理 を両方含める（ただし重複させない）

例：メモ「白米150g」+ 写真に「白米・味噌汁・唐揚げ」
→ 白米はメモの値を採用、味噌汁・唐揚げは写真から追加
→ items: [{白米 150g}, {味噌汁 1杯}, {唐揚げ 3個}]`
      : `\n\n【写真とメモの両方を必ず加味する】
顧客メモ：${supplementText}

このメモは写真の補足情報です。以下を厳守してください：
1. 写真に写っている料理を基本に推定する
2. メモの修飾表現（大盛り/少なめ/半分/2倍/○○抜き/ノンオイル/低糖質/無糖 等）は標準量から増減して反映する
   - 例：「大盛り」→ 標準量の1.5倍、「少なめ」→ 0.7倍、「半分」→ 0.5倍
   - 例：「ノンオイル」「油抜き」→ 脂質(F)を大幅に下げる
   - 例：「マヨ抜き/ドレッシング抜き」→ その分の脂質を加算しない
3. メモに「写真に映っていない食材・調味料」（例：ドレッシング、マヨネーズ、ソース、隠し味）が書かれていれば、その分を加算する
4. メモに料理の固有名詞（チェーン店名・商品名）が書かれていれば、公式栄養成分値を優先採用する
5. 写真とメモが矛盾する場合は、メモを優先する（顧客が実際に食べた本人の申告）`
    : '';

  const multiNotice =
    images.length > 1
      ? '\n複数枚の写真は1食を構成する別々の皿/料理です（コース料理など）。各写真の内容をそれぞれ推定し、合算して1食分のPFCを算出してください。'
      : '';

  const accuracyRule = explicit
    ? '- メモに量が明示されている料理は標準成分表の正確な値で計算する（控えめにしない）'
    : supplementText
    ? '- 写真は標準量で推定し、メモの修飾表現（大盛り/少なめ/抜き/ノンオイル等）でその値を増減する'
    : '- 過大評価を避け、控えめ（少なめ）を基準とする';

  const prompt = `この食事のPFC（タンパク質・脂質・炭水化物）を推定してください。${multiNotice}

【最重要ルール】
- 写真に見えるものだけを素直に推定する。見えない油・調味料・隠れ食材は加算しない
${accuracyRule}
- 外食チェーン店（松屋・吉野家・マクドナルド・サイゼリヤ・すき家・CoCo壱等）が明確に写っている場合のみ公式栄養成分値を使用する

【items必須・料理単位で列挙（最重要）】
- "items"配列には「料理・商品単位」で1品ずつ記載する（最低1つ、空配列禁止）
- ❌ NG例：イチゴタルト1個 → ["タルト生地", "カスタードクリーム", "イチゴ"]（材料分解は禁止）
- ✅ OK例：イチゴタルト1個 → ["イチゴタルト 1個"]
- ✅ OK例：定食 → ["白米 茶碗1杯", "唐揚げ 3個", "味噌汁 1杯", "サラダ 1皿"]
- 一般的な料理名・商品名で記載（例：「ハンバーグ定食」「カルボナーラ」「ショートケーキ 1切れ」「コーヒー Lサイズ」など）
- "name"は「料理名 分量」の形式（例：「イチゴタルト 1個」「ラーメン 1杯」「ご飯 150g」）
- 識別が難しい場合でも「不明な料理」ではなく「洋菓子と思われるもの」など推測可能な名前を入れる${supplementLine}

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
  "items": [{"name": "イチゴタルト 1個", "P": 4, "F": 18, "C": 40}],
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

【items必須・料理単位で列挙】
- "items"配列には記載された「料理・商品単位」で1品ずつ記載する（最低1つ、空配列禁止）
- ❌ NG：イチゴタルト → ["タルト生地", "カスタード", "イチゴ"]（材料に分解しない）
- ✅ OK：イチゴタルト → ["イチゴタルト 1個"]
- "name"は「料理名 分量」の形式（例：「ご飯 150g」「唐揚げ 3個」「ラーメン 1杯」）

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
  "items": [{"name": "鶏むね肉 100g", "P": 23, "F": 1.5, "C": 0}],
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
- 通常は300〜500文字を目安に分かりやすく答える（質問が深い場合は600文字まで可）
- 必ず文章を最後まで完結させる。途中で切らない
- 数値で答える時は具体的に（例：「鶏胸肉100gはP23g」）
- 励まし・共感を入れる
- 「ご飯食べていい？」のような相談には、残りPFCを元に判断
- 「これ食べたい」相談には、量や代替案も提示
- 食事以外の質問（運動・体重・睡眠）にも一般的な範囲で答えてOK
- 医療的な診断は避ける（必要なら専門家相談を促す）
- 絵文字は1〜2個まで控えめに
- 箇条書きを使う場合は3項目程度に留める`;

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
        // 日本語は1文字あたり1.5〜2トークン消費。600文字でも応答に回せるよう3000に。
        // thinkingBudget=0 で「考える」トークン消費を停止 → 応答に全トークンを回せる
        maxOutputTokens: 3000,
        temperature: 0.7,
        topP: 0.9,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Chat失敗 ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text: string = candidate?.content?.parts?.[0]?.text ?? '';
  const finishReason: string = candidate?.finishReason ?? '';
  // 途切れ検出：MAX_TOKENS で切れた場合は注記を付ける
  if (finishReason === 'MAX_TOKENS' && text) {
    return text.trim() + '\n\n（応答が長くなったので途中で区切りました。続きは「続けて」と聞いてください）';
  }
  if (!text) {
    throw new Error(
      finishReason === 'SAFETY'
        ? 'AIが回答を控えました（安全フィルタ）。別の質問をお試しください。'
        : 'AI応答が空でした。もう一度お試しください。'
    );
  }
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

export type DailyMealPlan = {
  meals: Array<{
    type: '朝食' | '昼食' | '夕食' | '間食';
    title: string;
    items: string[];
    kcal: number;
    P: number;
    F: number;
    C: number;
    cookTime: string;
    note: string;
  }>;
  totals: { kcal: number; P: number; F: number; C: number };
  advice: string;
};

export type Recipe = {
  servings: string;
  time: string;
  ingredients: Array<{ name: string; amount: string }>;
  steps: string[];
  tips: string;
};

// レシピ生成：献立の1食を選んだら作り方を生成
export async function generateRecipe(params: {
  title: string;
  items: string[];
  servings?: string;
}): Promise<Recipe> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');
  const { title, items, servings = '1人前' } = params;

  const prompt = `あなたは料理研究家です。以下の料理の作り方を、家庭で作れる簡潔な手順で教えてください。

料理名：${title}
含まれる食材：${items.join('、')}
分量：${servings}

【条件】
- 一般的な家庭の調理器具で作れる
- 手順は6〜10ステップ程度、各ステップは1〜2文で簡潔に
- 材料はグラム・大さじ・小さじ等の具体的な分量
- tipsは美味しく作るコツや時短の工夫を50字程度

【出力JSON形式（必ずこの形式）】
{
  "servings": "${servings}",
  "time": "15分",
  "ingredients": [
    { "name": "鶏むね肉", "amount": "100g" },
    { "name": "塩", "amount": "少々" }
  ],
  "steps": [
    "鶏むね肉を一口大に切る",
    "..."
  ],
  "tips": "..."
}`;

  const schema = {
    type: 'object',
    properties: {
      servings: { type: 'string' },
      time: { type: 'string' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'string' },
          },
          required: ['name', 'amount'],
        },
      },
      steps: { type: 'array', items: { type: 'string' } },
      tips: { type: 'string' },
    },
    required: ['servings', 'time', 'ingredients', 'steps', 'tips'],
  };

  const text = await callGeminiStructured([{ text: prompt }], apiKey, schema);
  const cleaned = stripMarkdown(text);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = JSON.parse(repairLlmJson(cleaned));
  }
  const rawIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  return {
    servings: String(parsed.servings ?? servings),
    time: String(parsed.time ?? '不明'),
    ingredients: rawIngredients
      .map((it: unknown) => {
        const o = (it as Record<string, unknown>) || {};
        return {
          name: String(o.name ?? ''),
          amount: String(o.amount ?? ''),
        };
      })
      .filter((it: { name: string }) => it.name),
    steps: Array.isArray(parsed.steps)
      ? parsed.steps.map((s: unknown) => String(s)).filter(Boolean)
      : [],
    tips: String(parsed.tips ?? ''),
  };
}

// 1日の献立をAIで作成（朝・昼・夕・間食、または残り分）
export async function generateMealPlan(params: {
  goals: { kcal: number; P: number; F: number; C: number };
  remaining?: { kcal: number; P: number; F: number; C: number };
  eaten?: { kcal: number; P: number; F: number; C: number };
  eatenItems?: string[];
  mode?: 'full' | 'remaining' | 'one_meal';
  targetMealType?: '朝食' | '昼食' | '夕食' | '間食';
  profile?: {
    currentWeight?: number | null;
    targetWeight?: number | null;
    targetDate?: string | null;
  };
  referenceMenu?: Array<{
    name: string;
    unit?: string;
    kcal?: number;
    P?: number;
    F?: number;
    C?: number;
    useCount?: number;
  }>;
  ingredients?: string[];
  preferences: {
    dietType: string;
    avoidIngredients: string;
    preferIngredients?: string;
    budget: string;
    cookTime: string;
  };
}): Promise<DailyMealPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const { goals, preferences, remaining, eaten, eatenItems, mode = 'full', targetMealType, profile, referenceMenu, ingredients } = params;

  // 体重・目標から減量/維持/増量を判定
  let weightDirective = '';
  if (profile?.currentWeight && profile.targetWeight) {
    const diff = profile.currentWeight - profile.targetWeight;
    if (diff > 1) weightDirective = `減量フェーズ（現在${profile.currentWeight}kg→目標${profile.targetWeight}kg）。${profile.targetDate ? `期限：${profile.targetDate}。` : ''}高タンパク・適度な糖質で満腹感を意識。`;
    else if (diff < -1) weightDirective = `増量フェーズ（現在${profile.currentWeight}kg→目標${profile.targetWeight}kg）。タンパク質・炭水化物をしっかり。`;
    else weightDirective = `体重維持フェーズ（現在${profile.currentWeight}kg、目標${profile.targetWeight}kg）。バランス重視。`;
  }

  const isRemaining = mode === 'remaining' && remaining;
  const isOneMeal = mode === 'one_meal';
  const oneMealPfcEstimate = isOneMeal && remaining
    ? {
        // 1食分の目安として、残りPFCを残りの食事数（最大1）で配分
        kcal: Math.max(200, Math.round(remaining.kcal * 0.85)),
        P: Math.max(10, Math.round(remaining.P * 0.85 * 10) / 10),
        F: Math.max(5, Math.round(remaining.F * 0.85 * 10) / 10),
        C: Math.max(20, Math.round(remaining.C * 0.85 * 10) / 10),
      }
    : null;

  const remainingBlock = isOneMeal && oneMealPfcEstimate
    ? `
【1食分の目安（残りPFCに合わせる）】※${targetMealType || '指定食事'} 1食でこの範囲に収める
- カロリー目安：${oneMealPfcEstimate.kcal} kcal以内
- タンパク質目安：${oneMealPfcEstimate.P} g前後
- 脂質目安：${oneMealPfcEstimate.F} g前後
- 炭水化物目安：${oneMealPfcEstimate.C} g前後

【今日の残り合計】${Math.round(remaining!.kcal)} kcal / P${Math.round(remaining!.P * 10) / 10}g / F${Math.round(remaining!.F * 10) / 10}g / C${Math.round(remaining!.C * 10) / 10}g
【今日すでに食べたもの】${Math.round(eaten?.kcal || 0)} kcal
${eatenItems && eatenItems.length > 0 ? `食べた料理：${eatenItems.slice(0, 6).join('、')}（同じ料理は避ける）` : ''}`
    : isRemaining
    ? `
【残りPFC（本日まだ食べられる量）】※この量に収まる献立を作る
- 残りカロリー：${Math.round(remaining!.kcal)} kcal
- 残りタンパク質：${Math.round(remaining!.P * 10) / 10} g
- 残り脂質：${Math.round(remaining!.F * 10) / 10} g
- 残り炭水化物：${Math.round(remaining!.C * 10) / 10} g

【今日すでに食べたもの】合計 ${Math.round(eaten?.kcal || 0)} kcal / P${Math.round((eaten?.P || 0) * 10) / 10}g / F${Math.round((eaten?.F || 0) * 10) / 10}g / C${Math.round((eaten?.C || 0) * 10) / 10}g
${eatenItems && eatenItems.length > 0 ? `食べた料理：${eatenItems.slice(0, 8).join('、')}（同じ料理は避けて被らないように）` : ''}`
    : `
【目標】※1日分の献立を作る
- カロリー：${goals.kcal} kcal
- タンパク質：${goals.P} g
- 脂質：${goals.F} g
- 炭水化物：${goals.C} g`;

  const referenceBlock = referenceMenu && referenceMenu.length > 0
    ? `

【顧客のマイメニュー】※可能なら以下から1〜2品を含める（顧客が常食している料理）
${referenceMenu.slice(0, 8).map((it) => `- ${it.name}${it.unit ? `（${it.unit}）` : ''}${typeof it.kcal === 'number' ? ` ${it.kcal}kcal` : ''}`).join('\n')}`
    : '';

  const profileBlock = weightDirective ? `\n\n【顧客の体型】${weightDirective}` : '';

  const ingredientsBlock = ingredients && ingredients.length > 0
    ? `\n\n【使う材料（顧客が選択）】※これらの材料を必ず使った献立にする（他の食材で補完してOK）
${ingredients.map((ing) => `- ${ing}`).join('\n')}`
    : '';

  const planScope = isOneMeal
    ? `指定された「${targetMealType || '指定食事'}」の1食を、バリエーション違いで3案提案（同じ料理を繰り返さない、別ジャンルを意識）`
    : isRemaining
    ? '残りPFCに収まる範囲で、献立案を3つ提案（バリエーション豊かに別の選択肢を）'
    : '朝食・昼食・夕食・間食の4食を提案';

  const prompt = `あなたは管理栄養士です。以下の条件で献立を作成してください。
${remainingBlock}${profileBlock}${referenceBlock}${ingredientsBlock}

【顧客の希望】
- 食事傾向：${preferences.dietType}
- 含めたい食材・テイスト：${preferences.preferIngredients || 'なし'}（指定があれば必ずどれか1食以上に反映する）
- 避けたい食材：${preferences.avoidIngredients || 'なし'}（指定があれば一切使用しない）
- 予算感：${preferences.budget}
- 調理時間：${preferences.cookTime}

【条件】
- ${planScope}
- ${isOneMeal ? `各案の type は必ず「${targetMealType || '昼食'}」（同じ食事区分）。3案とも別ジャンルの料理を提案` : isRemaining ? '各献立はそれぞれ別の料理（同じ料理を繰り返さない）。typeは「提案1」「提案2」「提案3」または料理に合った食事区分（朝食/昼食/夕食/間食）' : '各食事は具体的な料理名と食材リスト・分量'}
- 合計が${isOneMeal ? '各案ともに1食分の目安' : isRemaining ? '各案ともに残りPFC' : '目標'}カロリー±50kcal以内、PFC各±10g以内に収まるように
- itemsには「鶏むね肉100g」「玄米120g」のように分量付きで列挙
- adviceは100文字程度で「この献立のポイント」をまとめる（${isOneMeal ? '3つの選択肢の使い分けや栄養面の特徴' : isRemaining ? '3つの提案の使い分けや栄養バランス' : weightDirective ? '体重目標を踏まえる' : 'バランス重視'}）

【JSON出力の絶対ルール】
- 数値は単位なしの純粋な数値だけ書く（例: "kcal": 350 ※「350kcal」「350g」とは絶対書かない）
- 各プロパティの値の直後にカンマを忘れない
- 文字列はダブルクォートで囲む
- コメント・補足文・マークダウン記号は一切書かない
- JSON以外の文章は1文字も付けない

【出力JSON形式（必ずこの形式）】
{
  "meals": [
    { "type": "朝食", "title": "...", "items": ["...", "..."], "kcal": 数値, "P": 数値, "F": 数値, "C": 数値, "cookTime": "10分", "note": "..." },
    { "type": "昼食", "title": "...", "items": [...], "kcal": ..., "P": ..., "F": ..., "C": ..., "cookTime": "...", "note": "..." },
    { "type": "夕食", "title": "...", "items": [...], "kcal": ..., "P": ..., "F": ..., "C": ..., "cookTime": "...", "note": "..." },
    { "type": "間食", "title": "...", "items": [...], "kcal": ..., "P": ..., "F": ..., "C": ..., "cookTime": "...", "note": "..." }
  ],
  "totals": { "kcal": ..., "P": ..., "F": ..., "C": ... },
  "advice": "..."
}`;

  const mealSchema = {
    type: 'object',
    properties: {
      meals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
            kcal: { type: 'integer' },
            P: { type: 'number' },
            F: { type: 'number' },
            C: { type: 'number' },
            cookTime: { type: 'string' },
            note: { type: 'string' },
          },
          required: ['type', 'title', 'items', 'kcal', 'P', 'F', 'C', 'cookTime', 'note'],
        },
      },
      totals: {
        type: 'object',
        properties: {
          kcal: { type: 'integer' },
          P: { type: 'number' },
          F: { type: 'number' },
          C: { type: 'number' },
        },
        required: ['kcal', 'P', 'F', 'C'],
      },
      advice: { type: 'string' },
    },
    required: ['meals', 'totals', 'advice'],
  };

  const text = await callGeminiStructured([{ text: prompt }], apiKey, mealSchema);
  return parseMealPlanJson(text);
}

function repairLlmJson(raw: string): string {
  let s = raw;
  // {...} 部分だけ抽出
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    s = s.slice(start, end + 1);
  }
  // 値の後に単位がついた数値を除去：「350kcal」「12g」「23.5g」など → 350 / 12 / 23.5
  s = s.replace(/:\s*(\d+(?:\.\d+)?)\s*(?:kcal|kj|g|ml|L|個|本|杯|分|時間|秒|円)\s*([,}\]])/gi, ': $1$2');
  // 数値直後にコメント風の説明: 「150 (約)」 のような括弧を除去
  s = s.replace(/:\s*(\d+(?:\.\d+)?)\s*\([^)]*\)\s*([,}\]])/g, ': $1$2');
  // 末尾の余分なカンマ: ,} や ,] を修正
  s = s.replace(/,(\s*[}\]])/g, '$1');
  // 行コメント // ... を除去
  s = s.replace(/\/\/[^\n]*/g, '');
  // ブロックコメント /* ... */ を除去
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // 文字列内のシングルクォートをダブルクォートに（オブジェクトキー側のみ）
  // ※値内のシングルクォートは触らない
  s = s.replace(/(\{|,)\s*'([\w$]+)'\s*:/g, '$1"$2":');
  return s.trim();
}

function parseMealPlanJson(text: string): DailyMealPlan {
  const cleaned = stripMarkdown(text);
  let parsed: Record<string, unknown> | null = null;
  // 1. 素直にパース
  try {
    parsed = JSON.parse(cleaned);
  } catch {}
  // 2. 自前の修復ロジック
  if (!parsed) {
    try {
      parsed = JSON.parse(repairLlmJson(cleaned));
    } catch {}
  }
  // 3. {...} だけ抽出
  if (!parsed) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {}
    }
  }
  // 4. jsonrepair（強力な汎用リペア）
  if (!parsed) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { jsonrepair } = require('jsonrepair');
      parsed = JSON.parse(jsonrepair(cleaned));
    } catch {}
  }
  if (!parsed) {
    // デバッグのために生のレスポンスを含める（最初の300文字）
    throw new Error(
      `AIの返答からJSONを取り出せませんでした。\n生レスポンス: ${cleaned.slice(0, 300)}`
    );
  }
  const mealsRaw = Array.isArray(parsed.meals) ? parsed.meals : [];
  const meals = mealsRaw
    .map((m) => {
      const item = m as Record<string, unknown>;
      const itemsArr = Array.isArray(item.items) ? item.items : [];
      return {
        type: String(item.type ?? '') as '朝食' | '昼食' | '夕食' | '間食',
        title: String(item.title ?? ''),
        items: itemsArr.map((i) => String(i)),
        kcal: Math.round(Number(item.kcal ?? 0)),
        P: Math.round(Number(item.P ?? 0) * 10) / 10,
        F: Math.round(Number(item.F ?? 0) * 10) / 10,
        C: Math.round(Number(item.C ?? 0) * 10) / 10,
        cookTime: String(item.cookTime ?? ''),
        note: String(item.note ?? ''),
      };
    })
    .filter((m) => m.title && ['朝食', '昼食', '夕食', '間食'].includes(m.type));

  const totalsRaw = (parsed.totals as Record<string, unknown>) || {};
  const totals = {
    kcal: Math.round(Number(totalsRaw.kcal ?? meals.reduce((s, m) => s + m.kcal, 0))),
    P: Math.round(Number(totalsRaw.P ?? meals.reduce((s, m) => s + m.P, 0)) * 10) / 10,
    F: Math.round(Number(totalsRaw.F ?? meals.reduce((s, m) => s + m.F, 0)) * 10) / 10,
    C: Math.round(Number(totalsRaw.C ?? meals.reduce((s, m) => s + m.C, 0)) * 10) / 10,
  };
  return {
    meals,
    totals,
    advice: String(parsed.advice ?? ''),
  };
}

async function callGeminiStructured(
  parts: Array<Record<string, unknown>>,
  apiKey: string,
  schema: Record<string, unknown>
): Promise<string> {
  const models = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];
  let lastError = '';
  for (const model of models) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: NUTRITION_SYSTEM }] },
            contents: [{ parts }],
            generationConfig: {
              maxOutputTokens: 4096,
              temperature: 0.1,
              topP: 0.8,
              responseMimeType: 'application/json',
              responseSchema: schema,
              // 思考トークンを停止 → 応答速度2〜3倍、コスト削減
              thinkingConfig: { thinkingBudget: 0 },
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
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        const retriable = /\b(503|429|500|502|504)\b|overloaded|UNAVAILABLE|high demand/i.test(lastError);
        if (!retriable) throw e;
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }
  throw new Error(`Gemini APIに接続できません: ${lastError}`);
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
        // 思考トークンを停止 → 応答速度2〜3倍、コスト削減
        thinkingConfig: { thinkingBudget: 0 },
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
