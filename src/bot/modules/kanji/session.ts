import { TextChannel, EmbedBuilder } from 'discord.js';
import type { KanjiEntry, JlptLevel } from './data';
import { getKanjiByLevel, shuffled, pickRandom } from './data';

export type QuizMode = 'lecture' | 'signification';
export type QuizLevel = JlptLevel | 'mixte';

export interface KanjiQuestion {
  entry: KanjiEntry;
  mode: QuizMode;
  correctAnswers: string[];
}

export interface KanjiSession {
  active: boolean;
  level: QuizLevel;
  mode: QuizMode;
  totalQuestions: number;
  current: number;
  question: KanjiQuestion | null;
  scores: Record<string, number>; // userId → points
  usedKanji: Set<string>;
  channelId: string;
  startedBy: string;
  startedAt: Date;
  timer: ReturnType<typeof setTimeout> | null;
  answered: boolean;
}

// channel ID → session
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

function buildQuestion(session: KanjiSession): KanjiQuestion | null {
  const pool = getKanjiByLevel(session.level).filter(
    (k) => !session.usedKanji.has(k.kanji)
  );
  if (pool.length === 0) return null;

  const entry = pickRandom(pool);
  session.usedKanji.add(entry.kanji);

  const correctAnswers =
    session.mode === 'lecture' ? entry.readings : entry.meanings;

  return { entry, mode: session.mode, correctAnswers };
}

export function buildQuestionEmbed(
  session: KanjiSession,
  question: KanjiQuestion
): EmbedBuilder {
  const levelLabel: Record<QuizLevel, string> = {
    N5: 'N5',
    N4: 'N4',
    N3: 'N3',
    mixte: 'Mixte',
  };
  const modeLabel = question.mode === 'lecture' ? '📖 Lecture' : '💬 Signification';
  const prompt =
    question.mode === 'lecture'
      ? 'Quelle est la **lecture** (hiragana) de ce kanji ?'
      : 'Quelle est la **signification** (en français) de ce kanji ?';

  return new EmbedBuilder()
    .setColor('#e63946')
    .setTitle(`${question.entry.kanji}`)
    .setDescription(
      `${prompt}\n\n⏱️ Vous avez **${ANSWER_TIMEOUT_MS / 1000} secondes** pour répondre !`
    )
    .setFooter({
      text: `Question ${session.current}/${session.totalQuestions} • Niveau ${levelLabel[session.level]} • Mode ${modeLabel}`,
    });
}

export function checkAnswer(session: KanjiSession, answer: string): boolean {
  if (!session.question) return false;
  const norm = answer.trim().toLowerCase();
  return session.question.correctAnswers.some(
    (a) => a.toLowerCase() === norm
  );
}

export function buildScoreEmbed(
  session: KanjiSession,
  title: string,
  description?: string
): EmbedBuilder {
  const sorted = Object.entries(session.scores).sort((a, b) => b[1] - a[1]);

  let board = '';
  const medals = ['🥇', '🥈', '🥉'];
  for (let i = 0; i < sorted.length; i++) {
    const [userId, pts] = sorted[i];
    const medal = medals[i] ?? `${i + 1}.`;
    board += `${medal} <@${userId}> — **${pts}** point${pts > 1 ? 's' : ''}\n`;
  }

  return new EmbedBuilder()
    .setColor('#f4a261')
    .setTitle(title)
    .setDescription(
      (description ? description + '\n\n' : '') +
        (board || '*Aucun point marqué*')
    )
    .setTimestamp();
}

/**
 * Démarre le prochain cycle de question.
 * Renvoie null si la session est terminée (plus de questions).
 */
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
  await channel.send({ embeds: [embed] });

  // Timer de réponse
  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(async () => {
    if (!session.active) return;
    if (session.answered) return;

    const correctList = question.correctAnswers.join(', ');
    await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor('#6c757d')
            .setDescription(
              `⏰ Temps écoulé ! La bonne réponse était : **${correctList}**`
            ),
        ],
      })
      .catch(() => null);

    // Prochaine question après un court délai
    await new Promise((r) => setTimeout(r, BETWEEN_QUESTION_MS));
    if (!session.active) return;
    await nextQuestion(session, channel, onEnd);
  }, ANSWER_TIMEOUT_MS);
}
