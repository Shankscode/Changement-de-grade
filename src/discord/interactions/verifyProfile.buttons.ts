import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export const VERIFY_OPEN_BUTTON_ID = 'verify_open';

export function buildVerifyPanel(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setTitle('🏆 Vérification Brawl Stars')
    .setDescription(
      "Clique sur le bouton ci-dessous pour lier ton compte Brawl Stars et recevoir ton rôle de grade selon ton record de trophées.",
    )
    .addFields(
      {
        name: '📋 Comment ça marche ?',
        value:
          '1. Clique sur **Vérifier mon compte**\n' +
          '2. Entre ton tag Brawl Stars\n' +
          '3. Le bot te demande de choisir un brawler favori en jeu\n' +
          '4. Confirme et reçois ton rôle automatiquement',
      },
      {
        name: '🎯 Paliers',
        value:
          '10 000 · 20 000 · 30 000 · … · 150 000 trophées\n' +
          '*Tu ne perds jamais ton grade, même si tes trophées baissent.*',
      },
    )
    .setColor(0xf4c430)
    .setFooter({ text: 'Un seul compte Brawl Stars par membre Discord' });

  const button = new ButtonBuilder()
    .setCustomId(VERIFY_OPEN_BUTTON_ID)
    .setLabel('Vérifier mon compte')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('✅');

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  };
}

export function isVerifyOpenButton(customId: string): boolean {
  return customId === VERIFY_OPEN_BUTTON_ID;
}

export const VERIFY_CONFIRM_BUTTON_PREFIX = 'verify_confirm_';

export function buildVerifyConfirmButton(challengeId: number): ActionRowBuilder<ButtonBuilder> {
  const button = new ButtonBuilder()
    .setCustomId(`${VERIFY_CONFIRM_BUTTON_PREFIX}${challengeId}`)
    .setLabel("I've set my favourite brawler")
    .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

export function isVerifyConfirmButton(customId: string): boolean {
  return customId.startsWith(VERIFY_CONFIRM_BUTTON_PREFIX);
}

export function extractChallengeId(customId: string): number | null {
  const raw = customId.slice(VERIFY_CONFIRM_BUTTON_PREFIX.length);
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}
