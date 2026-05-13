// 運動内容のテキストから消費カロリーをルールベースで推定
// AI呼び出しなし。MET法ベースで控えめ寄りに算出。

export type ExerciseEstimate = {
  totalKcal: number;
  activities: Array<{ name: string; duration: string; kcal: number; met: number }>;
  note: string;
};

// 主要な運動とMET値（控えめ寄り）
// 厚労省「身体活動のMETs表」を参考、過大評価を避けるため一部下方修正
const ACTIVITY_TABLE: Array<{
  match: RegExp;
  name: string;
  met: number;
  defaultMin?: number;
}> = [
  // ランニング系
  { match: /ラン+ニン*グ|走る|ジョグ|ジョギング|ランニン/, name: 'ランニング', met: 8.0, defaultMin: 30 },
  { match: /スプリント|全力疾走/, name: 'スプリント', met: 11.0, defaultMin: 15 },
  // ウォーキング系
  { match: /ウォ+ーキング|散歩|早歩き/, name: 'ウォーキング', met: 3.5, defaultMin: 30 },
  // 筋トレ系
  { match: /ベンチプレス|デッドリフト|スクワット|懸垂|チンニング/, name: '筋トレ（高強度）', met: 6.0, defaultMin: 45 },
  { match: /筋トレ|ウェイト|ジム|トレーニング/, name: '筋トレ', met: 5.0, defaultMin: 45 },
  { match: /腕立て|プッシュアップ/, name: '腕立て', met: 4.0, defaultMin: 10 },
  { match: /腹筋|シットアップ|プランク/, name: '腹筋', met: 3.5, defaultMin: 10 },
  // 自転車・バイク
  { match: /スピンバイク|エアロバイク|エアロビ/, name: 'バイク', met: 7.0, defaultMin: 30 },
  { match: /自転車|サイクリング|バイク/, name: '自転車', met: 5.5, defaultMin: 30 },
  // 水泳
  { match: /クロール|平泳ぎ|背泳ぎ|バタフライ|水泳/, name: '水泳', met: 7.0, defaultMin: 30 },
  // 球技
  { match: /サッカー|フットサル/, name: 'サッカー', met: 7.0, defaultMin: 60 },
  { match: /バスケ/, name: 'バスケ', met: 6.5, defaultMin: 60 },
  { match: /テニス/, name: 'テニス', met: 6.0, defaultMin: 60 },
  { match: /バドミントン/, name: 'バドミントン', met: 5.5, defaultMin: 45 },
  { match: /卓球/, name: '卓球', met: 4.0, defaultMin: 45 },
  { match: /野球|ソフトボール/, name: '野球', met: 5.0, defaultMin: 60 },
  { match: /ゴルフ/, name: 'ゴルフ', met: 4.5, defaultMin: 120 },
  { match: /ボクシング|キックボクシング/, name: 'ボクシング', met: 7.5, defaultMin: 30 },
  { match: /ラグビー/, name: 'ラグビー', met: 8.0, defaultMin: 60 },
  // ヨガ・ピラティス
  { match: /HIIT|タバタ/i, name: 'HIIT', met: 8.0, defaultMin: 20 },
  { match: /ヨガ|ホットヨガ/, name: 'ヨガ', met: 2.5, defaultMin: 45 },
  { match: /ピラティス/, name: 'ピラティス', met: 3.0, defaultMin: 45 },
  { match: /ストレッチ/, name: 'ストレッチ', met: 2.3, defaultMin: 15 },
  // ダンス
  { match: /ダンス|エアロビ/, name: 'ダンス', met: 5.5, defaultMin: 45 },
  { match: /ズンバ|Zumba/i, name: 'ズンバ', met: 6.5, defaultMin: 45 },
  // 階段・ハイキング
  { match: /階段/, name: '階段昇降', met: 5.0, defaultMin: 15 },
  { match: /ハイキング|山登り|登山/, name: 'ハイキング', met: 6.5, defaultMin: 120 },
  // その他
  { match: /縄跳び|なわとび/, name: '縄跳び', met: 9.0, defaultMin: 15 },
  { match: /スキー|スノボ|スノーボード/, name: 'スキー', met: 6.0, defaultMin: 120 },
  { match: /サーフィン/, name: 'サーフィン', met: 5.0, defaultMin: 60 },
  { match: /ローイング|ボート/, name: 'ローイング', met: 6.0, defaultMin: 20 },
  { match: /エリプティカル/, name: 'エリプティカル', met: 5.5, defaultMin: 30 },
];

// テキストから「30分」「1時間」等を抽出して分単位で返す
function extractMinutes(text: string): number | null {
  // 「1時間30分」のような複合形
  const hm = text.match(/(\d+)\s*時間\s*(\d+)\s*分/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  // 「1時間」「2時間」
  const h = text.match(/(\d+(?:\.\d+)?)\s*時間/);
  if (h) return Math.round(Number(h[1]) * 60);
  // 「30分」「45分」
  const m = text.match(/(\d+)\s*分/);
  if (m) return Number(m[1]);
  // 「30min」「45 min」
  const m2 = text.match(/(\d+)\s*min/i);
  if (m2) return Number(m2[1]);
  return null;
}

// 行・カンマ・読点・「、」で活動を分割
function splitActivities(content: string): string[] {
  return content
    .split(/[\n,、・]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// kcal = MET × 体重(kg) × 時間(h) × 0.9（控えめ補正係数）
const CONSERVATIVE_FACTOR = 0.9;

export function estimateExercise(
  content: string,
  weightKg: number | null = 60
): ExerciseEstimate {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    return { totalKcal: 0, activities: [], note: '内容が空のため推定できません' };
  }
  const weight = weightKg && weightKg > 0 ? weightKg : 60;

  const segments = splitActivities(trimmed);
  // セグメントが見つからなければ、テキスト全体を1セグメント扱い
  const items = segments.length > 0 ? segments : [trimmed];

  const activities: Array<{ name: string; duration: string; kcal: number; met: number }> = [];

  for (const seg of items) {
    // セグメントから activity を1つ拾う（最初にマッチしたもの）
    const matched = ACTIVITY_TABLE.find((a) => a.match.test(seg));
    if (!matched) continue;

    // 時間：このセグメントから抽出。なければトータルテキストから（最終的にはデフォルト）
    let minutes = extractMinutes(seg) ?? extractMinutes(trimmed) ?? matched.defaultMin ?? 30;
    // 過大値の上限
    minutes = Math.min(minutes, 300);

    const hours = minutes / 60;
    const kcal = Math.round(matched.met * weight * hours * CONSERVATIVE_FACTOR);

    activities.push({
      name: matched.name,
      duration: minutes >= 60 ? `${Math.floor(minutes / 60)}時間${minutes % 60 ? minutes % 60 + '分' : ''}` : `${minutes}分`,
      kcal,
      met: matched.met,
    });
  }

  const totalKcal = activities.reduce((acc, a) => acc + a.kcal, 0);

  let note = '';
  if (activities.length === 0) {
    note = '運動種目を認識できませんでした（中強度30分の場合：約150〜250kcal）';
  } else if (totalKcal < 100) {
    note = '軽め運動として算出。物足りなければ強度を上げると効果UP';
  } else if (totalKcal < 300) {
    note = '健康維持には十分な運動量。継続が大切';
  } else if (totalKcal < 600) {
    note = 'しっかり運動できています。減量にも効果的';
  } else {
    note = 'かなりハードな運動量。リカバリーと栄養補給も忘れずに';
  }

  return { totalKcal, activities, note };
}
