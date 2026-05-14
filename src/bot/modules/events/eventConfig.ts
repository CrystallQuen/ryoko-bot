import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonStyle,
} from 'discord.js';

export interface PendingEventConfig {
  titre: string | null;
  description: string;
  dateStr: string | null;
  duration: number; // heures
}

const pendingConfigs = new Map<string, PendingEventConfig>();

export function getEventConfig(key: string): PendingEventConfig {
  return pendingConfigs.get(key) ?? { titre: null, description: '', dateStr: null, duration: 2 };
}

export function setEventConfig(key: string, patch: Partial<PendingEventConfig>): void {
  pendingConfigs.set(key, { ...getEventConfig(key), ...patch });
}

export function clearEventConfig(key: string): void {
  pendingConfigs.delete(key);
}

// Parse une date au format JJ/MM/AAAA HH:MM ou YYYY-MM-DD HH:MM
export function parseEventDate(str: string): Date | null {
  // Format JJ/MM/AAAA HH:MM
  const frMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (frMatch) {
    const [, d, m, y, h, min] = frMatch;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
    return isNaN(date.getTime()) ? null : date;
  }
  // Format YYYY-MM-DD HH:MM
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d, h, min] = isoMatch;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function buildEventSetupMessage(userId: string, cfg: PendingEventConfig): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
} {
  const titreVal = cfg.titre ?? '*(non défini)*';
  const dateVal = cfg.dateStr ?? '*(non définie)*';
  const descVal = cfg.description || '*(aucune)*';
  const dureeLabel = cfg.duration < 1 ? '30 minutes' : `${cfg.duration}h`;
  const pret = cfg.titre !== null && cfg.dateStr !== null;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🗓️ Créer un Événement')
    .setDescription(
      `**Titre :** ${titreVal}\n` +
        `**Date :** ${dateVal}\n` +
        `**Description :** ${descVal}\n` +
        `**Durée :** ${dureeLabel}\n\n` +
        `Cliquez sur **📝 Informations** pour saisir le titre et la date.\n` +
        `Puis cliquez sur **Créer** quand tout est prêt !`
    );

  const infoBtn = new ButtonBuilder()
    .setCustomId(`ecfg_info:${userId}`)
    .setLabel('📝 Informations')
    .setStyle(ButtonStyle.Secondary);

  const createBtn = new ButtonBuilder()
    .setCustomId(`ecfg_create:${userId}`)
    .setLabel('🗓️ Créer l\'événement')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!pret);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`ecfg_cancel:${userId}`)
    .setLabel('✖ Annuler')
    .setStyle(ButtonStyle.Danger);

  const durationMenu = new StringSelectMenuBuilder()
    .setCustomId(`ecfg_duration:${userId}`)
    .setPlaceholder('⏱️ Durée de l\'événement')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('30 minutes').setValue('0.5').setEmoji('⏱️').setDefault(cfg.duration === 0.5),
      new StringSelectMenuOptionBuilder().setLabel('1 heure').setValue('1').setEmoji('⏱️').setDefault(cfg.duration === 1),
      new StringSelectMenuOptionBuilder().setLabel('2 heures').setValue('2').setEmoji('⏱️').setDefault(cfg.duration === 2),
      new StringSelectMenuOptionBuilder().setLabel('3 heures').setValue('3').setEmoji('⏱️').setDefault(cfg.duration === 3),
      new StringSelectMenuOptionBuilder().setLabel('6 heures').setValue('6').setEmoji('⏱️').setDefault(cfg.duration === 6),
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(durationMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(infoBtn, createBtn, cancelBtn),
    ],
  };
}
