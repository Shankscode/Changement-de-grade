import { describe, it, expect } from 'vitest';
import { normalizeBrawlTag, isValidBrawlTag } from '../../src/modules/brawlstars/tag.utils.js';

// Valid Brawl Stars tag characters: 0 2 8 9 P Y L Q G R J C U V
const VALID_TAG = '#0289PYLQ';

describe('normalizeBrawlTag', () => {
  it('strips leading # and uppercases', () => {
    expect(normalizeBrawlTag('#0289py')).toBe('#0289PY');
  });

  it('adds # when missing', () => {
    expect(normalizeBrawlTag('0289PY')).toBe('#0289PY');
  });

  it('trims whitespace', () => {
    expect(normalizeBrawlTag('  #0289PY  ')).toBe('#0289PY');
  });

  it('throws on invalid characters (letters outside the allowed set)', () => {
    expect(() => normalizeBrawlTag('#INVALID')).toThrow('Invalid tag characters');
  });

  it('throws on too-short tag', () => {
    expect(() => normalizeBrawlTag('#PY')).toThrow('Invalid tag length');
  });

  it('throws on too-long tag', () => {
    expect(() => normalizeBrawlTag('#' + 'P'.repeat(16))).toThrow('Invalid tag length');
  });

  it('accepts all valid chars: 0289PYLQGRJCUV', () => {
    expect(normalizeBrawlTag('#0289PYLQGRJCUV')).toBe('#0289PYLQGRJCUV');
  });

  it('rejects chars outside the allowed set (A, B, 1, 3)', () => {
    expect(() => normalizeBrawlTag('#AB1')).toThrow('Invalid tag characters');
  });
});

describe('isValidBrawlTag', () => {
  it('returns true for a valid tag', () => {
    expect(isValidBrawlTag(VALID_TAG)).toBe(true);
  });

  it('returns false for an invalid tag', () => {
    expect(isValidBrawlTag('#INVALID!')).toBe(false);
  });
});
