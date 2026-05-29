// PFC 補正係数のデフォルト値（テナント別の係数が指定されない場合のフォールバック）
// テナント別の係数は lib/tenantResolver.getApplicableCalibration() で解決され、
// analyzeImagesPfc / analyzeTextPfc の calibration 引数で渡される。
export const DEFAULT_PFC_CALIBRATION = { P: 1.0, F: 1.0, C: 1.0 };
export type PfcCalibration = { P: number; F: number; C: number };

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
  supplementText: string | null,
  previousItems?: Array<{ name: string; P: number; F: number; C: number }> | null,
  calibration: PfcCalibration = DEFAULT_PFC_CALIBRATION
): Promise<Pfc> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');
  if (images.length === 0) throw new Error('画像が指定されていません');

  const explicit = hasExplicitQuantity(supplementText);

  // メモがある場合は常に単一AIコールで処理（写真+メモを一緒に解析）
  // → ダブルカウント（メモが写真の食材を描写する場合の重複計算）を防止
  if (supplementText) {
    return analyzeImagesSingleCall(images, supplementText, explicit, previousItems || null, calibration);
  }

  // 複数枚（メモなし）→ 並列解析で高速化（各皿は別物として合算）
  if (images.length > 1) {
    return analyzeImagesParallel(images, null, calibration);
  }

  return analyzeImagesSingleCall(images, null, false, null, calibration);
}

