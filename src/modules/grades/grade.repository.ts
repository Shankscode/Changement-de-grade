import { eq, and } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { gradeRoles, guilds } from '../../db/schema.js';
import type { GradeRole } from '../../db/schema.js';

export class GradeRepository {
  constructor(private readonly db: Db) {}

  async getOrCreateGuild(discordGuildId: string, name?: string): Promise<{ id: number }> {
    const existing = await this.db.query.guilds.findFirst({
      where: eq(guilds.discordGuildId, discordGuildId),
    });

    if (existing) return existing;

    const [created] = await this.db
      .insert(guilds)
      .values({ discordGuildId, name })
      .returning({ id: guilds.id });

    if (!created) throw new Error(`Failed to create guild for ${discordGuildId}`);
    return created;
  }

  async getGuildByDiscordId(discordGuildId: string): Promise<{ id: number } | null> {
    return (
      (await this.db.query.guilds.findFirst({
        where: eq(guilds.discordGuildId, discordGuildId),
        columns: { id: true },
      })) ?? null
    );
  }

  async listGradeRoles(guildId: number): Promise<GradeRole[]> {
    return this.db.query.gradeRoles.findMany({
      where: eq(gradeRoles.guildId, guildId),
    });
  }

  async getGradeRoleByThreshold(
    guildId: number,
    threshold: number,
  ): Promise<GradeRole | null> {
    return (
      (await this.db.query.gradeRoles.findFirst({
        where: and(eq(gradeRoles.guildId, guildId), eq(gradeRoles.threshold, threshold)),
      })) ?? null
    );
  }

  async upsertGradeRole(
    guildId: number,
    threshold: number,
    discordRoleId: string,
  ): Promise<GradeRole> {
    const existing = await this.getGradeRoleByThreshold(guildId, threshold);

    if (existing) {
      const [updated] = await this.db
        .update(gradeRoles)
        .set({ discordRoleId, updatedAt: new Date() })
        .where(eq(gradeRoles.id, existing.id))
        .returning();
      if (!updated) throw new Error('Failed to update grade role');
      return updated;
    }

    const [created] = await this.db
      .insert(gradeRoles)
      .values({ guildId, threshold, discordRoleId })
      .returning();
    if (!created) throw new Error('Failed to create grade role');
    return created;
  }
}
