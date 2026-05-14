import {
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonStyle,
  Message,
} from 'discord.js';
import type { KanjiEntry, JlptLevel } from './data';
import { getKanjiByLevel, pickRandom } from './data';

export type QuizMode = 'lecture' | 'signification';
export type QuizLevel = JlptLevel;

// ── Config en attente ─────────────────────────────────────────────────────
export interface PendingConfig {
  level: QuizLevel;
  questions: number;
  timeoutMs: number | null; // null = illimité
}

const pendingConfigs = new Map<string, PendingConfig>();

export function getPendingConfig(key: string): PendingConfig {
  return pendingConfigs.get(key) ?? { level: 'N5', questions: 10, timeoutMs: 20_000 };
}
export function setPendingConfig(key: string, patch: Partial<PendingConfig>): void {
  pendingConfigs.set(key, { ...getPendingConfig(key), ...patch });
}
export function clearPendingConfig(key: string): void {
  pendingConfigs.delete(key);
}

// ── Message de configuration ──────────────────────────────────────────────
export function buildSetupMessage(
  channelId: string,
  userId: string,
  cfg: PendingConfig
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] } {
  const k = `${channelId}:${userId}`;

  const levelLabel = { N5: 'N5 — Débutant 🌱', N4: 'N4 — Élémentaire 📗', N3: 'N3 — Intermédiaire 📘' };
  const timeLabel =
    cfg.timeoutMs === null
      ? '♾️ Illimité'
      : `⏱️ ${cfg.timeoutMs / 1000}s par question`;

  const embed = new EmbedBuilder()
    .setColor('#e63946')
    .setTitle('🎌 Configuration du Quiz de Kanji')
    .setDescription(
      `**Niveau :** ${levelLabel[cfg.level]}\n` +
        `**Questions :** ${cfg.questions}\n` +
        `**Temps :** ${timeLabel}\n\n` +
        `Sélectionnez vos options puis cliquez sur **Démarrer** !\n` +
        `Les réponses se donnent en **tapant dans le chat** 💬`
    );

  const levelMenu = new StringSelectMenuBuilder()
    .setCustomId(`kcfg_level:${k}`)
    .setPlaceholder('🎯 Choisir le niveau')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('N5 — Débutant').setValue('N5').setEmoji('🌱').setDefault(cfg.level === 'N5'),
      new StringSelectMenuOptionBuilder().setLabel('N4 — Élémentaire').setValue('N4').setEmoji('📗').setDefault(cfg.level === 'N4'),
      new StringSelectMenuOptionBuilder().setLabel('N3 — Intermédiaire').setValue('N3').setEmoji('📘').setDefault(cfg.level === 'N3'),
    );

  const questionsMenu = new StringSelectMenuBuilder()
    .setCustomId(`kcfg_questions:${k}`)
    .setPlaceholder('🔢 Nombre de questions')
    .addOptions(
      [5, 10, 15, 20, 30].map((n) =>
        new StringSelectMenuOptionBuilder().setLabel(`${n} questions`).setValue(String(n)).setDefault(cfg.questions === n)
      )
    );

  const timeMenu = new StringSelectMenuBuilder()
    .setCustomId(`kcfg_time:${k}`)
    .setPlaceholder('⏱️ Temps par question')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('20 secondes').setValue('20000').setEmoji('⏱️').setDefault(cfg.timeoutMs === 20_000),
      new StringSelectMenuOptionBuilder().setLabel('30 secondes').setValue('30000').setEmoji('⏱️').setDefault(cfg.timeoutMs === 30_000),
      new StringSelectMenuOptionBuilder().setLabel('35 secondes').setValue('35000').setEmoji('⏱️').setDefault(cfg.timeoutMs === 35_000),
      new StringSelectMenuOptionBuilder().setLabel('Illimité (jusqu\'à la réponse)').setValue('0').setEmoji('♾️').setDefault(cfg.timeoutMs === null),
    );

  const startBtn = new ButtonBuilder()
    .setCustomId(`kcfg_start:${k}`)
    .setLabel('🎌 Démarrer le quiz')
    .setStyle(ButtonStyle.Success);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(levelMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(questionsMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(startBtn),
    ],
  };
}

// ── Session de quiz ───────────────────────────────────────────────────────
export interface KanjiQuestion {
  entry: KanjiEntry;
  correctAnswers: string[]; // lectures OU significations toutes acceptées
}

export interface KanjiSession {
  active: boolean;
  level: QuizLevel;
  totalQuestions: number;
  current: number;
  question: KanjiQuestion | null;
  questionMessage: Message | null;
  scores: Record<string, number>;
  usedKanji: Set<string>;
  channelId: string;
  guildId: string;
  startedBy: string;
  startedAt: Date;
  timeoutMs: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  answered: boolean;
}

