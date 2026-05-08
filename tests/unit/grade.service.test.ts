import { describe, it, expect } from 'vitest';
import {
  getGradeThreshold,
  getNextThreshold,
  applyGradeRuleNeverLose,
} from '../../src/modules/grades/grade.service.js';

describe('getGradeThreshold', () => {
  it('returns null under 10 000', () => {
    expect(getGradeThreshold(0)).toBeNull();
    expect(getGradeThreshold(9999)).toBeNull();
  });

  it('returns 10 000 at exactly 10 000', () => {
    expect(getGradeThreshold(10_000)).toBe(10_000);
  });

  it('returns 10 000 just before 20 000', () => {
    expect(getGradeThreshold(19_999)).toBe(10_000);
  });

  it('returns 20 000 at exactly 20 000', () => {
    expect(getGradeThreshold(20_000)).toBe(20_000);
  });

  it('returns 140 000 just before 150 000', () => {
    expect(getGradeThreshold(149_999)).toBe(140_000);
  });

  it('returns 150 000 at exactly 150 000', () => {
    expect(getGradeThreshold(150_000)).toBe(150_000);
  });

  it('caps at 150 000 for very high trophies', () => {
    expect(getGradeThreshold(999_999)).toBe(150_000);
  });
});

describe('getNextThreshold', () => {
  it('returns 10 000 when current is null', () => {
    expect(getNextThreshold(null)).toBe(10_000);
  });

  it('returns next threshold above current', () => {
    expect(getNextThreshold(10_000)).toBe(20_000);
    expect(getNextThreshold(140_000)).toBe(150_000);
  });

  it('returns null at maximum threshold', () => {
    expect(getNextThreshold(150_000)).toBeNull();
  });
});

describe('applyGradeRuleNeverLose', () => {
  it('never lowers the grade', () => {
    expect(applyGradeRuleNeverLose(50_000, 30_000)).toBe(50_000);
  });

  it('upgrades when fresh threshold is higher', () => {
    expect(applyGradeRuleNeverLose(30_000, 50_000)).toBe(50_000);
  });

  it('returns fresh when stored is null', () => {
    expect(applyGradeRuleNeverLose(null, 30_000)).toBe(30_000);
  });

  it('returns stored when fresh is null (no grade lost)', () => {
    expect(applyGradeRuleNeverLose(30_000, null)).toBe(30_000);
  });

  it('returns null when both are null', () => {
    expect(applyGradeRuleNeverLose(null, null)).toBeNull();
  });
});