async function analyzeImagesParallel(
  images: Array<{ base64: string; mimeType: string }>,
  supplementText: string | null,
  calibration: PfcCalibration
): Promise<Pfc> {
  // バッチ単位で並列解析（同時実行数を制限してレート制限を回避）
  const results: Pfc[] = [];
  for (let i = 0; i < images.length; i += PARALLEL_BATCH_SIZE) {
    const batch = images.slice(i, i + PARALLEL_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((img) => analyzeImagesSingleCall([img], supplementText, false, null, calibration))
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
  explicit: boolean,
  previousItems: Array<{ name: string; P: number; F: number; C: number }> | null,
  calibration: PfcCalibration
): Promise<Pfc> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const isCorrection =
    !!previousItems && previousItems.length > 0 && !!supplementText && supplementText.includes('【AI解析の補正】');

  const correctionLine = isCorrection
    ? `\n\n【補正モード（前回解析の差分更新）】
前回の解析結果（アンカー）：
${previousItems!.map((it, i) => `${i + 1}. ${it.name}（P${it.P}/F${it.F}/C${it.C}g）`).join('\n')}

処理ルール（厳守）：
1. 補正テキストで明示的に言及されたアイテムだけを更新する（名前を差し替える / PFC を調整する）
2. 補正テキストで言及されていないアイテムは、前回の name と PFC を **そのまま** items 配列に維持する
   - 写真を見直して数値を「より正確に」変えてはいけない
   - 名前の表記揺れも避ける（前回が「鮭フレーク 30g」なら、補正対象でない限り「鮭フレーク 30g」のまま）
3. 補正テキストで「3番」「2つ目」など番号指定があれば、その index のアイテムを対象とする
4. 補正テキストでアイテム名が指定されていれば（例：「鮭フレークは明太子」）、最も近い名前のアイテムを差し替える
5. items 配列の数と順序は、補正テキストで追加/削除が指示されない限り、前回と同じに保つ
6. 補正テキストが「店名・購入場所・食事の状況」を述べた補足（例：「サイゼリヤです」「外食でした」「コンビニで買った」「自炊です」「テイクアウト」）の場合：
   - その文言自体を items に新しいアイテムとして追加してはいけない（店名・場所・状況は料理名ではない）
   - 既存アイテムの公式栄養成分値・分量推定を精緻化するヒントとしてのみ使う
   - 例：補正「サイゼリヤです」→ items の各料理をサイゼリヤの公式メニュー成分に寄せて PFC を調整する（アイテム数・名前は変えない）
7. items にアイテムを「追加」してよいのは、補正テキストに具体的な料理名の追加申告がある場合のみ（例：「味噌汁も食べた」「サラダを追加して」）。店名・場所・感想・食事状況の説明は追加申告に当たらない
`
    : '';

  const supplementLine = supplementText
    ? explicit
      ? `\n\n【写真主体・メモは参考値】
顧客メモ：${supplementText}

処理ルール（厳守）：
1. **写真を主たる推定ソース**として使う。画像認識のほうが実測に近く、信用度が高い
2. メモは「補助情報」として扱う。以下の場合のみ採用する：
   - **写真に映っていない料理の追加申告** → items に追加（例：メモ「味噌汁も食べた」、写真には映ってない → 追加）
   - **修飾語**（「ノンオイル」「砂糖少なめ」「大盛り」「半分」等）→ 写真から推定した量・成分を増減
   - **商品名・チェーン店名**（「マック」「松屋」「サイゼ」等）→ 公式栄養成分値のヒントに利用
3. **メモに量が書かれていても（「100g」「1杯」「3個」等）、それは「参考値」**：
   - 写真の見た目と近い場合 → メモ値を採用してよい
   - 写真の見た目と明確にずれている場合 → **写真を優先**（メモは無視）
   - 例：メモ「ご飯150g」、写真は少なめのご飯 → 写真の量で推定（メモの150gは不採用）
4. **写真とメモが矛盾する場合は写真を優先**（顧客の申告より実物の見た目を信用）

例1：メモ「白米150g」+ 写真に「白米・味噌汁・唐揚げ」（白米は写真と近い量）
→ items: [{白米 150g（写真の量とメモが近いので採用）}, {味噌汁 1杯（写真）}, {唐揚げ 3個（写真）}]

例2：メモ「白米150g」+ 写真に少量のご飯（明らかに 100g 未満）
→ items: [{白米 80g（写真の量を優先、メモの150gは不採用）}, ...]

例3：メモ「鶏むね肉100g」+ 写真に「チョコケーキ」のみ
→ items: [{鶏むね肉 100g（写真に映ってないので追加申告として採用）}, {チョコケーキ 1個（写真）}]
→ 写真にないものの追加申告は採用する`
      : `\n\n【写真主体・メモは参考情報】
顧客メモ：${supplementText}

写真を主たる推定ソースとし、メモは補助情報として扱う：
1. 写真に写っている料理を主に推定する（実測値に近いため）
2. メモに「写真に映っていない料理」が書かれていれば、items配列に追加する
   - 例：写真に丼物だけ→メモ「味噌汁とサラダも食べた」なら、items に味噌汁・サラダを追加
   - 撮り忘れた料理を補完するための文章が来ることが多い
3. メモの修飾表現（大盛り/少なめ/半分/2倍/○○抜き/ノンオイル/低糖質/無糖 等）は写真から推定した量から増減して反映する
   - 例：「大盛り」→ 写真の量の1.5倍、「少なめ」→ 0.7倍、「半分」→ 0.5倍
   - 例：「ノンオイル」「油抜き」→ 脂質(F)を大幅に下げる
   - 例：「マヨ抜き/ドレッシング抜き」→ その分の脂質を加算しない
4. メモに「写真に映っていない調味料・隠し味」（ドレッシング、マヨネーズ、ソース等）が書かれていれば、その分を加算する
5. メモに料理の固有名詞（チェーン店名・商品名）が書かれていれば、公式栄養成分値を優先採用する
6. **写真とメモが矛盾する場合は写真を優先**（実物の見た目を信用）`
    : '';

  const multiNotice =
    images.length > 1
      ? '\n複数枚の写真は1食を構成する別々の皿/料理です（コース料理など）。各写真の内容をそれぞれ推定し、合算して1食分のPFCを算出してください。'
      : '';

  const accuracyRule = explicit
    ? '- 写真の見た目を主体に推定し、メモの量明示（「100g」「1杯」等）は参考値として扱う。写真の量と近ければメモ値を採用、ずれていれば写真の量を優先する'
    : supplementText
    ? '- 写真の見た目を主体に推定し、メモの修飾表現（大盛り/少なめ/抜き/ノンオイル等）で増減する'
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
- 識別が難しい場合でも「不明な料理」ではなく「洋菓子と思われるもの」など推測可能な名前を入れる

【絶対禁止：合計・全体まとめエントリの作成】
- ❌ 個別アイテムと合計アイテムを両方含めることは絶対禁止（ダブルカウントの原因）
- ❌ NG例：["ハム&チーズ 2個", "サラダ 1皿", "温泉卵 1個", "ハム&チーズ+サラダ+温泉卵"]
  → 最後の"合計"エントリは作らない
- ❌ NG例：複数の料理名をスペース・カンマ・「+」で繋いだ単一エントリ
  例：「ハム&チーズ サラダ 温泉卵 1杯」「ラーメン+餃子」←これは禁止
- ✅ OK例：単一料理または単一商品のみ。"items"内の各 name に他の name が含まれないこと
- ✅ 1食=1料理なら items は1要素のみ
- ✅ 定食やコースで複数料理なら、各料理を分けて並べる（合計は別途算出しない）

【items 一意性チェック】
- 各 item の name は他の name の部分文字列であってはならない
- 例: name="温泉卵" と name="温泉卵 ふわラテ" は禁止（後者は前者を含むため）${supplementLine}${correctionLine}

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
  return parsePfcJson(text, calibration);
}

export async function analyzeTextPfc(
  textDesc: string,
  calibration: PfcCalibration = DEFAULT_PFC_CALIBRATION
): Promise<Pfc> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const prompt = `以下の食事内容のPFC（タンパク質・脂質・炭水化物）を栄養学の標準値で計算してください。

【重量解釈ルール（最重要）】
- 穀類（玄米・白米・ご飯・麦飯等）の重量表記は「炊飯後の重量」として解釈する。「生米」と明記されていない限り炊いた状態の重さ
  例：玄米80g（炊飯後）= P 2.2g/F 0.5g/C 28g、白米(ご飯)150g = P 3.8g/F 0.5g/C 55g
- 味噌汁はデフォルトで汁椀1杯（味噌10g・出汁150ml・具材合計50-80g）として計算する
  例：味噌汁（豆腐50g・わかめ）= P 3g/F 1.5g/C 4g / 約50kcal
- 納豆1パックは40g（標準サイズ）として計算する
  例：納豆1パック(40g) = P 6.6g/F 4g/C 4.8g
- 卵料理（オムレツ・炒り卵等）で油が未指定の場合はオリーブオイル5g（小さじ1強）を想定する
- 炒め物・ソテーで油が未指定の場合はサラダ油5gを想定する
- 料理に「牛乳」が含まれ量が未指定の場合：飲み物なら200ml、料理用（オムレツ等）なら大さじ1=15mlを想定する
  例：オムレツ（卵1個・オリーブオイル5g・牛乳大さじ1）= P 6.5g/F 11g/C 1g

【計算ルール】
- 量が明示されている食材は、日本食品標準成分表の標準値で算出する
  例：鶏むね肉(皮なし)100g = P 23g/F 1.5g/C 0g
- 量が未指定の食材は、家庭料理として常識的な「少なめ〜標準」の範囲で見積もる
- 過大な大盛り想定は避ける（味噌汁なら一般的な汁椀1杯、ご飯なら茶碗1杯=150g程度）
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
  return parsePfcJson(text, calibration);
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

// 体重履歴に線形回帰を適用してトレンドを算出
function calcWeightTrend(weightHistory: Array<{ date: string; weight: number }>): {
  slopeKgPerDay: number;
  monthlyChange: number;
  rSquared: number;
  predicted90: number;
} {
  const n = weightHistory.length;
  if (n < 2) {
    const w = n === 1 ? weightHistory[0].weight : 0;
    return { slopeKgPerDay: 0, monthlyChange: 0, rSquared: 0, predicted90: w };
  }
  // 日付を最初の日からの経過日数に変換
  const t0 = new Date(weightHistory[0].date).getTime();
  const points = weightHistory.map((w) => ({
    x: (new Date(w.date).getTime() - t0) / 86_400_000, // 日
    y: w.weight,
  }));
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let numer = 0;
  let denom = 0;
  for (const p of points) {
    numer += (p.x - meanX) * (p.y - meanY);
    denom += (p.x - meanX) ** 2;
  }
  const slope = denom === 0 ? 0 : numer / denom; // kg/day
  const intercept = meanY - slope * meanX;

  // R二乗
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => {
    const predY = slope * p.x + intercept;
    return s + (p.y - predY) ** 2;
  }, 0);
  const rSquared = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  // 最終測定日からさらに 90 日後の予測
  const lastX = points[n - 1].x;
  const lastWeight = points[n - 1].y;
  const predicted90 = lastWeight + slope * 90;
  const monthlyChange = slope * 30;
  return { slopeKgPerDay: slope, monthlyChange, rSquared, predicted90 };
}

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

  // 参考データ：線形回帰トレンド（30日全体）
  const trend = calcWeightTrend(weightHistory);
  // 参考データ：直近7日のサブトレンド（短期傾向）
  const last7 = weightHistory.slice(-7);
  const trend7 = last7.length >= 2 ? calcWeightTrend(last7) : trend;
  // カロリー収支から推定する月間体重変化（脂肪 1kg ≒ 7,200 kcal）
  const dailyDeficit = goalKcal - avgKcal;
  const kcalBasedMonthlyChange = -((dailyDeficit * 30) / 7200);

  // 信頼度メトリクスを事前計算
  const nPoints = weightHistory.length;
  const observationDays = nPoints >= 2
    ? Math.round(
        (new Date(weightHistory[nPoints - 1].date).getTime() -
          new Date(weightHistory[0].date).getTime()) /
          86_400_000
      ) + 1
    : 0;
  const measureFrequency = observationDays > 0 ? nPoints / observationDays : 0; // 日数あたり測定回数
  // 短期 vs 長期トレンド一致度（差が小さいほど高信頼）
  const trendDivergence = Math.abs(trend.monthlyChange - trend7.monthlyChange);
  // カロリー収支ベース vs 実測トレンドの一致度
  const kcalVsActualDivergence = Math.abs(trend.monthlyChange - kcalBasedMonthlyChange);

  // 信頼度の決定論的算出（AI が同じ判断をするための明確な基準）
  let confidenceLevel: 'high' | 'medium' | 'low';
  const isHigh =
    observationDays >= 21 &&
    nPoints >= 12 &&
    trend.rSquared >= 0.5 &&
    trendDivergence <= 1.5 &&
    measureFrequency >= 0.5;
  const isMedium =
    observationDays >= 14 &&
    nPoints >= 7 &&
    trend.rSquared >= 0.25 &&
    trendDivergence <= 2.5;
  if (isHigh) confidenceLevel = 'high';
  else if (isMedium) confidenceLevel = 'medium';
  else confidenceLevel = 'low';

  const weightTrendStr = weightHistory
    .map((w) => `${w.date}: ${w.weight}kg`)
    .join('\n  ');

  const targetInfo =
    targetWeight && targetDate
      ? `\n【目標】\n- 目標体重: ${targetWeight}kg\n- 目標達成日: ${targetDate}`
      : '\n【目標】未設定';

  const prompt = `あなたは経験 15 年のパーソナルトレーナー兼管理栄養士です。
顧客の食事・運動・体重データを総合的に判断して、3ヶ月後の体重を予測してください。

【顧客データ】
- 現在体重: ${currentWeight ?? '不明'} kg
- 体重推移（${weightHistory.length}日分の実測値）:
  ${weightTrendStr || '（データなし）'}
- 平均カロリー摂取（直近30日）: ${avgKcal} kcal/日
- 目標カロリー: ${goalKcal} kcal/日（差分: ${dailyDeficit > 0 ? '+' : ''}${dailyDeficit} kcal/日）
- 平均PFC: P${avgP}g / F${avgF}g / C${avgC}g
- 運動日数: ${exerciseDays}日 / 30日${targetInfo}

【参考：機械的計算（盲信しないでください）】
- 30日トレンドの線形外挿（90日後）: ${trend.predicted90.toFixed(1)} kg（月平均 ${(trend.monthlyChange).toFixed(2)} kg/月、R²=${trend.rSquared.toFixed(2)}）
- 直近7日の傾き: 月換算 ${(trend7.monthlyChange).toFixed(2)} kg/月
- カロリー収支による推定: 月 ${kcalBasedMonthlyChange.toFixed(2)} kg

【信頼度メトリクス（コードで決定済み: ${confidenceLevel}）】
- 観測期間: ${observationDays}日
- 測定回数: ${nPoints}回（頻度 ${measureFrequency.toFixed(2)} 回/日）
- 短期 vs 長期トレンド乖離: ${trendDivergence.toFixed(2)} kg/月
- カロリー収支 vs 実測乖離: ${kcalVsActualDivergence.toFixed(2)} kg/月

【予測する上で必ず考慮すべき生理学的事実】
1. **減量開始の最初の1〜2週間は水分・グリコーゲンの減少が大きい**
   - 初期に 1〜2kg 減ってもそれを線形に外挿してはいけない
   - 例：1週間で 2kg 減 → そのまま 3ヶ月で 25kg 減るわけではない
2. **持続可能な脂肪減ペース上限**
   - 健康的減量: 体重の 0.5〜1.0% /週 が上限（例：80kg なら 週400-800g）
   - 月換算で 2〜3.5kg を超える減量予測は非現実的
3. **代謝適応（メタボリックアダプテーション）**
   - 減量を続けると BMR が下がり、減量ペースが鈍化する
   - カロリー収支の単純計算より、実際の減量ペースは 60〜80% 程度に留まる
4. **増量側も同様**
   - 急な体重増加は水分・グリコーゲン・腸内容物の影響が大きい
5. **データの信頼性**
   - 体重測定が週1-3回程度で 2-3 週分しかない場合、トレンドはノイジー
   - 30日全体トレンドと直近7日が大きく乖離している場合、最近の変化は短期ノイズの可能性が高い

【判断の方針】
- まず実測トレンド（30日 vs 直近7日）と理論値（カロリー収支）を見比べる
- 短期の急変は割り引く
- 0.5〜1.0% /週 を超える変化が出ている場合、3ヶ月後はそれより緩やかになると予測
- 信頼度は上記のメトリクスからコード側で既に判定済み（${confidenceLevel}）。これを採用してください
- 月 3kg 以上の極端な変化を予測してはいけない（健康的減量・増量の範囲を超える）

【出力JSON形式（必ずこの形式）】
{
  "predictedWeight": 3ヶ月後の予測体重(kg)数値（小数1桁）,
  "monthlyChange": 月平均の体重変化(kg/月)数値（減量はマイナス、月3kg超は禁止）,
  "confidenceLevel": "high" | "medium" | "low",
  "willReachGoal": 目標体重を期限内に達成できるかtrue/false（目標未設定ならnull）,
  "comment": "プロのトレーナーとして30文字以内で総評",
  "recommendations": ["具体的アドバイス1", "具体的アドバイス2", "具体的アドバイス3"]
}`;

  const text = await callGemini([{ text: prompt }], apiKey);
  const raw = parseWeightPredictionJson(text);

  // セーフティ：常識外れの値をクリップ
  const last = weightHistory[weightHistory.length - 1]?.weight ?? currentWeight ?? raw.predictedWeight;
  const MAX_MONTHLY_CHANGE = 3.0; // kg/月
  const clippedMonthly = Math.max(-MAX_MONTHLY_CHANGE, Math.min(MAX_MONTHLY_CHANGE, raw.monthlyChange));
  // monthlyChange と predictedWeight に矛盾があれば monthlyChange を優先
  const expectedPredicted = last + clippedMonthly * 3;
  const predictedClipped = Math.abs(raw.predictedWeight - expectedPredicted) > 1
    ? Math.round(expectedPredicted * 10) / 10
    : raw.predictedWeight;

  return {
    ...raw,
    monthlyChange: Math.round(clippedMonthly * 10) / 10,
    predictedWeight: predictedClipped,
    confidenceLevel,
  };
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
- 箇条書きを使う場合は3項目程度に留める
- マークダウン記法（**太字**、*斜体*、# 見出し、--- 区切り線など）は絶対に使わない。プレーンテキストのみで回答する`;

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
  // items の各 PFC にも calibration を適用（合計と表示値の整合性を維持）
  const items = Array.isArray(parsed.items)
    ? (parsed.items as Array<Record<string, unknown>>).map((it) => ({
        name: String(it.name ?? ''),
        P: f1(Number(it.P ?? 0) * calibration.P),
        F: f1(Number(it.F ?? 0) * calibration.F),
        C: f1(Number(it.C ?? 0) * calibration.C),
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

// === 顧客分析（管理画面用） ============================================
export type CoachingAnalysis = {
  summary: string; // 全体総評（2-3文）
  strengths: string[]; // 良い点 1-3個
  concerns: string[]; // 懸念点 1-3個
  patterns: string[]; // 食事パターン特徴 1-3個
  recommendations: string[]; // 具体的な提案 2-4個
  improvements: string[]; // 改善点（具体アクション） 3-5個
  foodAdvice: string[]; // 食材・栄養アドバイス（食物繊維・発酵食品等） 3-5個
  actionPlan: string[]; // 来週のアクションプラン 3個
  reportDraft: string; // 顧客に送るレポート文ドラフト（5-10行）
};

export async function generateCoachingAnalysis(input: {
  customerName: string;
  goals: { kcal: number; P: number; F: number; C: number };
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  recordsSummary: string; // 過去30日のサマリー（テキスト）
  rangeLabel: string; // 例: "2026-04-15 〜 2026-05-14"
  foodList?: string; // 最頻出食材リスト（カンマ区切り）
}): Promise<CoachingAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

  const goalWeightStr =
    input.targetWeight !== null
      ? `${input.targetWeight}kg（${input.targetDate || '期限未設定'}まで）`
      : '未設定';
  const currentWeightStr = input.currentWeight !== null ? `${input.currentWeight}kg` : '未測定';
  const foodListSection = input.foodList ? `\n【食材一覧（頻出順）】\n${input.foodList}` : '';

  const prompt = `あなたはプロのパーソナルトレーナー兼栄養士です。以下の顧客データを分析し、コーチング視点で評価とアドバイスを生成してください。

【顧客プロフィール】
- 氏名：${input.customerName}
- 期間：${input.rangeLabel}
- 1日目標：${input.goals.kcal}kcal / P${input.goals.P}g / F${input.goals.F}g / C${input.goals.C}g
- 現在体重：${currentWeightStr}
- 目標体重：${goalWeightStr}

【期間中の記録サマリー】
${input.recordsSummary}${foodListSection}

【出力ルール】
- 厳しく数字で評価する。「順調です」「頑張りましょう」のような曖昧な言葉だけで終わらない
- concerns は数値ベースで指摘（例: 「カロリー目標未達 15% / 脂質目標 130% で過剰」）
- improvements は具体アクション（例: 「タンパク質を毎食 20g 確保するため、鶏胸肉・卵・豆類を毎食1品」）
- foodAdvice は食材バリエーション・不足栄養素・食物繊維・発酵食品を具体的に（例: 「海藻・きのこ・ごぼうを1日1品追加で食物繊維+5g」「ヨーグルト・納豆・キムチで腸内環境改善」）
- actionPlan は来週から実行できる具体行動3つ
- reportDraft は顧客に直接送る文体（〜です／〜ます調、敬体）。具体的な数字を含める

JSON形式で返してください：
{
  "summary": "（2-3文の総評）",
  "strengths": ["（強み1）", "（強み2）"],
  "concerns": ["（数値ベースの懸念1）", "（懸念2）"],
  "patterns": ["（パターン1）"],
  "recommendations": ["（提案1）", "（提案2）"],
  "improvements": ["（具体アクション1）", "（具体アクション2）", "（具体アクション3）"],
  "foodAdvice": ["（食材・栄養アドバイス1）", "（食材・栄養アドバイス2）", "（食物繊維・発酵食品アドバイス）"],
  "actionPlan": ["（来週のアクション1）", "（来週のアクション2）", "（来週のアクション3）"],
  "reportDraft": "（顧客に直接送る本文。改行可。500文字程度）"
}`;

  const text = await callGemini([{ text: prompt }], apiKey);
  const cleaned = stripMarkdown(text);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    try {
      parsed = JSON.parse(repairLlmJson(cleaned));
    } catch {
      throw new Error('分析JSON解析失敗: ' + cleaned.slice(0, 200));
    }
  }
  const toStringArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)) : [];
  return {
    summary: String(parsed.summary || ''),
    strengths: toStringArr(parsed.strengths),
    concerns: toStringArr(parsed.concerns),
    patterns: toStringArr(parsed.patterns),
    recommendations: toStringArr(parsed.recommendations),
    improvements: toStringArr(parsed.improvements),
    foodAdvice: toStringArr(parsed.foodAdvice),
    actionPlan: toStringArr(parsed.actionPlan),
    reportDraft: String(parsed.reportDraft || ''),
  };
}


