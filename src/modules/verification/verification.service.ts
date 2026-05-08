import type { Guild, GuildMember } from 'discord.js';
import { BrawlStarsClient } from '../brawlstars/brawlstars.client.js';
import { normalizeBrawlTag } from '../brawlstars/tag.utils.js';
import { getGradeThreshold, applyGradeRuleNeverLose } from '../grades/grade.service.js';
import type { RoleAssignmentService } from '../discordRoles/roleAssignment.service.js';
import type { DiscordLogService } from '../../discord/logs/discordLog.service.js';
import { VerificationRepository } from './verification.repository.js';
import type {
  ChallengeVerifyResult,
  VerificationChallengeResult,
} from './verification.types.js';
import { addMinutes, isExpired } from '../../shared/time.js';
import { logger } from '../../shared/logger.js';

const CHALLENGE_TTL_MINUTES = 15;

export class VerificationService {
  constructor(
    private readonly repo: VerificationRepository,
    private readonly brawlStars: BrawlStarsClient,
    private readonly roleService: RoleAssignmentService,
    private readonly discordLog: DiscordLogService,
  ) {}

  async initiateVerification(
    discordUserId: string,
    guildId: number,
    rawTag: string,
  ): Promise<VerificationChallengeResult> {
    const tag = normalizeBrawlTag(rawTag);
    const profile = await this.brawlStars.fetchPlayerByTag(tag);

    if (profile.brawlers.length === 0) {
      throw new Error('This Brawl Stars account has no brawlers.');
    }

    const discordAccount = await this.repo.getOrCreateDiscordAccount(discordUserId);
    const player = await this.repo.getOrCreatePlayer(
      profile.tag,
      profile.name,
      profile.highestTrophies,
    );

    const randomBrawler = profile.brawlers[Math.floor(Math.random() * profile.brawlers.length)];
    if (!randomBrawler) throw new Error('Failed to select a random brawler');

    const expiresAt = addMinutes(new Date(), CHALLENGE_TTL_MINUTES);
    const challenge = await this.repo.createChallenge(
      guildId,
      discordAccount.id,
      player.id,
      randomBrawler.id,
      expiresAt,
    );

    logger.info(
      { discordUserId, tag, brawlerId: randomBrawler.id, challengeId: challenge.id },
      'Verification challenge created',
    );

    await this.discordLog.logChallengeCreated(discordUserId, tag, randomBrawler.name, expiresAt);

    return {
      challengeId: challenge.id,
      brawlerName: randomBrawler.name,
      expiresAt,
    };
  }

  async verifyChallenge(
    discordUserId: string,
    guildId: number,
    challengeId: number,
    member: GuildMember,
  ): Promise<ChallengeVerifyResult> {
    const discordAccount = await this.repo.getOrCreateDiscordAccount(discordUserId);

    const challenge = await this.repo.getChallengeById(challengeId);

    if (!challenge || challenge.status !== 'pending') {
      return { status: 'not_found' };
    }

    if (isExpired(challenge.expiresAt)) {
      await this.repo.markChallengeExpired(challenge.id);
      await this.discordLog.logChallengeExpired(discordUserId);
      return { status: 'expired' };
    }

    const challengePlayer = await this.repo.getPlayerById(challenge.playerId);
    if (!challengePlayer) return { status: 'not_found' };

    const freshProfile = await this.brawlStars.fetchPlayerByTag(challengePlayer.brawlTag);

    if (freshProfile.favoriteBrawlerId !== challenge.expectedFavoriteBrawlerId) {
      await this.discordLog.logVerificationFailed(discordUserId, challengePlayer.brawlTag);
      return { status: 'wrong_brawler' };
    }

    // Verification passed
    await this.repo.markChallengeVerified(challenge.id);

    const updatedPlayer = await this.repo.getOrCreatePlayer(
      freshProfile.tag,
      freshProfile.name,
      freshProfile.highestTrophies,
    );

    const freshThreshold = getGradeThreshold(updatedPlayer.highestTrophies);

    // Handle tag already linked to another Discord account (transfer)
    let wasTransfer = false;
    let previousDiscordUserId: string | undefined;
    const existingPlayerLink = await this.repo.getActiveLinkByPlayer(updatedPlayer.id, guildId);

    if (existingPlayerLink && existingPlayerLink.discordAccountId !== discordAccount.id) {
      wasTransfer = true;
      const oldAccount = await this.repo.getDiscordAccountById(
        existingPlayerLink.discordAccountId,
      );
      previousDiscordUserId = oldAccount?.discordUserId;

      await this.clearOldMemberRole(existingPlayerLink, guildId, member.guild);
      await this.repo.deactivateLink(existingPlayerLink.id);
      await this.repo.writeHistory(
        guildId,
        updatedPlayer.id,
        discordAccount.id,
        'automatic_transfer',
        existingPlayerLink.discordAccountId,
      );

      await this.discordLog.logAutomaticTransfer(
        previousDiscordUserId ?? 'unknown',
        discordUserId,
        freshProfile.tag,
      );
    } else if (existingPlayerLink) {
      await this.repo.deactivateLink(existingPlayerLink.id);
    }

    // Deactivate any other active link for this discord account in this guild
    const existingDiscordLink = await this.repo.getActiveLink(discordAccount.id, guildId);
    if (existingDiscordLink) {
      await this.repo.deactivateLink(existingDiscordLink.id);
    }

    // Compute final grade — never lose previous grade
    const storedThreshold = existingPlayerLink?.currentGradeThreshold ?? null;
    const finalThreshold = applyGradeRuleNeverLose(storedThreshold, freshThreshold);

    const newLink = await this.repo.createLink(
      guildId,
      discordAccount.id,
      updatedPlayer.id,
      finalThreshold,
    );

    await this.repo.writeHistory(
      guildId,
      updatedPlayer.id,
      discordAccount.id,
      wasTransfer ? 'automatic_transfer' : 'initial_link',
    );

    const assignedRoleId = await this.roleService.assignGradeRole(
      member,
      guildId,
      finalThreshold,
    );

    await this.repo.updateLinkGrade(newLink.id, finalThreshold, assignedRoleId);

    await this.discordLog.logVerificationSuccess(
      discordUserId,
      freshProfile.tag,
      freshProfile.name,
      freshProfile.highestTrophies,
      finalThreshold,
      wasTransfer,
    );

    return {
      status: 'success',
      data: {
        discordUserId,
        brawlTag: updatedPlayer.brawlTag,
        brawlName: updatedPlayer.brawlName ?? freshProfile.name,
        highestTrophies: updatedPlayer.highestTrophies,
        gradeThreshold: finalThreshold,
        wasTransfer,
        previousDiscordUserId,
      },
    };
  }

  private async clearOldMemberRole(
    link: { discordAccountId: number },
    guildId: number,
    guild: Guild,
  ): Promise<void> {
    try {
      const oldAccount = await this.repo.getDiscordAccountById(link.discordAccountId);
      if (!oldAccount) return;

      const oldMember = await guild.members.fetch(oldAccount.discordUserId).catch(() => null);
      if (oldMember) {
        await this.roleService.clearGradeRoles(oldMember, guildId);
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to clear old member grade roles during transfer');
    }
  }
}
