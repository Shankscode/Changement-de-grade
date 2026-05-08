import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Enums
export const linkHistoryReasonEnum = pgEnum('link_history_reason', [
  'initial_link',
  'automatic_transfer',
  'admin_unlink',
  'manual_relink',
]);

export const challengeStatusEnum = pgEnum('challenge_status', [
  'pending',
  'verified',
  'expired',
  'failed',
  'cancelled',
]);

export const roleActionEnum = pgEnum('role_action', [
  'add_role',
  'remove_role',
  'replace_role',
  'clear_roles',
  'skip_under_10000',
  'permission_error',
  'role_not_found',
  'dry_run',
]);

// Tables
export const guilds = pgTable('guilds', {
  id: serial('id').primaryKey(),
  discordGuildId: text('discord_guild_id').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const gradeRoles = pgTable(
  'grade_roles',
  {
    id: serial('id').primaryKey(),
    guildId: integer('guild_id')
      .notNull()
      .references(() => guilds.id),
    threshold: integer('threshold').notNull(),
    discordRoleId: text('discord_role_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('grade_roles_guild_threshold_uniq').on(t.guildId, t.threshold),
    unique('grade_roles_guild_role_uniq').on(t.guildId, t.discordRoleId),
  ],
);

export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  brawlTag: text('brawl_tag').notNull().unique(),
  brawlName: text('brawl_name'),
  highestTrophies: integer('highest_trophies').notNull().default(0),
  lastFetchedAt: timestamp('last_fetched_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const discordAccounts = pgTable('discord_accounts', {
  id: serial('id').primaryKey(),
  discordUserId: text('discord_user_id').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const accountLinks = pgTable(
  'account_links',
  {
    id: serial('id').primaryKey(),
    guildId: integer('guild_id')
      .notNull()
      .references(() => guilds.id),
    discordAccountId: integer('discord_account_id')
      .notNull()
      .references(() => discordAccounts.id),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id),
    verifiedAt: timestamp('verified_at').notNull(),
    active: boolean('active').notNull().default(true),
    currentGradeThreshold: integer('current_grade_threshold'),
    currentRoleId: text('current_role_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Partial unique indexes: only one active link per discordAccount+guild and per player+guild
    // These are created as SQL in a custom migration since Drizzle doesn't support partial unique indexes natively
    uniqueIndex('account_links_discord_guild_active_uniq')
      .on(t.discordAccountId, t.guildId)
      .where(sql`active = true`),
    uniqueIndex('account_links_player_guild_active_uniq')
      .on(t.playerId, t.guildId)
      .where(sql`active = true`),
  ],
);

export const accountLinkHistory = pgTable('account_link_history', {
  id: serial('id').primaryKey(),
  guildId: integer('guild_id')
    .notNull()
    .references(() => guilds.id),
  playerId: integer('player_id')
    .notNull()
    .references(() => players.id),
  previousDiscordAccountId: integer('previous_discord_account_id').references(
    () => discordAccounts.id,
  ),
  newDiscordAccountId: integer('new_discord_account_id')
    .notNull()
    .references(() => discordAccounts.id),
  reason: linkHistoryReasonEnum('reason').notNull(),
  transferredAt: timestamp('transferred_at').notNull().defaultNow(),
});

export const verificationChallenges = pgTable('verification_challenges', {
  id: serial('id').primaryKey(),
  guildId: integer('guild_id')
    .notNull()
    .references(() => guilds.id),
  discordAccountId: integer('discord_account_id')
    .notNull()
    .references(() => discordAccounts.id),
  playerId: integer('player_id')
    .notNull()
    .references(() => players.id),
  expectedFavoriteBrawlerId: integer('expected_favorite_brawler_id').notNull(),
  status: challengeStatusEnum('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  verifiedAt: timestamp('verified_at'),
});

export const roleAssignmentLogs = pgTable('role_assignment_logs', {
  id: serial('id').primaryKey(),
  guildId: integer('guild_id')
    .notNull()
    .references(() => guilds.id),
  discordAccountId: integer('discord_account_id').references(() => discordAccounts.id),
  playerId: integer('player_id').references(() => players.id),
  action: roleActionEnum('action').notNull(),
  success: boolean('success').notNull(),
  previousRoleId: text('previous_role_id'),
  newRoleId: text('new_role_id'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const guildsRelations = relations(guilds, ({ many }) => ({
  gradeRoles: many(gradeRoles),
  accountLinks: many(accountLinks),
  accountLinkHistory: many(accountLinkHistory),
  verificationChallenges: many(verificationChallenges),
  roleAssignmentLogs: many(roleAssignmentLogs),
}));

export const gradeRolesRelations = relations(gradeRoles, ({ one }) => ({
  guild: one(guilds, { fields: [gradeRoles.guildId], references: [guilds.id] }),
}));

export const playersRelations = relations(players, ({ many }) => ({
  accountLinks: many(accountLinks),
  accountLinkHistory: many(accountLinkHistory),
  verificationChallenges: many(verificationChallenges),
  roleAssignmentLogs: many(roleAssignmentLogs),
}));

export const discordAccountsRelations = relations(discordAccounts, ({ many }) => ({
  accountLinks: many(accountLinks),
  sentHistory: many(accountLinkHistory, { relationName: 'newDiscordAccount' }),
  receivedHistory: many(accountLinkHistory, { relationName: 'previousDiscordAccount' }),
  verificationChallenges: many(verificationChallenges),
  roleAssignmentLogs: many(roleAssignmentLogs),
}));

export const accountLinksRelations = relations(accountLinks, ({ one }) => ({
  guild: one(guilds, { fields: [accountLinks.guildId], references: [guilds.id] }),
  discordAccount: one(discordAccounts, {
    fields: [accountLinks.discordAccountId],
    references: [discordAccounts.id],
  }),
  player: one(players, { fields: [accountLinks.playerId], references: [players.id] }),
}));

export const accountLinkHistoryRelations = relations(accountLinkHistory, ({ one }) => ({
  guild: one(guilds, { fields: [accountLinkHistory.guildId], references: [guilds.id] }),
  player: one(players, { fields: [accountLinkHistory.playerId], references: [players.id] }),
  previousDiscordAccount: one(discordAccounts, {
    fields: [accountLinkHistory.previousDiscordAccountId],
    references: [discordAccounts.id],
    relationName: 'previousDiscordAccount',
  }),
  newDiscordAccount: one(discordAccounts, {
    fields: [accountLinkHistory.newDiscordAccountId],
    references: [discordAccounts.id],
    relationName: 'newDiscordAccount',
  }),
}));

export const verificationChallengesRelations = relations(verificationChallenges, ({ one }) => ({
  guild: one(guilds, { fields: [verificationChallenges.guildId], references: [guilds.id] }),
  discordAccount: one(discordAccounts, {
    fields: [verificationChallenges.discordAccountId],
    references: [discordAccounts.id],
  }),
  player: one(players, { fields: [verificationChallenges.playerId], references: [players.id] }),
}));

export const roleAssignmentLogsRelations = relations(roleAssignmentLogs, ({ one }) => ({
  guild: one(guilds, { fields: [roleAssignmentLogs.guildId], references: [guilds.id] }),
  discordAccount: one(discordAccounts, {
    fields: [roleAssignmentLogs.discordAccountId],
    references: [discordAccounts.id],
  }),
  player: one(players, { fields: [roleAssignmentLogs.playerId], references: [players.id] }),
}));

// Inferred types
export type Guild = typeof guilds.$inferSelect;
export type NewGuild = typeof guilds.$inferInsert;
export type GradeRole = typeof gradeRoles.$inferSelect;
export type NewGradeRole = typeof gradeRoles.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type DiscordAccount = typeof discordAccounts.$inferSelect;
export type NewDiscordAccount = typeof discordAccounts.$inferInsert;
export type AccountLink = typeof accountLinks.$inferSelect;
export type NewAccountLink = typeof accountLinks.$inferInsert;
export type AccountLinkHistory = typeof accountLinkHistory.$inferSelect;
export type NewAccountLinkHistory = typeof accountLinkHistory.$inferInsert;
export type VerificationChallenge = typeof verificationChallenges.$inferSelect;
export type NewVerificationChallenge = typeof verificationChallenges.$inferInsert;
export type RoleAssignmentLog = typeof roleAssignmentLogs.$inferSelect;
export type NewRoleAssignmentLog = typeof roleAssignmentLogs.$inferInsert;
