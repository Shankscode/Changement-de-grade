import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import { getGradeThreshold, applyGradeRuleNeverLose } from '../../modules/grades/grade.service.js';
import { MIN_THRESHOLD, MAX_THRESHOLD } from '../../modules/grades/grade.constants.js';
import type { GradeRepository } from '../../modules/grades/grade.repository.js';
import type { VerificationRepository } from '../../modules/verification/verification.repository.js';
import type { RoleAssignmentService } from '../../modules/discordRoles/roleAssignment.service.js';
import type { BrawlStarsClient } from '../../modules/brawlstars/brawlstars.client.js';
import type { DiscordLogService } from '../logs/discordLog.service.js';
import { logger } from '../../shared/logger.js';
import { BrawlStarsApiError } from '../../shared/errors.js';
import { buildVerifyPanel } from '../interactions/verifyProfile.buttons.js';
import type { BatchRefreshService } from '../../modules/refresh/batchRefresh.service.js';

export const adminCommandData = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin commands')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('check-user')
      .setDescription('View a member\'s linked account details')
      .addUserOption((o) => o.setName('user').setDescription('Target member').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('force-refresh')
      .setDescription('Refetch and reapply grade role for a member')
      .addUserOption((o) => o.setName('user').setDescription('Target member').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('unlink')
      .setDescription('Deactivate a member\'s linked Brawl Stars account')
      .addUserOption((o) => o.setName('user').setDescription('Target member').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('refresh-all')
      .setDescription('Batch refresh all linked members')
      .addBooleanOption((o) =>
        o.setName('dry_run').setDescription('Simulate without making changes (default: true)').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('set-grade-role')
      .setDescription('Assign a Discord role to a trophy threshold')
      .addIntegerOption((o) =>
        o
          .setName('threshold')
          .setDescription('Trophy threshold (multiple of 10 000, between 10 000 and 150 000)')
          .setRequired(true),
      )
      .addRoleOption((o) =>
        o.setName('role').setDescription('Discord role to assign').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('list-grade-roles').setDescription('List configured grade roles for this server'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('send-verify-panel')
      .setDescription('Post the verification embed with button in a channel')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel where the panel will be posted (default: current channel)')
          .setRequired(false),
      ),
  );

export async function handleAdminCommand(
  interaction: ChatInputCommandInteraction,
  gradeRepo: GradeRepository,
  verifyRepo: VerificationRepository,
  roleService: RoleAssignmentService,
  brawlStars: BrawlStarsClient,
  discordLog: DiscordLogService,
  batchRefresh: BatchRefreshService,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({ content: 'Server only.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'check-user':
      await handleCheckUser(interaction, gradeRepo, verifyRepo);
      break;
    case 'force-refresh':
      await handleForceRefresh(interaction, gradeRepo, verifyRepo, roleService, brawlStars, discordLog);
      break;
    case 'unlink':
      await handleUnlink(interaction, gradeRepo, verifyRepo, roleService, discordLog);
      break;
    case 'refresh-all':
      await handleRefreshAll(interaction, gradeRepo, batchRefresh);
      break;
    case 'set-grade-role':
      await handleSetGradeRole(interaction, gradeRepo);
      break;
    case 'list-grade-roles':
      await handleListGradeRoles(interaction, gradeRepo);
      break;
    case 'send-verify-panel':
      await handleSendVerifyPanel(interaction);
      break;
    default:
      await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

async function handleCheckUser(
  interaction: ChatInputCommandInteraction,
  gradeRepo: GradeRepository,
  verifyRepo: VerificationRepository,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser('user', true);
  const guildRow = await gradeRepo.getGuildByDiscordId(interaction.guildId!);

  if (!guildRow) {
    await interaction.editReply({ content: 'Aucune donnée pour ce serveur.' });
    return;
  }

  const discordAccount = await verifyRepo.getDiscordAccountByUserId(targetUser.id);
  if (!discordAccount) {
    await interaction.editReply({ content: `<@${targetUser.id}> n'a pas de compte lié.` });
    return;
  }

  const link = await verifyRepo.getActiveLinkWithDetails(discordAccount.id, guildRow.id);
  if (!link) {
    await interaction.editReply({ content: `<@${targetUser.id}> n'a pas de lien actif.` });
    return;
  }

  const { player, currentGradeThreshold } = link;
  const expectedThreshold = getGradeThreshold(player.highestTrophies);
  const finalThreshold = applyGradeRuleNeverLose(currentGradeThreshold, expectedThreshold);

  let expectedRoleMention = 'Aucun';
  if (finalThreshold !== null) {
    const gr = await gradeRepo.getGradeRoleByThreshold(guildRow.id, finalThreshold);
    if (gr) expectedRoleMention = `<@&${gr.discordRoleId}>`;
  }

  let currentRoleMention = 'Aucun';
  if (link.currentRoleId) {
    currentRoleMention = `<@&${link.currentRoleId}>`;
  }

  const lines = [
    `**Discord :** <@${targetUser.id}> (\`${targetUser.id}\`)`,
    `**Tag :** \`${player.brawlTag}\``,
    `**Nom :** ${player.brawlName ?? '—'}`,
    `**Record trophées :** ${player.highestTrophies.toLocaleString('fr-FR')}`,
    `**Grade stocké :** ${currentGradeThreshold?.toLocaleString('fr-FR') ?? 'Aucun'}`,
    `**Grade attendu :** ${finalThreshold?.toLocaleString('fr-FR') ?? 'Aucun'}`,
    `**Rôle actuel :** ${currentRoleMention}`,
    `**Rôle attendu :** ${expectedRoleMention}`,
    `**Vérifié le :** <t:${Math.floor(link.verifiedAt.getTime() / 1000)}:F>`,
    `**Dernier fetch :** ${player.lastFetchedAt ? `<t:${Math.floor(player.lastFetchedAt.getTime() / 1000)}:R>` : 'Jamais'}`,
    `**Lien actif :** ${link.active ? 'Oui' : 'Non'}`,
  ];

  await interaction.editReply({ content: lines.join('\n') });
}

async function handleForceRefresh(
  interaction: ChatInputCommandInteraction,
  gradeRepo: GradeRepository,
  verifyRepo: VerificationRepository,
  roleService: RoleAssignmentService,
  brawlStars: BrawlStarsClient,
  discordLog: DiscordLogService,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser('user', true);
  const guildRow = await gradeRepo.getOrCreateGuild(interaction.guildId!, interaction.guild?.name);

  const discordAccount = await verifyRepo.getDiscordAccountByUserId(targetUser.id);
  if (!discordAccount) {
    await interaction.editReply({ content: `<@${targetUser.id}> n'a pas de compte lié.` });
    return;
  }

  const link = await verifyRepo.getActiveLinkWithDetails(discordAccount.id, guildRow.id);
  if (!link) {
    await interaction.editReply({ content: `<@${targetUser.id}> n'a pas de lien actif.` });
    return;
  }

  try {
    const freshProfile = await brawlStars.fetchPlayerByTag(link.player.brawlTag);
    await verifyRepo.updatePlayerTrophies(link.player.id, freshProfile.highestTrophies);

    const updatedTrophies = Math.max(link.player.highestTrophies, freshProfile.highestTrophies);
    const freshThreshold = getGradeThreshold(updatedTrophies);
    const finalThreshold = applyGradeRuleNeverLose(link.currentGradeThreshold, freshThreshold);

    const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.editReply({ content: `<@${targetUser.id}> introuvable sur le serveur.` });
      return;
    }

    await roleService.assignGradeRole(member, guildRow.id, finalThreshold);
    await verifyRepo.updateLinkGrade(link.id, finalThreshold, link.currentRoleId);

    await interaction.editReply({
      content:
        `✅ Rafraîchi pour <@${targetUser.id}>\n` +
        `Trophées : **${updatedTrophies.toLocaleString('fr-FR')}** — Grade : **${finalThreshold?.toLocaleString('fr-FR') ?? 'Aucun'}**`,
    });
  } catch (err) {
    if (err instanceof BrawlStarsApiError) {
      await discordLog.logBrawlStarsApiError('force-refresh', link.player.brawlTag, err);
    } else {
      await discordLog.logUnexpectedError('force-refresh', err);
    }
    await interaction.editReply({ content: 'Erreur lors du rafraîchissement. Consulte les logs.' });
  }
}

async function handleUnlink(
  interaction: ChatInputCommandInteraction,
  gradeRepo: GradeRepository,
  verifyRepo: VerificationRepository,
  roleService: RoleAssignmentService,
  discordLog: DiscordLogService,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser('user', true);
  const guildRow = await gradeRepo.getGuildByDiscordId(interaction.guildId!);
  if (!guildRow) {
    await interaction.editReply({ content: 'Aucune donnée pour ce serveur.' });
    return;
  }

  const discordAccount = await verifyRepo.getDiscordAccountByUserId(targetUser.id);
  if (!discordAccount) {
    await interaction.editReply({ content: `<@${targetUser.id}> n'a pas de compte lié.` });
    return;
  }

  const link = await verifyRepo.getActiveLinkWithDetails(discordAccount.id, guildRow.id);
  if (!link) {
    await interaction.editReply({ content: `<@${targetUser.id}> n'a pas de lien actif.` });
    return;
  }

  await verifyRepo.deactivateLink(link.id);
  await verifyRepo.writeHistory(
    guildRow.id,
    link.playerId,
    discordAccount.id,
    'admin_unlink',
  );

  const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
  if (member) {
    await roleService.clearGradeRoles(member, guildRow.id);
  }

  await discordLog.logAdminUnlink(interaction.user.id, targetUser.id, link.player.brawlTag);

  await interaction.editReply({
    content: `✅ <@${targetUser.id}> a été délié du compte \`${link.player.brawlTag}\`.`,
  });
}

async function handleRefreshAll(
  interaction: ChatInputCommandInteraction,
  gradeRepo: GradeRepository,
  batchRefresh: BatchRefreshService,
): Promise<void> {
  const dryRun = interaction.options.getBoolean('dry_run') ?? true;
  await interaction.deferReply({ ephemeral: true });

  const guildRow = await gradeRepo.getGuildByDiscordId(interaction.guildId!);
  if (!guildRow) {
    await interaction.editReply({ content: 'Aucune donnée pour ce serveur.' });
    return;
  }

  if (!interaction.guild) {
    await interaction.editReply({ content: 'Serveur introuvable.' });
    return;
  }

  await interaction.editReply({
    content: `🔄 Rafraîchissement en cours${dryRun ? ' (simulation)' : ''}…`,
  });

  const result = await batchRefresh.run({
    dryRun,
    guild: interaction.guild,
    guildDbId: guildRow.id,
  });

  await interaction.followUp({
    content:
      `✅ Rafraîchissement${dryRun ? ' (simulation)' : ''} terminé.\n` +
      `Traités : **${result.processed}** — Mis à jour : **${result.updated}** — Ignorés : **${result.skipped}** — Erreurs : **${result.errors}**`,
    ephemeral: true,
  });
}

async function handleSetGradeRole(
  interaction: ChatInputCommandInteraction,
  gradeRepo: GradeRepository,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const threshold = interaction.options.getInteger('threshold', true);
  const role = interaction.options.getRole('role', true);

  if (threshold < MIN_THRESHOLD || threshold > MAX_THRESHOLD || threshold % 10_000 !== 0) {
    await interaction.editReply({
      content: `Le palier doit être un multiple de 10 000, entre ${MIN_THRESHOLD.toLocaleString('fr-FR')} et ${MAX_THRESHOLD.toLocaleString('fr-FR')}.`,
    });
    return;
  }

  const discordRole = interaction.guild!.roles.cache.get(role.id);
  if (!discordRole) {
    await interaction.editReply({ content: 'Rôle introuvable sur ce serveur.' });
    return;
  }

  const botMember = interaction.guild!.members.me;
  if (!botMember || botMember.roles.highest.position <= discordRole.position) {
    await interaction.editReply({
      content: `Le bot ne peut pas gérer <@&${role.id}> — ce rôle doit être **en dessous** du rôle le plus haut du bot dans la hiérarchie.`,
    });
    return;
  }

  const guildRow = await gradeRepo.getOrCreateGuild(interaction.guildId!, interaction.guild?.name);
  await gradeRepo.upsertGradeRole(guildRow.id, threshold, role.id);

  await interaction.editReply({
    content: `✅ Rôle de grade configuré : **${threshold.toLocaleString('fr-FR')} trophées** → <@&${role.id}>`,
  });

  logger.info(
    { guildId: guildRow.id, threshold, roleId: role.id, admin: interaction.user.id },
    'Grade role configured',
  );
}

async function handleListGradeRoles(
  interaction: ChatInputCommandInteraction,
  gradeRepo: GradeRepository,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildRow = await gradeRepo.getGuildByDiscordId(interaction.guildId!);
  if (!guildRow) {
    await interaction.editReply({ content: 'Aucun rôle de grade configuré pour l\'instant.' });
    return;
  }

  const roles = await gradeRepo.listGradeRoles(guildRow.id);
  if (roles.length === 0) {
    await interaction.editReply({ content: 'Aucun rôle de grade configuré. Utilise `/admin set-grade-role` pour en ajouter un.' });
    return;
  }

  const sorted = [...roles].sort((a, b) => a.threshold - b.threshold);
  const lines = sorted.map(
    (r) => `**${r.threshold.toLocaleString()}** trophies → <@&${r.discordRoleId}>`,
  );

  await interaction.editReply({
    content: `**Rôles de grade sur ce serveur :**\n${lines.join('\n')}`,
  });
}

async function handleSendVerifyPanel(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel;

  if (!targetChannel || !('send' in targetChannel)) {
    await interaction.reply({ content: 'Impossible d\'envoyer dans ce salon.', ephemeral: true });
    return;
  }

  const panel = buildVerifyPanel();
  await (targetChannel as import('discord.js').TextChannel).send(panel);

  await interaction.reply({
    content: `✅ Panel de vérification posté dans <#${targetChannel.id}>.`,
    ephemeral: true,
  });

  logger.info(
    { channelId: targetChannel.id, admin: interaction.user.id },
    'Verify panel posted',
  );
}
