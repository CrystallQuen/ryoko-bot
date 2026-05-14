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
  selectedDate: string | null; // "YYYY-MM-DD"
  selectedHour: number | null; // 0-23
  selectedMinute: number | null; // 0, 15, 30, 45
  duration: number; // heures
}

const pendingConfigs = new Map<string, PendingEventConfig>();

export function getEventConfig(key: string): PendingEventConfig {
  return pendingConfigs.get(key) ?? {
    titre: null,
    description: '',
    selectedDate: null,
    selectedHour: null,
    selectedMinute: null,
    duration: 2,
  };
}

export function setEventConfig(key: string, patch: Partial<PendingEventConfig>): void {
  pendingConfigs.set(key, { ...getEventConfig(key), ...patch });
}

export function clearEventConfig(key: string): void {
  pendingConfigs.delete(key);
}

function fromParisTime(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Crée un timestamp UTC correspondant à l'heure locale Europe/Paris saisie
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const utcStr = naive.toLocaleString('en-US', { timeZone: 'UTC' });
  const parisStr = naive.toLocaleString('en-US', { timeZone: 'Europe/Paris' });
  const offsetMs = new Date(utcStr).getTime() - new Date(parisStr).getTime();
  return new Date(naive.getTime() + offsetMs);
}

export function buildScheduledAt(cfg: PendingEventConfig): Date | null {
  if (!cfg.selectedDate || cfg.selectedHour === null || cfg.selectedMinute === null) return null;
  const [y, m, d] = cfg.selectedDate.split('-').map(Number);
  return fromParisTime(y, m, d, cfg.selectedHour, cfg.selectedMinute);
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function formatDateLabel(date: Date): string {
  return `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildEventSetupMessage(userId: string, cfg: PendingEventConfig): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
} {
  const scheduledAt = buildScheduledAt(cfg);

  const titreVal = cfg.titre ?? '*(non défini)*';
  let dateVal = '*(non définie)*';
  if (cfg.selectedDate && cfg.selectedHour !== null && cfg.selectedMinute !== null) {
    const [y, m, d] = cfg.selectedDate.split('-').map(Number);
    const h = String(cfg.selectedHour).padStart(2, '0');
    const min = String(cfg.selectedMinute).padStart(2, '0');
    dateVal = `${formatDateLabel(new Date(y, m - 1, d))} à ${h}:${min}`;
  }
  const descVal = cfg.description || '*(aucune)*';
  const dureeLabel = cfg.duration < 1 ? '30 minutes' : `${cfg.duration}h`;
  const pret = cfg.titre !== null && scheduledAt !== null && scheduledAt > new Date();

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🗓️ Créer un Événement')
    .setDescription(
      `**Titre :** ${titreVal}\n` +
      `**Date :** ${dateVal}\n` +
      `**Description :** ${descVal}\n` +
      `**Durée :** ${dureeLabel}\n\n` +
      `Sélectionnez la date et l'heure ci-dessous, puis cliquez sur **📝 Informations** pour le titre.\n` +
      `Cliquez sur **Créer** quand tout est prêt !`
    );

  // Date select — 25 prochains jours
  const today = new Date();
  const dateOptions: StringSelectMenuOptionBuilder[] = [];
  for (let i = 0; i <= 24; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const val = toDateKey(d);
    dateOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(formatDateLabel(d))
        .setValue(val)
        .setDefault(cfg.selectedDate === val)
    );
  }
  const dateMenu = new StringSelectMenuBuilder()
    .setCustomId(`ecfg_date:${userId}`)
    .setPlaceholder('📅 Sélectionner une date')
    .addOptions(dateOptions);

  // Heure select — 00h à 23h
  const hourOptions: StringSelectMenuOptionBuilder[] = [];
  for (let h = 0; h < 24; h++) {
    hourOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${String(h).padStart(2, '0')}h`)
        .setValue(String(h))
        .setDefault(cfg.selectedHour === h)
    );
  }
  const hourMenu = new StringSelectMenuBuilder()
    .setCustomId(`ecfg_hour:${userId}`)
    .setPlaceholder('🕐 Heure')
    .addOptions(hourOptions);

  // Minutes select
  const minuteMenu = new StringSelectMenuBuilder()
    .setCustomId(`ecfg_minute:${userId}`)
    .setPlaceholder('⏱ Minutes')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('00 min').setValue('0').setDefault(cfg.selectedMinute === 0),
      new StringSelectMenuOptionBuilder().setLabel('15 min').setValue('15').setDefault(cfg.selectedMinute === 15),
      new StringSelectMenuOptionBuilder().setLabel('30 min').setValue('30').setDefault(cfg.selectedMinute === 30),
      new StringSelectMenuOptionBuilder().setLabel('45 min').setValue('45').setDefault(cfg.selectedMinute === 45),
    );

  // Durée select
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

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(dateMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(hourMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(minuteMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(durationMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(infoBtn, createBtn, cancelBtn),
    ],
  };
}
