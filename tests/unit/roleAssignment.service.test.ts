import { describe, it, expect, vi } from 'vitest';
import { Collection } from 'discord.js';
import { RoleAssignmentService } from '../../src/modules/discordRoles/roleAssignment.service.js';

vi.mock('../../src/shared/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function makeGradeRepo(gradeRoles: Array<{ discordRoleId: string; threshold: number }>) {
  return {
    listGradeRoles: vi.fn().mockResolvedValue(gradeRoles),
    getGradeRoleByThreshold: vi.fn().mockImplementation((_gid: number, threshold: number) =>
      Promise.resolve(gradeRoles.find((r) => r.threshold === threshold) ?? null),
    ),
  };
}

function makeLogRepo() {
  return { log: vi.fn().mockResolvedValue(undefined) };
}

function makeDiscordLog() {
  return {
    logRoleAdded: vi.fn().mockResolvedValue(undefined),
    logRoleRemoved: vi.fn().mockResolvedValue(undefined),
    logRoleNotFound: vi.fn().mockResolvedValue(undefined),
    logPermissionError: vi.fn().mockResolvedValue(undefined),
  };
}

// Build a discord.js Collection mock for roles.cache
function makeRoleCollection(roleIds: string[]) {
  const col = new Collection<string, { id: string; name: string }>();
  for (const id of roleIds) {
    col.set(id, { id, name: `Role-${id}` });
  }
  return col;
}

function makeGuildRoleMap(entries: Array<{ id: string; name: string; position: number }>) {
  const col = new Collection<string, { id: string; name: string; position: number }>();
  for (const r of entries) col.set(r.id, r);
  return col;
}

function makeMember(
  roleIds: string[],
  guildRoleEntries: Array<{ id: string; name: string; position: number }>,
  botHighestPosition = 100,
) {
  const addFn = vi.fn().mockResolvedValue(undefined);
  const removeFn = vi.fn().mockResolvedValue(undefined);

  return {
    id: 'user123',
    roles: {
      cache: makeRoleCollection(roleIds),
      add: addFn,
      remove: removeFn,
      highest: { position: 50 },
    },
    guild: {
      roles: { cache: makeGuildRoleMap(guildRoleEntries) },
      members: { me: { roles: { highest: { position: botHighestPosition } } } },
    },
  };
}

describe('RoleAssignmentService', () => {
  describe('clearGradeRoles', () => {
    it('removes only grade roles the member currently has', async () => {
      const gradeRoles = [
        { discordRoleId: 'role-10k', threshold: 10_000 },
        { discordRoleId: 'role-20k', threshold: 20_000 },
      ];
      const gradeRepo = makeGradeRepo(gradeRoles);
      const logRepo = makeLogRepo();
      const discordLog = makeDiscordLog();

      // Member has role-10k and a non-grade other-role
      const member = makeMember(
        ['role-10k', 'other-role'],
        [
          { id: 'role-10k', name: 'Grade 10k', position: 5 },
          { id: 'role-20k', name: 'Grade 20k', position: 6 },
        ],
      );

      const service = new RoleAssignmentService(gradeRepo as never, logRepo as never, discordLog as never);
      await service.clearGradeRoles(member as never, 1);

      expect(member.roles.remove).toHaveBeenCalledTimes(1);
      expect(member.roles.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'role-10k' }),
        expect.any(String),
      );
    });
  });

  describe('assignGradeRole', () => {
    it('does not assign a role when threshold is null (under 10 000)', async () => {
      const gradeRepo = makeGradeRepo([]);
      const logRepo = makeLogRepo();
      const discordLog = makeDiscordLog();
      const member = makeMember([], []);

      const service = new RoleAssignmentService(gradeRepo as never, logRepo as never, discordLog as never);
      const result = await service.assignGradeRole(member as never, 1, null);

      expect(result).toBeNull();
      expect(member.roles.add).not.toHaveBeenCalled();
    });

    it('returns null without crashing when the grade role is not configured', async () => {
      const gradeRepo = makeGradeRepo([]);
      const logRepo = makeLogRepo();
      const discordLog = makeDiscordLog();
      const member = makeMember([], []);

      const service = new RoleAssignmentService(gradeRepo as never, logRepo as never, discordLog as never);
      const result = await service.assignGradeRole(member as never, 1, 10_000);

      expect(result).toBeNull();
      expect(member.roles.add).not.toHaveBeenCalled();
    });

    it('removes old grade roles before adding the new one', async () => {
      const gradeRoles = [
        { discordRoleId: 'role-10k', threshold: 10_000 },
        { discordRoleId: 'role-20k', threshold: 20_000 },
      ];
      const gradeRepo = makeGradeRepo(gradeRoles);
      const logRepo = makeLogRepo();
      const discordLog = makeDiscordLog();

      const guildRoleEntries = [
        { id: 'role-10k', name: 'Grade 10k', position: 5 },
        { id: 'role-20k', name: 'Grade 20k', position: 6 },
      ];

      // Member currently has role-10k
      const member = makeMember(['role-10k'], guildRoleEntries, 100);

      const service = new RoleAssignmentService(gradeRepo as never, logRepo as never, discordLog as never);
      const result = await service.assignGradeRole(member as never, 1, 20_000);

      expect(member.roles.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'role-10k' }),
        expect.any(String),
      );
      expect(member.roles.add).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'role-20k' }),
        expect.any(String),
      );
      expect(result).toBe('role-20k');
    });
  });
});
