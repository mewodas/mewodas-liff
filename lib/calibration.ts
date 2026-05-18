// PFC キャリブレーション集計ロジック（共通化）
//
// /admin/corrections（参考表示用）と /api/cron/update-calibrations（自動反映用）が
// 同じロジックで推奨係数を算出するためのモジュール。
//
// 集計設計：
//   1. トレーナー/社長修正のみを対象に含める（顧客修正は除外）
//   2. 未修正レコードは ratio=1.0 として配列に含める（選択バイアス対策）
//   3. 5% トリム（上下それぞれ）で外れ値除外
//   4. 平均 ratio を 0.7 〜 1.3 でクリッピング（暴走防止）
//   5. 集計対象（ratio 配列）が最小件数未満ならスキップ（前回値維持）

import type { CorrectionRecord } from './notion';

export const CALIBRATION_MIN_SAMPLES = 30;
export const CALIBRATION_TRIM_RATIO = 0.05; // 上下 5%
export const CALIBRATION_CLIP_MIN = 0.7;
export const CALIBRATION_CLIP_MAX = 1.3;

export type CalibrationSuggestion = {
  /** 集計が成立し、推奨値が算出できたか */
  updated: boolean;
  /** 推奨係数（updated=false の場合は { P:1, F:1, C:1 } を返すが、Notion 反映には使わないこと） */
  suggestion: { P: number; F: number; C: number };
  /** 集計に使った ratio 配列のサイズ（トレーナー修正＋未修正の合計） */
  sampleSize: number;
  /** トレーナー修正の件数（参考） */
  trainerCorrectedCount: number;
  /** 未修正で ratio=1.0 とみなしたレコード数（参考） */
  uncorrectedCount: number;
  /** スキップした場合の理由 */
  skipReason?: string;
};

/** 配列を昇順ソートして上下 trimRatio をカットし、残りの平均を返す */
function trimmedMean(values: number[], trimRatio: number): number {
  if (values.length === 0) return 1.0;
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trimRatio);
  const sliced = sorted.slice(trimCount, sorted.length - trimCount);
  if (sliced.length === 0) return 1.0;
  const sum = sliced.reduce((acc, v) => acc + v, 0);
  return sum / sliced.length;
}

function clip(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 推奨キャリブレーション係数を算出する。
 * @param records getCorrectionRecords() の戻り値
 * @param opts.minSamples 最小サンプル数（デフォルト 30）
 */
export function computeCalibrationSuggestion(
  records: CorrectionRecord[],
  opts?: { minSamples?: number }
): CalibrationSuggestion {
  const minSamples = opts?.minSamples ?? CALIBRATION_MIN_SAMPLES;

  // 集計対象の分類
  //   - トレーナー/社長修正 → 実際の ratio を使う
  //   - 未修正 → ratio=1.0
  //   - 顧客修正 → 除外
  const ratiosP: number[] = [];
  const ratiosF: number[] = [];
  const ratiosC: number[] = [];
  let trainerCorrectedCount = 0;
  let uncorrectedCount = 0;

  for (const r of records) {
    if (r.hasCorrection) {
      // 修正者がトレーナー（or null=旧データの社長修正想定）以外は除外
      if (r.correctedBy === '顧客') continue;
      // ratio = current / ai。AI 推定値が 0 の場合はスキップ
      if (r.aiOriginal.P > 0) ratiosP.push(r.current.P / r.aiOriginal.P);
      if (r.aiOriginal.F > 0) ratiosF.push(r.current.F / r.aiOriginal.F);
      if (r.aiOriginal.C > 0) ratiosC.push(r.current.C / r.aiOriginal.C);
      trainerCorrectedCount++;
    } else {
      // 未修正 → AI 推定が正しいとみなして ratio=1.0
      ratiosP.push(1.0);
      ratiosF.push(1.0);
      ratiosC.push(1.0);
      uncorrectedCount++;
    }
  }

  // P/F/C の集計対象サイズはほぼ同じ。代表として P で判定
  const sampleSize = ratiosP.length;
  if (sampleSize < minSamples) {
    return {
      updated: false,
      suggestion: { P: 1.0, F: 1.0, C: 1.0 },
      sampleSize,
      trainerCorrectedCount,
      uncorrectedCount,
      skipReason: `サンプル数 ${sampleSize} < 最小閾値 ${minSamples}`,
    };
  }

  // 上下 5% トリム + クリッピング
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const P = round2(clip(trimmedMean(ratiosP, CALIBRATION_TRIM_RATIO), CALIBRATION_CLIP_MIN, CALIBRATION_CLIP_MAX));
  const F = round2(clip(trimmedMean(ratiosF, CALIBRATION_TRIM_RATIO), CALIBRATION_CLIP_MIN, CALIBRATION_CLIP_MAX));
  const C = round2(clip(trimmedMean(ratiosC, CALIBRATION_TRIM_RATIO), CALIBRATION_CLIP_MIN, CALIBRATION_CLIP_MAX));

  return {
    updated: true,
    suggestion: { P, F, C },
    sampleSize,
    trainerCorrectedCount,
    uncorrectedCount,
  };
}
