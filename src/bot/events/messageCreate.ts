import { Message, EmbedBuilder, TextChannel } from 'discord.js';
import { BotEvent } from '../../types';
import { prisma, getOrCreateGuild } from '../../database';
import { logger } from '../../utils/logger';
import { checkAntiSpam } from '../modules/antispam';
import { handleXp } from '../modules/levels';
import {
  getSession,
  checkAnswer,
  nextQuestion,
  buildScoreEmbed,
  destroySession,
  ANSWER_TIMEOUT_MS,
} from '../modules/kanji/session';

const event: BotEvent = {
  name: 'messageCreate',
  async execute(message: Message) {
    if (message.author.bot || !message.guild) return;

    // ── Quiz kanji ─────────────────────────────────────────────────────────
    const kanjiSession = getSession(message.channelId);
    if (kanjiSession?.active && kanjiSession.question && !kanjiSession.answered) {
      if (checkAnswer(kanjiSession, message.content)) {
        kanjiSession.answered = true;
        if (kanjiSession.timer) clearTimeout(kanjiSession.timer);

        // Attribue le point
        kanjiSession.scores[message.author.id] =
          (kanjiSession.scores[message.author.id] ?? 0) + 1;

        const correctList = kanjiSession.question.correctAnswers.join(', ');
        const channel = message.channel as TextChannel;

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#2d6a4f')
              .setDescription(
                `✅ Bonne réponse, <@${message.author.id}> ! **${correctList}**\n` +
                  `Score : **${kanjiSession.scores[message.author.id]}** point${kanjiSession.scores[message.author.id] > 1 ? 's' : ''}`
              ),
          ],
        });

        // Pause puis prochaine question
        await new Promise((r) => setTimeout(r, 2_000));
        if (!kanjiSession.active) return;

        function onEnd() {
          const s = getSession(message.channelId);
          if (!s) return;
          s.active = false;
          const endEmbed = buildScoreEmbed(
            s,
            '🏁 Quiz terminé !',
            `${s.totalQuestions} question${s.totalQuestions > 1 ? 's' : ''} posée${s.totalQuestions > 1 ? 's' : ''}`
          );
          channel.send({ embeds: [endEmbed] }).catch(() => null);
          destroySession(message.channelId);
        }

        await nextQuestion(kanjiSession, channel, onEnd);
      }
      return; // Ne pas traiter XP/spam pendant le quiz
    }

    try {
      const guildData = await getOrCreateGuild(message.guild.id, message.guild.name);

      // Anti-spam
      const spamConfig = await prisma.antiSpamConfig.findUnique({
        where: { guildId: message.guild.id },
      });

      if (spamConfig?.enabled) {
        await checkAntiSpam(message, spamConfig);
      }

      // Système de niveaux XP
      if (guildData.levelEnabled) {
        await handleXp(message, guildData);
      }
    } catch (error) {
      logger.error('Erreur messageCreate', { error });
    }
  },
};

export default event;
