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
} from '../modules/kanji/session';

const event: BotEvent = {
  name: 'messageCreate',
  async execute(message: Message) {
    if (message.author.bot || !message.guild) return;

    // ── Quiz kanji — réponse textuelle ────────────────────────────────────
    const session = getSession(message.channelId);
    if (session?.active && session.question && !session.answered) {
      const isCorrect = checkAnswer(session, message.content);

      if (isCorrect) {
        session.answered = true;
        if (session.timer) clearTimeout(session.timer);

        session.scores[message.author.id] = (session.scores[message.author.id] ?? 0) + 1;
        const pts = session.scores[message.author.id];
        const correctList = [...new Set([...session.question.entry.readings, ...session.question.entry.meanings])].join(', ');
        const channel = message.channel as TextChannel;

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#2d6a4f')
              .setTitle(`✅ Bonne réponse — ${session.question.entry.kanji}`)
              .setDescription(
                `<@${message.author.id}> a trouvé !\n` +
                  `**Réponses acceptées :** ${correctList}\n\n` +
                  `Score : **${pts}** point${pts > 1 ? 's' : ''} 🏆`
              ),
          ],
        });

        await new Promise((r) => setTimeout(r, 2_000));
        if (!session.active) return;

        function onEnd() {
          const s = getSession(message.channelId);
          if (!s) return;
          s.active = false;
          const endEmbed = buildScoreEmbed(
            s,
            '🏁 Quiz terminé — Tableau des scores',
            `${s.totalQuestions} question${s.totalQuestions > 1 ? 's' : ''} • Niveau ${s.level}`
          );
          channel.send({ embeds: [endEmbed] }).catch(() => null);
          destroySession(message.channelId);
        }

        await nextQuestion(session, channel, onEnd);
      }
      // En mode illimité, on ne bloque pas les autres messages — on continue
      if (session.timeoutMs !== null) return;
    }

    // ── Anti-spam + XP ────────────────────────────────────────────────────
    try {
      const guildData = await getOrCreateGuild(message.guild.id, message.guild.name);

      const spamConfig = await prisma.antiSpamConfig.findUnique({
        where: { guildId: message.guild.id },
      });
      if (spamConfig?.enabled) await checkAntiSpam(message, spamConfig);
      if (guildData.levelEnabled) await handleXp(message, guildData);
    } catch (error) {
      logger.error('Erreur messageCreate', { error });
    }
  },
};

export default event;
