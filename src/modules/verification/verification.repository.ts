import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import {
  accountLinkHistory,
  accountLinks,
  discordAccounts,
  players,
  verificationChallenges,
} from '../../db/schema.js';
import type {
  AccountLink,
  DiscordAccount,
  Player,
  VerificationChallenge,
} from '../../db/schema.js';

export class VerificationRepository {
  constructor(private readonly db: Db) {}

  async getOrCreateDiscordAccount(discordUserId: string): Promise<DiscordAccount> {
    const existing = await this.db.query.discordAccounts.findFirst({
      where: eq(discordAccounts.discordUserId, discordUserId),
    });
    if (existing) return existing;

    const [created] = await this.db
      .insert(discordAccounts)
      .values({ discordUserId })
      .returning();
    if (!created) throw new Error('Failed to create discord account');
    return created;
  }

  async getOrCreatePlayer(brawlTag: string, brawlName: string, highestTrophies: number): Promise<Player> {
    const existing = await this.db.query.players.findFirst({
      where: eq(players.brawlTag, brawlTag),
    });

    if (existing) {
      const shouldUpdate =
        highestTrophies > existing.highestTrophies ||
        brawlName !== existing.brawlName;

      if (shouldUpdate) {
        const [updated] = await this.db
          .update(players)
          .set({
            brawlName,
            highestTrophies: Math.max(existing.highestTrophies, highestTrophies),
            lastFetchedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(players.id, existing.id))
          .returning();
        if (!updated) throw new Error('Failed to update player');
        return updated;
      }

      await this.db
        .update(players)
        .set({ lastFetchedAt: new Date(), updatedAt: new Date() })
        .where(eq(players.id, existing.id));

      return existing;
    }

    const [created] = await this.db
      .insert(players)
      .values({ brawlTag, brawlName, highestTrophies, lastFetchedAt: new Date() })
      .returning();
    if (!created) throw new Error('Failed to create player');
    return created;
  }

  async updatePlayerTrophies(playerId: number, highestTrophies: number): Promise<void> {
    const existing = await this.db.query.players.findFirst({
      where: eq(players.id, playerId),
    });
    if (!existing) return;

    await this.db
      .update(players)
      .set({
        highestTrophies: Math.max(existing.highestTrophies, highestTrophies),
        lastFetchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(players.id, playerId));
  }

  async getActiveLink(discordAccountId: number, guildId: number): Promise<AccountLink | null> {
    return (
      (await this.db.query.accountLinks.findFirst({
        where: and(
          eq(accountLinks.discordAccountId, discordAccountId),
          eq(accountLinks.guildId, guildId),
          eq(accountLinks.active, true),
        ),
      })) ?? null
    );
  }

  async getActiveLinkByPlayer(playerId: number, guildId: number): Promise<AccountLink | null> {
    return (
      (await this.db.query.accountLinks.findFirst({
        where: and(
          eq(accountLinks.playerId, playerId),
          eq(accountLinks.guildId, guildId),
          eq(accountLinks.active, true),
        ),
      })) ?? null
    );
  }

  async getActiveLinkWithDetails(
    discordAccountId: number,
    guildId: number,
  ): Promise<(AccountLink & { player: Player; discordAccount: DiscordAccount }) | null> {
    const link = await this.db.query.accountLinks.findFirst({
      where: and(
        eq(accountLinks.discordAccountId, discordAccountId),
        eq(accountLinks.guildId, guildId),
        eq(accountLinks.active, true),
      ),
      with: { discordAccount: true, player: true },
    });
    return link ?? null;
  }

  async deactivateLink(linkId: number): Promise<void> {
    await this.db
      .update(accountLinks)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(accountLinks.id, linkId));
  }

  async createLink(
    guildId: number,
    discordAccountId: number,
    playerId: number,
    gradeThreshold: number | null,
  ): Promise<AccountLink> {
    const [created] = await this.db
      .insert(accountLinks)
      .values({
        guildId,
        discordAccountId,
        playerId,
        verifiedAt: new Date(),
        active: true,
        currentGradeThreshold: gradeThreshold,
      })
      .returning();
    if (!created) throw new Error('Failed to create account link');
    return created;
  }

  async updateLinkGrade(
    linkId: number,
    gradeThreshold: number | null,
    roleId: string | null,
  ): Promise<void> {
    await this.db
      .update(accountLinks)
      .set({
        currentGradeThreshold: gradeThreshold,
        currentRoleId: roleId,
        updatedAt: new Date(),
      })
      .where(eq(accountLinks.id, linkId));
  }

  async writeHistory(
    guildId: number,
    playerId: number,
    newDiscordAccountId: number,
    reason: 'initial_link' | 'automatic_transfer' | 'admin_unlink' | 'manual_relink',
    previousDiscordAccountId?: number,
  ): Promise<void> {
    await this.db.insert(accountLinkHistory).values({
      guildId,
      playerId,
      newDiscordAccountId,
      previousDiscordAccountId,
      reason,
    });
  }

  async createChallenge(
    guildId: number,
    discordAccountId: number,
    playerId: number,
    expectedFavoriteBrawlerId: number,
    expiresAt: Date,
  ): Promise<VerificationChallenge> {
    // Cancel any pending challenges for this discord account in this guild
    await this.db
      .update(verificationChallenges)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(verificationChallenges.discordAccountId, discordAccountId),
          eq(verificationChallenges.guildId, guildId),
          eq(verificationChallenges.status, 'pending'),
        ),
      );

