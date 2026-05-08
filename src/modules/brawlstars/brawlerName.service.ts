import { logger } from '../../shared/logger.js';

const BRAWLIFY_URL = 'https://api.brawlify.com/v1/brawlers';

// Fallback static map for offline/error cases
const FALLBACK_NAMES: Readonly<Record<number, string>> = {
  16000000: 'Shelly', 16000001: 'Colt', 16000002: 'Bull', 16000003: 'Brock',
  16000004: 'Rico', 16000005: 'Spike', 16000006: 'Barley', 16000007: 'Jessie',
  16000008: 'Nita', 16000009: 'Dynamike', 16000010: 'El Primo', 16000011: 'Mortis',
  16000012: 'Crow', 16000013: 'Poco', 16000014: 'Bo', 16000015: '8-BIT',
  16000016: 'Emz', 16000017: 'Stu', 16000018: 'Piper', 16000019: 'Pam',
  16000020: 'Frank', 16000021: 'Bibi', 16000022: 'Bea', 16000023: 'Nani',
  16000024: 'Edgar', 16000025: 'Griff', 16000026: 'Grom', 16000027: 'Bonnie',
  16000028: 'Gale', 16000029: 'Colette', 16000030: 'Belle', 16000031: 'Ash',
  16000032: 'Meg', 16000033: 'Lola', 16000034: 'Fang', 16000035: 'Eve',
  16000036: 'Janet', 16000037: 'Otis', 16000038: 'Sam', 16000039: 'Gus',
  16000040: 'Buster', 16000041: 'Chester', 16000042: 'Gray', 16000043: 'Mandy',
  16000044: 'Maisie', 16000045: 'Hank', 16000046: 'Pearl', 16000047: 'Larry & Lawrie',
  16000048: 'Angelo', 16000049: 'Berry', 16000050: 'Shade', 16000051: 'Melodie',
  16000052: 'Lily', 16000053: 'Clancy', 16000054: 'Moe', 16000055: 'Juju',
  16000056: 'Tick', 16000057: 'Leon', 16000058: 'Sandy', 16000059: 'Amber',
  16000060: 'Lou', 16000061: 'Byron', 16000062: 'Sprout', 16000063: 'Mr. P',
  16000064: 'Squeak', 16000065: 'Gene', 16000066: 'Max', 16000067: 'Tara',
  16000068: 'Darryl', 16000069: 'Penny', 16000070: 'Jacky', 16000071: 'Carl',
  16000072: 'Surge', 16000073: 'Rosa', 16000074: 'Ruffs', 16000075: 'Buzz',
};

export class BrawlerNameService {
  private cache = new Map<number, string>(Object.entries(FALLBACK_NAMES).map(([k, v]) => [Number(k), v]));
  private initialized = false;

  async init(): Promise<void> {
    try {
      const res = await fetch(BRAWLIFY_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { list?: Array<{ id: number; name: string }> };
      const list = data.list ?? [];

      for (const brawler of list) {
        this.cache.set(brawler.id, brawler.name);
      }

      this.initialized = true;
      logger.info({ count: list.length }, 'Brawler names loaded from brawlify');
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch brawler names from brawlify — using fallback map');
    }
  }

  getName(brawlerId: number): string {
    return this.cache.get(brawlerId) ?? `Brawler #${brawlerId}`;
  }
}
