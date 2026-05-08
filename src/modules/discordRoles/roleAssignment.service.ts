import type { GuildMember } from 'discord.js';
import { logger } from '../../shared/logger.js';
import { GradeRepository } from '../grades/grade.repository.js';
import { RoleAssignmentRepository } from './roleAssignment.repository.js';
import type { DiscordLogService } from '../../discord/logs/discordLog.service.js';

export class RoleAssignmentService {
  constructor(
    private readonly gradeRepo: GradeRepository,
    private readonly logRepo: RoleAssignmentRepository,
    private readonly discordLog: DiscordLogService,
  ) {}

  async assignGradeRole(
    member: GuildMember,
    guildId: number,
    threshold: number | null,
  ): Promise<string | null> {
    await this.clearGradeRoles(member, guildId);

    if (threshold === null) {
      await this.logRepo.log({
        guildId,
        discordAccountId: null,
        playerId: null,
        action: 'skip_under_10000',
        success: true,
      });
      return null;
    }

    const gradeRole = await this.gradeRepo.getGradeRoleByThreshold(guildId, threshold);

    if (!gradeRole) {
      const msg = `Grade role for threshold ${threshold} not configured in guild ${guildId}`;
      logger.warn({ guildId, threshold }, msg);
      await this.logRepo.log({
        guildId,
        action: 'role_not_found',
        success: false,
        errorMessage: msg,
        newRoleId: undefined,
        discordAccountId: null,
        playerId: null,
      });
      await this.discordLog.logRoleNotFound(member.id, threshold);
      return null;
    }

    const discordRole = member.guild.roles.cache.get(gradeRole.discordRoleId);
    if (!discordRole) {
      const msg = `Discord role ${gradeRole.discordRoleId} not found in guild`;
      logger.error({ guildId, roleId: gradeRole.discordRoleId }, msg);
      await this.logRepo.log({
        guildId,
        action: 'role_not_found',
        success: false,
        errorMessage: msg,
        newRoleId: gradeRole.discordRoleId,
        discordAccountId: null,
        playerId: null,
      });
      await this.discordLog.logRoleNotFound(member.id, threshold);
      return null;
    }

    // Check bot hierarchy
    const botMember = member.guild.members.me;
    if (!botMember || botMember.roles.highest.position <= discordRole.position) {
      const msg = `Bot cannot manage role ${discordRole.name} due to hierarchy`;
      logger.error({ guildId, roleName: discordRole.name }, msg);
      await this.logRepo.log({
        guildId,
        action: 'permission_error',
        success: false,
        errorMessage: msg,
        newRoleId: gradeRole.discordRoleId,
        discordAccountId: null,
        playerId: null,
      });
      await this.discordLog.logPermissionError(member.id, discordRole.name);
      return null;
    }

    try {
      await member.roles.add(discordRole, `Brawl Stars grade: ${threshold} trophies`);
      await this.logRepo.log({
        guildId,
        action: 'add_role',
        success: true,
        newRoleId: gradeRole.discordRoleId,
        discordAccountId: null,
        playerId: null,
      });
      await this.discordLog.logRoleAdded(member.id, discordRole.name);
      return gradeRole.discordRoleId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ err, guildId, roleId: gradeRole.discordRoleId }, 'Failed to add role');
      await this.logRepo.log({
        guildId,
        action: 'permission_error',
        success: false,
        errorMessage: msg,
        newRoleId: gradeRole.discordRoleId,
        discordAccountId: null,
        playerId: null,
      });
      await this.discordLog.logPermissionError(member.id, discordRole.name);
      return null;
    }
  }

  async clearGradeRoles(member: GuildMember, guildId: number): Promise<void> {
    const gradeRoles = await this.gradeRepo.listGradeRoles(guildId);
    const gradeRoleIds = new Set(gradeRoles.map((r) => r.discordRoleId));

    const toRemove = member.roles.cache.filter((r) => gradeRoleIds.has(r.id));

    for (const [, role] of toRemove) {
      try {
        await member.roles.remove(role, 'Clearing Brawl Stars grade roles');
        await this.logRepo.log({
          guildId,
          action: 'remove_role',
          success: true,
          previousRoleId: role.id,
          discordAccountId: null,
          playerId: null,
        });
        await this.discordLog.logRoleRemoved(member.id, role.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ err, roleId: role.id }, 'Failed to remove grade role');
        await this.logRepo.log({
          guildId,
          action: 'permission_error',
          success: false,
          errorMessage: msg,
          previousRoleId: role.id,
          discordAccountId: null,
          playerId: null,
        });
      }
    }
  }

  async forceRefreshMember(
    member: GuildMember,
    guildId: number,
    highestTrophies: number,
    storedThreshold: number | null,
    dryRun = false,
  ): Promise<{ appliedThreshold: number | null }> {
    const { getGradeThreshold, applyGradeRuleNeverLose } = await import(
      '../grades/grade.service.js'
    );
    const freshThreshold = getGradeThreshold(highestTrophies);
    const finalThreshold = applyGradeRuleNeverLose(storedThreshold, freshThreshold);

    if (dryRun) {
      await this.logRepo.log({
        guildId,
        action: 'dry_run',
        success: true,
        newRoleId: undefined,
        discordAccountId: null,
        playerId: null,
      });
      return { appliedThreshold: finalThreshold };
    }

    await this.assignGradeRole(member, guildId, finalThreshold);
    return { appliedThreshold: finalThreshold };
  }
}