    const [created] = await this.db
      .insert(verificationChallenges)
      .values({
        guildId,
        discordAccountId,
        playerId,
        expectedFavoriteBrawlerId,
        expiresAt,
        status: 'pending',
      })
      .returning();
    if (!created) throw new Error('Failed to create challenge');
    return created;
  }

  async getPendingChallenge(
    discordAccountId: number,
    guildId: number,
  ): Promise<VerificationChallenge | null> {
    return (
      (await this.db.query.verificationChallenges.findFirst({
        where: and(
          eq(verificationChallenges.discordAccountId, discordAccountId),
          eq(verificationChallenges.guildId, guildId),
          eq(verificationChallenges.status, 'pending'),
        ),
      })) ?? null
    );
  }

  async markChallengeVerified(challengeId: number): Promise<void> {
    await this.db
      .update(verificationChallenges)
      .set({ status: 'verified', verifiedAt: new Date() })
      .where(eq(verificationChallenges.id, challengeId));
  }

  async markChallengeExpired(challengeId: number): Promise<void> {
    await this.db
      .update(verificationChallenges)
      .set({ status: 'expired' })
      .where(eq(verificationChallenges.id, challengeId));
  }

  async getChallengeById(challengeId: number): Promise<VerificationChallenge | null> {
    return (
      (await this.db.query.verificationChallenges.findFirst({
        where: eq(verificationChallenges.id, challengeId),
      })) ?? null
    );
  }

  async getPlayerByTag(brawlTag: string): Promise<Player | null> {
    return (
      (await this.db.query.players.findFirst({
        where: eq(players.brawlTag, brawlTag),
      })) ?? null
    );
  }

  async getDiscordAccountByUserId(discordUserId: string): Promise<DiscordAccount | null> {
    return (
      (await this.db.query.discordAccounts.findFirst({
        where: eq(discordAccounts.discordUserId, discordUserId),
      })) ?? null
    );
  }

  async getDiscordAccountById(id: number): Promise<DiscordAccount | null> {
    return (
      (await this.db.query.discordAccounts.findFirst({
        where: eq(discordAccounts.id, id),
      })) ?? null
    );
  }

  async getPlayerById(id: number): Promise<Player | null> {
    return (
      (await this.db.query.players.findFirst({
        where: eq(players.id, id),
      })) ?? null
    );
  }
}
