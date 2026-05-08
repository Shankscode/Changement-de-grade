const VALID_TAG_CHARS = /^[0289PYLQGRJCUV]+$/;

export function normalizeBrawlTag(raw: string): string {
  const tag = raw.trim().toUpperCase().replace(/^#/, '');

  if (tag.length < 3 || tag.length > 15) {
    throw new Error(`Invalid tag length: #${tag}`);
  }

  if (!VALID_TAG_CHARS.test(tag)) {
    throw new Error(`Invalid tag characters: #${tag}`);
  }

  return `#${tag}`;
}

export function isValidBrawlTag(raw: string): boolean {
  try {
    normalizeBrawlTag(raw);
    return true;
  } catch {
    return false;
  }
}
