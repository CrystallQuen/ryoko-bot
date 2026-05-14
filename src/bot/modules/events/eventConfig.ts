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
  weekOffset: number; // semaines depuis la semaine courante
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
    weekOffset: 0,
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

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTH_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMondayOfCurrentWeek(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Dim
  const diff = dow === 0 ? -6 : 1 - dow;
  today.setDate(today.getDate() + diff);
  return today;
}

export function buildEventSetupMessage(userId: string, cfg: PendingEventConfig): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
} {
  const scheduledAt = buildScheduledAt(cfg);
  const now = new Date();

  // ── Semaine affichée ─────────────────────────────────────────────────────
  const monday = getMondayOfCurrentWeek();
  monday.setDate(monday.getDate() + cfg.weekOffset * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekLabel =
    monday.getMonth() === sunday.getMonth()
      ? `${monday.getDate()} – ${sunday.getDate()} ${MONTH_FULL[monday.getMonth()]} ${sunday.getFullYear()}`
      : `${monday.getDate()} ${MONTH_LABELS[monday.getMonth()]} – ${sunday.getDate()} ${MONTH_LABELS[sunday.getMonth()]} ${sunday.getFullYear()}`;

  // ── Valeurs affichées ────────────────────────────────────────────────────
  const titreVal = cfg.titre ?? '*(non défini)*';
  let dateVal = '*(non définie)*';
  if (cfg.selectedDate && cfg.selectedHour !== null && cfg.selectedMinute !== null) {
    const [y, m, d] = cfg.selectedDate.split('-').map(Number);
    const h = String(cfg.selectedHour).padStart(2, '0');
    const min = String(cfg.selectedMinute).padStart(2, '0');
    const dayObj = new Date(y, m - 1, d);
    dateVal = `${DAY_SHORT[dayObj.getDay()]} ${dayObj.getDate()} ${MONTH_LABELS[m - 1]} ${y} à ${h}:${min}`;
  }
  const descVal = cfg.description || '*(aucune)*';
  const dureeLabel = cfg.duration < 1 ? '30 minutes' : `${cfg.duration}h`;
  const pret = cfg.titre !== null && scheduledAt !== null && scheduledAt > now;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🗓️ Créer un Événement')
    .setDescription(
      `**Titre :** ${titreVal}\n` +
      `**Date :** ${dateVal}\n` +
      `**Description :** ${descVal}\n` +
      `**Durée :** ${dureeLabel}\n\n` +
      `📅 **${weekLabel}**\n` +
      `Choisissez un jour ci-dessous, puis l'heure. Cliquez sur **📝 Informations** pour le titre.`
    );

  // ── Boutons jours ────────────────────────────────────────────────────────
  const prevDisabled = cfg.weekOffset <= 0;

  const prevBtn = new ButtonBuilder()
    .setCustomId(`ecfg_cal_prev:${userId}`)
    .setLabel('◀')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(prevDisabled);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`ecfg_cal_next:${userId}`)
    .setLabel('▶')
    .setStyle(ButtonStyle.Secondary);

  const dayButtons: ButtonBuilder[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateKey = toDateKey(day);
    const isSelected = cfg.selectedDate === dateKey;
    const isPast = day < now && day.toDateString() !== now.toDateString();

    dayButtons.push(
      new ButtonBuilder()
        .setCustomId(`ecfg_day_${dateKey}:${userId}`)
        .setLabel(`${DAY_SHORT[day.getDay()]} ${day.getDate()}`)
        .setStyle(isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(isPast)
    );
  }

  // Row 1 : ◀ + Lun Mar Mer Jeu (Mon–Thu)
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    prevBtn,
    dayButtons[0], // Lun
    dayButtons[1], // Mar
    dayButtons[2], // Mer
    dayButtons[3], // Jeu
  );

  // Row 2 : Ven Sam Dim + ▶
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    dayButtons[4], // Ven
    dayButtons[5], // Sam
    dayButtons[6], // Dim
    nextBtn,
  );

  // ── Heure ────────────────────────────────────────────────────────────────
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

  // ── Minutes ──────────────────────────────────────────────────────────────
  const minuteMenu = new StringSelectMenuBuilder()
    .setCustomId(`ecfg_minute:${userId}`)
    .setPlaceholder('⏱ Minutes')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('00 min').setValue('0').setDefault(cfg.selectedMinute === 0),
      new StringSelectMenuOptionBuilder().setLabel('15 min').setValue('15').setDefault(cfg.selectedMinute === 15),
      new StringSelectMenuOptionBuilder().setLabel('30 min').setValue('30').setDefault(cfg.selectedMinute === 30),
      new StringSelectMenuOptionBuilder().setLabel('45 min').setValue('45').setDefault(cfg.selectedMinute === 45),
    );

  // ── Boutons action ───────────────────────────────────────────────────────
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
      row1,
      row2,
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(hourMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(minuteMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(infoBtn, createBtn, cancelBtn),
    ],
  };
}