const sessions = new Map<string, KanjiSession>();

export function getSession(channelId: string): KanjiSession | undefined {
  return sessions.get(channelId);
}

export function createSession(
  channelId: string,
  guildId: string,
  startedBy: string,
  cfg: PendingConfig
): KanjiSession {
  const session: KanjiSession = {
    active: true,
    level: cfg.level,
    totalQuestions: cfg.questions,
    current: 0,
    question: null,
    questionMessage: null,
    scores: {},
    usedKanji: new Set(),
    channelId,
    guildId,
    startedBy,
    startedAt: new Date(),
    timeoutMs: cfg.timeoutMs,
    timer: null,
    answered: false,
  };
  sessions.set(channelId, session);
  return session;
}

export function destroySession(channelId: string): void {
  const s = sessions.get(channelId);
  if (s?.timer) clearTimeout(s.timer);
  sessions.delete(channelId);
}

// Vérifie une réponse textuelle (tolérance minuscules/espaces)
export function checkAnswer(session: KanjiSession, answer: string): boolean {
  if (!session.question) return false;
  const norm = answer.trim().toLowerCase();
  return session.question.correctAnswers.some((a) => a.toLowerCase() === norm);
}

function buildQuestion(session: KanjiSession): KanjiQuestion | null {
  const pool = getKanjiByLevel(session.level).filter(
    (k) => !session.usedKanji.has(k.kanji)
  );
  if (pool.length === 0) return null;

  const entry = pickRandom(pool);
  session.usedKanji.add(entry.kanji);

  // Accepte toutes les lectures ET toutes les significations comme bonnes réponses
  return { entry, correctAnswers: [...entry.readings, ...entry.meanings] };
}

export function buildQuestionEmbed(session: KanjiSession, question: KanjiQuestion): EmbedBuilder {
  const levelLabel = { N5: 'N5', N4: 'N4', N3: 'N3' };
  const timeInfo =
    session.timeoutMs === null
      ? '♾️ Pas de limite de temps'
      : `⏱️ **${session.timeoutMs / 1000} secondes** pour répondre`;

  return new EmbedBuilder()
    .setColor('#e63946')
    .setTitle(question.entry.kanji)
    .setDescription(
      `Quelle est la **lecture** (hiragana) ou la **signification** (français) de ce kanji ?\n\n${timeInfo}`
    )
    .setFooter({
      text: `Question ${session.current}/${session.totalQuestions} • Niveau ${levelLabel[session.level]}`,
    });
}

export function buildScoreEmbed(session: KanjiSession, title: string, description?: string): EmbedBuilder {
  const sorted = Object.entries(session.scores).sort((a, b) => b[1] - a[1]);
  const medals = ['🥇', '🥈', '🥉'];

  let board = '';
  for (let i = 0; i < sorted.length; i++) {
    const [userId, pts] = sorted[i];
    board += `${medals[i] ?? `**${i + 1}.**`} <@${userId}> — **${pts}** point${pts > 1 ? 's' : ''}\n`;
  }

  return new EmbedBuilder()
    .setColor('#f4a261')
    .setTitle(title)
    .setDescription((description ? description + '\n\n' : '') + (board || '*Aucun point marqué*'))
    .setTimestamp();
}

const BETWEEN_QUESTION_MS = 3_000;

export async function nextQuestion(
  session: KanjiSession,
  channel: TextChannel,
  onEnd: () => void
): Promise<void> {
  session.current++;
  if (session.current > session.totalQuestions) {
    onEnd();
    return;
  }

  const question = buildQuestion(session);
  if (!question) { onEnd(); return; }

  session.question = question;
  session.answered = false;

  const embed = buildQuestionEmbed(session, question);
  const msg = await channel.send({ embeds: [embed] });
  session.questionMessage = msg;

  // Pas de timer si illimité
  if (session.timeoutMs === null) return;

  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(async () => {
    if (!session.active || session.answered) return;
    session.answered = true;

    const correctList = [...new Set([...question.entry.readings, ...question.entry.meanings])].join(', ');
    await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor('#6c757d')
            .setTitle(`La réponse était : ${question.entry.kanji}`)
            .setDescription(`**Réponses acceptées :** ${correctList}`),
        ],
      })
      .catch(() => null);

    await new Promise((r) => setTimeout(r, BETWEEN_QUESTION_MS));
    if (!session.active) return;
    await nextQuestion(session, channel, onEnd);
  }, session.timeoutMs);
}
