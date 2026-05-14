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

const DAY_SHORT = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTH_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildCalendarGrid(year: number, month: number, selectedKey: string | null): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDow = new Date(year, month, 1).getDay(); // 0=Di
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const header = 'Di Lu Ma Me Je Ve Sa';
  const cells: string[] = Array(firstDow).fill('  ');

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayDate = new Date(year, month, d);
    const isPast = dayDate < today;
    const isSelected = key === selectedKey;
    const isToday = dayDate.getTime() === today.getTime();

    let cell: string;
    if (isSelected) cell = `◈${String(d).padStart(2)}`;   // 3 chars
    else if (isToday) cell = `·${String(d).padStart(2)}`; // 3 chars
    else if (isPast) cell = `  `;                          // 2 chars (grisé)
    else cell = String(d).padStart(2);                     // 2 chars

    cells.push(cell);
  }

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push('  ');

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7).map(c => c.padEnd(3)).join(''));
  }

  return `\`\`\`\n  ${MONTH_FULL[month].toUpperCase()} ${year}\n${header}\n${rows.join('\n')}\n\`\`\``;
}

export function buildEventSetupMessage(userId: string, cfg: PendingEventConfig): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
} {
  const scheduledAt = buildScheduledAt(cfg);
  const now = new Date();

  // Mois du calendrier à afficher
  const calYear = cfg.selectedDate
    ? parseInt(cfg.selectedDate.split('-')[0])
    : now.getFullYear();
  const calMonth = cfg.selectedDate
    ? parseInt(cfg.selectedDate.split('-')[1]) - 1
    : now.getMonth();

  const calendar = buildCalendarGrid(calYear, calMonth, cfg.selectedDate);

  // Résumé de la sélection
  const titreVal = cfg.titre ?? '*(non défini)*';
  let dateVal = '*(non définie)*';
  if (cfg.selectedDate && cfg.selectedHour !== null && cfg.selectedMinute !== null) {
    const [y, m, d] = cfg.selectedDate.split('-').map(Number);
    const dayObj = new Date(y, m - 1, d);
    const h = String(cfg.selectedHour).padStart(2, '0');
    const min = String(cfg.selectedMinute).padStart(2, '0');
    dateVal = `**${DAY_SHORT[dayObj.getDay()]} ${dayObj.getDate()} ${MONTH_LABELS[m - 1]} ${y}** à **${h}:${min}**`;
  } else if (cfg.selectedDate) {
    const [y, m, d] = cfg.selectedDate.split('-').map(Number);
    const dayObj = new Date(y, m - 1, d);
    dateVal = `**${DAY_SHORT[dayObj.getDay()]} ${dayObj.getDate()} ${MONTH_LABELS[m - 1]} ${y}** — heure à définir`;
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
      `**Durée :** ${dureeLabel}`
    )
    .addFields({ name: '​', value: calendar });

  // ── Date select — 25 prochains jours ────────────────────────────────────
  const today2 = new Date();
  today2.setHours(0, 0, 0, 0);
  const dateOptions: StringSelectMenuOptionBuilder[] = [];
  for (let i = 0; i <= 24; i++) {
    const d = new Date(today2);
    d.setDate(today2.getDate() + i);
    const val = toDateKey(d);
    const label = `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
    dateOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setValue(val)
        .setDefault(cfg.selectedDate === val)
    );
  }
  const dateMenu = new StringSelectMenuBuilder()
    .setCustomId(`ecfg_date:${userId}`)
    .setPlaceholder('📅 Choisir une date')
    .addOptions(dateOptions);

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

  // ── Durée ────────────────────────────────────────────────────────────────
  const durationMenu = new StringSelectMenuBuilder()
    .setCustomId(`ecfg_duration:${userId}`)
    .setPlaceholder('⏳ Durée de l\'événement')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('30 minutes').setValue('0.5').setEmoji('⏳').setDefault(cfg.duration === 0.5),
      new StringSelectMenuOptionBuilder().setLabel('1 heure').setValue('1').setEmoji('⏳').setDefault(cfg.duration === 1),
      new StringSelectMenuOptionBuilder().setLabel('2 heures').setValue('2').setEmoji('⏳').setDefault(cfg.duration === 2),
      new StringSelectMenuOptionBuilder().setLabel('3 heures').setValue('3').setEmoji('⏳').setDefault(cfg.duration === 3),
      new StringSelectMenuOptionBuilder().setLabel('6 heures').setValue('6').setEmoji('⏳').setDefault(cfg.duration === 6),
    );

  // ── Boutons ──────────────────────────────────────────────────────────────
  const infoBtn = new ButtonBuilder()
    .setCustomId(`ecfg_info:${userId}`)
    .setLabel('📝 Titre / Description')
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
