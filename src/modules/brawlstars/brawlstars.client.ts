import { BrawlStarsApiError } from '../../shared/errors.js';
import type { BrawlerNameService } from './brawlerName.service.js';
import type { BrawlStarsPlayer, RntProfileResponse } from './brawlstars.types.js';

const BASE_URL = 'https://api.rnt.dev';

export class BrawlStarsClient {
  private readonly headers: Headers;

  constructor(
    private readonly brawlerNames: BrawlerNameService,
    apiKey?: string,
  ) {
    this.headers = new Headers({ 'Content-Type': 'application/json' });
    if (apiKey) {
      this.headers.set('Authorization', `Bearer ${apiKey}`);
    }
  }

  async fetchPlayerByTag(tag: string): Promise<BrawlStarsPlayer> {
    const url = `${BASE_URL}/profile?tag=${encodeURIComponent(tag)}`;

    let response: Response;
    try {
      response = await fetch(url, { headers: this.headers });
    } catch {
      throw new BrawlStarsApiError('Erreur réseau lors de la connexion à BrawlAPI (api.rnt.dev)');
    }

    if (response.status === 404) {
      throw new BrawlStarsApiError(`Joueur introuvable : ${tag}`, 404);
    }
    if (response.status === 403) {
      throw new BrawlStarsApiError('Clé BrawlAPI invalide ou non autorisée', 403);
    }
    if (response.status === 429) {
      throw new BrawlStarsApiError('Limite de taux BrawlAPI dépassée', 429);
    }
    if (!response.ok) {
      throw new BrawlStarsApiError(
        `Erreur BrawlAPI : ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    const raw = (await response.json()) as RntProfileResponse;

    if (!raw.ok || !raw.result) {
      throw new BrawlStarsApiError(`BrawlAPI a retourné ok=false pour le tag ${tag}`);
    }

    const { result } = raw;

    // highest_trophies at top level is unreliable (often 0) — use stats array instead
    const highestTrophiesStat = result.stats?.find((s) => s.name === 'HighestTrophies');
    const highestTrophies = highestTrophiesStat?.value ?? result.highest_trophies ?? 0;

    return {
      tag: result.account_tag.tag,
      name: result.name,
      highestTrophies,
      favoriteBrawlerId: result.favorite_brawler > 0 ? result.favorite_brawler : null,
      brawlers: result.brawlers.map((b) => ({
        id: b.brawler_id,
        name: this.brawlerNames.getName(b.brawler_id),
      })),
    };
  }
}
