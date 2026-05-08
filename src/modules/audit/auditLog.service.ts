import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { accountLinkHistory, roleAssignmentLogs } from '../../db/schema.js';

export class AuditLogService {
  constructor(private readonly db: Db) {}

  async getRecentRoleAssignments(guildId: number, limit = 50) {
    return this.db.query.roleAssignmentLogs.findMany({
      where: eq(roleAssignmentLogs.guildId, guildId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit,
    });
  }

  async getLinkHistory(playerId: number) {
    return this.db.query.accountLinkHistory.findMany({
      where: eq(accountLinkHistory.playerId, playerId),
      orderBy: (t, { desc }) => [desc(t.transferredAt)],
      with: {
        previousDiscordAccount: true,
        newDiscordAccount: true,
      },
    });
  }
}