/** レポートテンプレ内の {ai_*} 変数を AI で個別に埋めるための関数 */
export async function generateReportComments(input: {
  customerName: string;
  date: string;
  sum: { kcal: number; P: number; F: number; C: number };
  goals: { kcal: number; P: number; F: number; C: number };
  currentWeight: number | null;
  targetWeight: number | null;
  requiredKeys: string[]; // 例: ["ai_good_points", "ai_advice"]
  mealItems?: Array<{ mealType: string; name: string }>; // 食事内容（食事区分 + 料理名）
}): Promise<Record<string, string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 未設定");
  if (input.requiredKeys.length === 0) return {};

  // 各 AI 変数の意味（プロンプトで AI に伝える）
  const DESCS: Record<string, string> = {
    ai_summary: "全体の評価を2文で。達成状況と今日の食事の特徴を踏まえて総括する",
    ai_good_points: "良かった点を1-2点、箇条書きで具体的に（食べた料理名・数字を引用して）",
    ai_advice: "実際に食べたものを踏まえた具体的アドバイスを2〜3文で。何をどう変えるか明示する（例：夕食の揚げ物を焼き物に / 昼にタンパク質を追加）。ただし冗長にならない",
    ai_one_word: "応援の一言メッセージ（1行、明るく前向き）",
    ai_keep_doing: "続けてほしいことを1点。食事内容に言及して具体的に",
    ai_improvement: "改善ポイントを1点。実際に食べたものと紐付けて具体的に",
  };

  const desc = input.requiredKeys
    .map((k) => `- ${k}: ${DESCS[k] || "2〜3文で適切なコメント。実際の食事内容に言及して具体的に"}`)
    .join("\n");

  const weightStr = input.currentWeight !== null ? `${input.currentWeight}kg` : "未測定";
  const targetWStr = input.targetWeight !== null ? `${input.targetWeight}kg` : "未設定";
  const ratio = input.goals.kcal > 0 ? Math.round((input.sum.kcal / input.goals.kcal) * 100) : 0;

  // 食事区分別にグループ化
  let mealSection = "";
  if (input.mealItems && input.mealItems.length > 0) {
    const groups: Record<string, string[]> = {};
    for (const item of input.mealItems) {
      if (!groups[item.mealType]) groups[item.mealType] = [];
      groups[item.mealType].push(item.name);
    }
    const ORDER = ["朝食", "昼食", "夕食", "間食"];
    const lines = ORDER
      .filter((t) => groups[t])
      .map((t) => `${t}: ${groups[t].join(" / ")}`);
    // ORDER に含まれない区分も追加
    for (const [t, names] of Object.entries(groups)) {
      if (!ORDER.includes(t)) lines.push(`${t}: ${names.join(" / ")}`);
    }
    mealSection = `\n【食事内容】\n${lines.join("\n")}`;
  } else {
    mealSection = "\n【食事内容】記録なし（食事の記録がない日です。記録を促す方向でコメントしてください）";
  }

  const prompt = `あなたはパーソナルトレーナーです。以下の顧客データを元に、レポートの各コメントセクションを書いてください。

【顧客】${input.customerName}さん
【日付】${input.date}
【摂取】${input.sum.kcal}kcal / P${input.sum.P}g / F${input.sum.F}g / C${input.sum.C}g
【目標】${input.goals.kcal}kcal / P${input.goals.P}g / F${input.goals.F}g / C${input.goals.C}g（達成率${ratio}%）
【体重】現在${weightStr} → 目標${targetWStr}${mealSection}

【生成してほしいセクション】
${desc}

【出力ルール】
- JSON形式で、各キーに上記説明に沿った日本語の文章を入れる
- 敬体、トレーナー目線、優しく前向きに
- **食事内容に記録がある場合は必ず実際の料理名・食材名を1つ以上引用してコメントする**（「今日は○○を食べられましたね」「△△が良い選択でした」など）
- ai_advice は「具体的な指摘 + 次の一手の提案」を2〜3文でまとめる。冗長にしない
- 箇条書き指定ありなら「・」で始める
- 絵文字は控えめに（必要なら1個まで）

出力例:
{
${input.requiredKeys.map((k) => `  "${k}": "..."`).join(",\n")}
}`;

  const text = await callGemini([{ text: prompt }], apiKey);
  const cleaned = stripMarkdown(text);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    try {
      parsed = JSON.parse(repairLlmJson(cleaned));
    } catch {
      throw new Error("AIコメントJSON解析失敗: " + cleaned.slice(0, 200));
    }
  }
  const result: Record<string, string> = {};
  for (const k of input.requiredKeys) {
    result[k] = String(parsed[k] ?? "").trim();
  }
  return result;
}
