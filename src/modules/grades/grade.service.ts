import { GRADE_THRESHOLDS, MAX_THRESHOLD, MIN_THRESHOLD } from './grade.constants.js';

export function getGradeThreshold(highestTrophies: number): number | null {
  if (highestTrophies < MIN_THRESHOLD) return null;

  let result: number = MIN_THRESHOLD;
  for (const threshold of GRADE_THRESHOLDS) {
    if (highestTrophies >= threshold) {
      result = threshold;
    } else {
      break;
    }
  }

  return Math.min(result, MAX_THRESHOLD);
}

export function getNextThreshold(currentThreshold: number | null): number | null {
  if (currentThreshold === null) return MIN_THRESHOLD;
  if (currentThreshold >= MAX_THRESHOLD) return null;

  const idx = GRADE_THRESHOLDS.findIndex((t) => t === currentThreshold);
  if (idx === -1 || idx + 1 >= GRADE_THRESHOLDS.length) return null;

  return GRADE_THRESHOLDS[idx + 1] ?? null;
}

export function applyGradeRuleNeverLose(
  storedThreshold: number | null,
  freshThreshold: number | null,
): number | null {
  if (storedThreshold === null) return freshThreshold;
  if (freshThreshold === null) return storedThreshold;
  return Math.max(storedThreshold, freshThreshold);
}
