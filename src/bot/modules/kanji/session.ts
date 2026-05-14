import {
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
} from 'discord.js';
import type { KanjiEntry, JlptLevel } from './data';
import { getKanjiByLevel, pickRandom, shuffled } from './data';

export type QuizMode = 'lecture' | 'signification';
export type QuizLevel = JlptLevel | 'mixte';

export interface KanjiQuestion {
  entry: KanjiEntry;
  mode: QuizMode;
  correctAnswer: string;   // la bonne réponse affichée sur le bouton
  choices: string[];        // 4 choix dans l'ordre des boutons
  correctIndex: number;     // indice du bon bouton (0-3)
}

export interface KanjiSession {
  active: boolean;
  level: QuizLevel;
  mode: QuizMode;
  totalQuestions: number;
  current: number;
  question: KanjiQuestion | null;
  questionMessage: Message | null;
  scores: Record<string, number>;
  usedKanji: Set<string>;
  channelId: string;
  startedBy: string;
  startedAt: Date;
  timer: ReturnType<typeof setTimeout> | null;
  answered: boolean;
}

const sessions = new Map<string, KanjiSession>();

export const ANSWER_TIMEOUT_MS = 20_000;
const BETWEEN_QUESTION_MS = 3_000;

export function getSession(channelId: string): KanjiSession | undefined {
  return sessions.get(channelId);
}

export function createSession(
  channelId: string,
  startedBy: string,
  level: QuizLevel,
  mode: QuizMode,
  totalQuestions: number
): KanjiSession {
  const session: KanjiSession = {
    active: true,
    level,
    mode,
    totalQuestions,
    current: 0,
    question: null,
    questionMessage: null,
    scores: {},
    usedKanji: new Set(),
    channelId,
    startedBy,
    startedAt: new Date(),
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

function pickDistractors(
  pool: KanjiEntry[],
  correct: KanjiEntry,
  mode: QuizMode,
  count: number
): string[] {
  const others = pool.filter((k) => k.kanji !== correct.kanji);
  const shuffledOthers = shuffled(others);
  const distractors: string[] = [];

  for (const entry of shuffledOthers) {
    if (distractors.length >= count) break;
    const candidate =
      mode === 'lecture'
        ? entry.readings[0]
        : entry.meanings[0];
    if (!distractors.includes(candidate)) {
      distractors.push(candidate);
    }
  }

  // Compléter si pas assez
  while (distractors.length < count) {
    distractors.push(`choix ${distractors.length + 1}`);
  }

  return distractors;
}

function buildQuestion(session: KanjiSession): KanjiQuestion | null {
  const pool = getKanjiByLevel(session.level).filter(
    (k) => !session.usedKanji.has(k.kanji)
  );
  if (pool.length === 0) return null;

  const entry = pickRandom(pool);
  session.usedKanji.add(entry.kanji);

  const correctAnswer =
    session.mode === 'lecture' ? entry.readings[0] : entry.meanings[0];

  const distractors = pickDistractors(pool, entry, session.mode, 3);
  const allChoices = shuffled([correctAnswer, ...distractors]);
  const correctIndex = allChoices.indexOf(correctAnswer);

  return { entry, mode: session.mode, correctAnswer, choices: allChoices, correctIndex };
}

export function buildQuestionComponents(
  question: KanjiQuestion,
  channelId: string,
  disabled = false,
  revealCorrect = false
): ActionRowBuilder<ButtonBuilder> {
  const buttons = question.choices.map((choice, i) => {
    let style: ButtonStyle;

    if (disabled && revealCorrect) {
      style = i === question.correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary;
    } else {
      // Couleurs variées pour rendre l'interface plus vivante
      const styles = [ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Success, ButtonStyle.Secondary];
      style = styles[i % styles.length];
    }

    return new ButtonBuilder()
      .setCustomId(`kanji_answer:${channelId}:${i}`)
      .setLabel(choice)
      .setStyle(style)
      .setDisabled(disabled);
  });

  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

export function buildQuestionEmbed(
  session: KanjiSession,
  question: KanjiQuestion
): EmbedBuilder {
  const levelLabel: Record<QuizLevel, string> = {
    N5: 'N5', N4: 'N4', N3: 'N3', mixte: 'Mixte',
  };
  const modeLabel = question.mode === 'lecture' ? '📖 Lecture' : '💬 Signification';
  const prompt =
    question.mode === 'lecture'
      ? 'Quelle est la **lecture** de ce kanji ?'
      : 'Quelle est la **signification** de ce kanji ?';

  return new EmbedBuilder()
    .setColor('#e63946')
    .setTitle(question.entry.kanji)
    .setDescription(`${prompt}\n\n⏱️ **${ANSWER_TIMEOUT_MS / 1000} secondes** pour répondre !`)
    .setFooter({
      text: `Question ${session.current}/${session.totalQuestions} • Niveau ${levelLabel[session.level]} • Mode ${modeLabel}`,
    });
}

export function buildScoreEmbed(
  session: KanjiSession,
  title: string,
  description?: string
): EmbedBuilder {
  const sorted = Object.entries(session.scores).sort((a, b) => b[1] - a[1]);
  const medals = ['🥇', '🥈', '🥉'];

  let board = '';
  for (let i = 0; i < sorted.length; i++) {
    const [userId, pts] = sorted[i];
    const medal = medals[i] ?? `${i + 1}.`;
    board += `${medal} <@${userId}> — **${pts}** point${pts > 1 ? 's' : ''}\n`;
  }

  return new EmbedBuilder()
    .setColor('#f4a261')
    .setTitle(title)
    .setDescription(
      (description ? description + '\n\n' : '') + (board || '*Aucun point marqué*')
    )
    .setTimestamp();
}

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
  if (!question) {
    onEnd();
    return;
  }

  session.question = question;
  session.answered = false;

  const embed = buildQuestionEmbed(session, question);
  const row = buildQuestionComponents(question, session.channelId);

  const msg = await channel.send({ embeds: [embed], components: [row] });
  session.questionMessage = msg;

  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(async () => {
    if (!session.active || session.answered) return;
    session.answered = true;

    // Désactiver les boutons en révélant la bonne réponse
    const disabledRow = buildQuestionComponents(question, session.channelId, true, true);
    await msg.edit({ components: [disabledRow] }).catch(() => null);

    await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor('#6c757d')
            .setDescription(
              `⏰ Temps écoulé ! La bonne réponse était : **${question.correctAnswer}**`
            ),
        ],
      })
      .catch(() => null);

    await new Promise((r) => setTimeout(r, BETWEEN_QUESTION_MS));
    if (!session.active) return;
    await nextQuestion(session, channel, onEnd);
  }, ANSWER_TIMEOUT_MS);
}
