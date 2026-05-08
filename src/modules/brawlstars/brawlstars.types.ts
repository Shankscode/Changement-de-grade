export interface BrawlStarsPlayer {
  tag: string;
  name: string;
  highestTrophies: number;
  favoriteBrawlerId: number | null;
  brawlers: BrawlerEntry[];
}

export interface BrawlerEntry {
  id: number;
  name: string;
}

// Raw response shape from api.rnt.dev/profile
export interface RntProfileResponse {
  ok: boolean;
  credit?: string;
  result: {
    account_tag: {
      tag: string;
    };
    name: string;
    // NOTE: highest_trophies at top level is unreliable (often 0).
    // The real value is in the stats array under name "HighestTrophies".
    highest_trophies: number;
    trophies: number;
    favorite_brawler: number; // 0 if not set
    stats: Array<{
      id: number;
      name: string;
      value: number;
    }>;
    brawlers: Array<{
      brawler_id: number;
      trophies: number;
      highest_trophies: number;
      power_level: number;
    }>;
  };
}
