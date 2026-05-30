import { NextRequest, NextResponse } from 'next/server';
import { withAdminTenant } from '@/lib/withTenant';
import { getCurrentTenant } from '@/lib/tenant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

type BodyCompAnalysisResult = {
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  bodyFatMassKg: number | null;
  bodyWaterPct: number | null;
  bmi: number | null;
  basalMetabolicKcal: number | null;
  visceralFatLevel: number | null;
  skeletalMuscleMassKg: number | null;
  rightArmMuscleKg: number | null;
  leftArmMuscleKg: number | null;
  rightLegMuscleKg: number | null;
  leftLegMuscleKg: number | null;
  trunkMuscleKg: number | null;
  device: string | null;
};

function stripMarkdown(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function safeNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function safeStr(v: unknown, allowed: string[]): string | null {
  if (typeof v !== 'string' || v === '') return null;
  return allowed.includes(v) ? v : 'その他';
}

export const POST = withAdminTenant(async (req: NextRequest) => {
  try {
    const contentType = req.headers.get('content-type') || '';
    const images: Array<{ base64: string; mimeType: string }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('photo_') && value instanceof File) {
          const buf = Buffer.from(await value.arrayBuffer());
          images.push({ base64: buf.toString('base64'), mimeType: value.type || 'image/jpeg' });
        }
      }
    } else {
      const body = await req.json();
      if (Array.isArray(body.images)) {
        for (const img of body.images) {
          if (img.base64 && img.mimeType) {
            images.push({ base64: img.base64, mimeType: img.mimeType });
          }
        }
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 });
    }

    const tenant = getCurrentTenant();
    const apiKey = tenant.geminiApiKey ?? process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY 未設定' }, { status: 500 });
    }

    const prompt = `あなたは体組成計の数値読み取り専門家です。写真に写っている体組成計・InBody等の測定結果から数値を正確に読み取り、JSONで返してください。

【読み取り対象】
- weightKg: 体重(kg) 数値のみ
- bodyFatPct: 体脂肪率(%) 数値のみ（「%」を除いた数値）
- muscleMassKg: 筋肉量(kg) 数値のみ
- bodyFatMassKg: 体脂肪量(kg) 数値のみ
- bodyWaterPct: 体水分率(%) 数値のみ
- bmi: BMI 数値のみ
- basalMetabolicKcal: 基礎代謝量(kcal) 数値のみ（「kcal」を除いた整数）
- visceralFatLevel: 内臓脂肪レベル 数値のみ
- skeletalMuscleMassKg: 骨格筋量(kg) 数値のみ
- rightArmMuscleKg: 右腕筋肉量(kg) 数値のみ
- leftArmMuscleKg: 左腕筋肉量(kg) 数値のみ
- rightLegMuscleKg: 右脚筋肉量(kg) 数値のみ
- leftLegMuscleKg: 左脚筋肉量(kg) 数値のみ
- trunkMuscleKg: 体幹筋肉量(kg) 数値のみ
- device: 測定機器の種類（"InBody" / "体組成計" / "体重計" / "その他" のいずれか）

【絶対ルール】
- 写真に写っていない・読み取れない項目は必ず null を返す（推測禁止）
- 単位を絶対に混同しない（%の項目にkgを入れない、kgの項目に%を入れない）
- 体脂肪率・体水分率は必ず % 単位の数値（例: 20.5）。絶対に kg にしない
- 体重・筋肉量・体脂肪量・骨格筋量・各部位筋肉量は必ず kg 単位の数値（例: 65.3）
- 基礎代謝は kcal 単位の整数（例: 1450）
- 数値は小数点1〜2桁まで（整数でも可）

【出力JSON形式のみ返す】
{
  "weightKg": 数値 or null,
  "bodyFatPct": 数値 or null,
  "muscleMassKg": 数値 or null,
  "bodyFatMassKg": 数値 or null,
  "bodyWaterPct": 数値 or null,
  "bmi": 数値 or null,
  "basalMetabolicKcal": 数値 or null,
  "visceralFatLevel": 数値 or null,
  "skeletalMuscleMassKg": 数値 or null,
  "rightArmMuscleKg": 数値 or null,
  "leftArmMuscleKg": 数値 or null,
  "rightLegMuscleKg": 数値 or null,
  "leftLegMuscleKg": 数値 or null,
  "trunkMuscleKg": 数値 or null,
  "device": "InBody" or "体組成計" or "体重計" or "その他" or null
}`;

    const parts: Array<Record<string, unknown>> = images.map((img) => ({
      inline_data: { mime_type: img.mimeType, data: img.base64 },
    }));
    parts.push({ text: prompt });

    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          // gemini-2.5-flash は既定で thinking が有効。思考トークンが maxOutputTokens を
          // 食い潰すと JSON が途中で切れて "Unterminated string" になるため明示的に無効化し、
          // 余裕を持たせる（複数枚＝項目増にも対応）。
          maxOutputTokens: 2048,
          temperature: 0.1,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API ${geminiRes.status}: ${errText.slice(0, 300)}`);
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!rawText) throw new Error('Gemini から空レスポンス');

    const cleaned = stripMarkdown(rawText);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // 余分な前置き等で素のparseが失敗した場合、最初の { から最後の } までを抽出して再試行
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      try {
        if (start === -1 || end === -1 || end <= start) throw new Error('no-json');
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // それでも壊れている（応答が途中で切れた等）場合は内部エラーを露出せず親切な文言を返す
        return NextResponse.json(
          { error: '写真の解析結果を読み取れませんでした。もう一度お試しください（鮮明な写真・1枚ずつ等）。' },
          { status: 502 }
        );
      }
    }

    const DEVICE_OPTIONS = ['InBody', '体組成計', '体重計', 'その他'];
    const result: BodyCompAnalysisResult = {
      weightKg: safeNum(parsed.weightKg),
      bodyFatPct: safeNum(parsed.bodyFatPct),
      muscleMassKg: safeNum(parsed.muscleMassKg),
      bodyFatMassKg: safeNum(parsed.bodyFatMassKg),
      bodyWaterPct: safeNum(parsed.bodyWaterPct),
      bmi: safeNum(parsed.bmi),
      basalMetabolicKcal: safeNum(parsed.basalMetabolicKcal),
      visceralFatLevel: safeNum(parsed.visceralFatLevel),
      skeletalMuscleMassKg: safeNum(parsed.skeletalMuscleMassKg),
      rightArmMuscleKg: safeNum(parsed.rightArmMuscleKg),
      leftArmMuscleKg: safeNum(parsed.leftArmMuscleKg),
      rightLegMuscleKg: safeNum(parsed.rightLegMuscleKg),
      leftLegMuscleKg: safeNum(parsed.leftLegMuscleKg),
      trunkMuscleKg: safeNum(parsed.trunkMuscleKg),
      device: safeStr(parsed.device, DEVICE_OPTIONS),
    };

    // TODO: Drive への元画像保存は未実装。今後 saveImagesToDriveAsync パターンで実装予定。

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});
