import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

export const VERIFY_MODAL_ID = 'verify_modal';
export const VERIFY_TAG_INPUT_ID = 'brawl_tag_input';

export function buildVerifyModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(VERIFY_MODAL_ID)
    .setTitle('Vérifier ton compte Brawl Stars');

  const tagInput = new TextInputBuilder()
    .setCustomId(VERIFY_TAG_INPUT_ID)
    .setLabel('Ton tag Brawl Stars (ex : #ABC123)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('#ABC123')
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(16);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(tagInput));
  return modal;
}
