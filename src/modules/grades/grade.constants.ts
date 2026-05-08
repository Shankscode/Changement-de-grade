export const GRADE_THRESHOLDS = [
  10_000, 20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000, 100_000, 110_000,
  120_000, 130_000, 140_000, 150_000,
] as const satisfies readonly number[];

export type GradeThreshold = (typeof GRADE_THRESHOLDS)[number];

// These are guaranteed to exist as the array is non-empty
export const MIN_THRESHOLD: number = 10_000;
export const MAX_THRESHOLD: number = 150_000;
