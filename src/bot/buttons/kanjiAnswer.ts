import { ButtonInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { ButtonHandler } from '../../types';
import {
  getSession,
  destroySession,
  nextQuestion,
  buildScoreEmbed,
  buildQuestionComponents,
  ANSWER_TIMEOUT_MS,
} from '../modules/kanji/session';

const handler: ButtonHandler = {
  customId: /^kanji_answer:/,

  async execute(interaction: ButtonInteraction): Promise<void> {
    // Format: kanji_answer:{channelId}:{choiceIndex}
    const parts = interaction.customId.split(':');
    const channelId = parts[1];
    const choiceIndex = parseInt(parts[2], 10);

    const session = getSession(channelId);

    // Session expirée ou déjà répondu
    if (!session?.active || session.answered || !session.question) {
      await interaction.reply({
        content: '⌛ Cette question est déjà terminée !',
        ephemeral: true,
      }).catch(() => null);
      return;
    }

    session.answered = true;
    if (session.timer) clearTimeout(session.timer);

    const question = session.question;
    const isCorrect = choiceIndex === question.correctIndex;
    const channel = interaction.channel as TextChannel;

    // Désactiver les boutons en coloriant correct en vert, mauvais en rouge
    const buttons = buildQuestionComponents(question, channelId, true, true);
    // Colorier aussi le bouton cliqué en rouge si mauvais
    if (!isCorrect) {
      const btn = buttons.components[choiceIndex];
      if (btn) {
        btn.setStyle(2); // Danger = rouge
      }
    }

    await interaction.update({ components: [buttons] }).catch(() => null);

    if (isCorrect) {
      session.scores[interaction.user.id] =
        (session.scores[interaction.user.id] ?? 0) + 1;

      const pts = session.scores[interaction.user.id];
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#2d6a4f')
            .setDescription(
              `✅ Bonne réponse, <@${interaction.user.id}> ! **${question.correctAnswer}**\n` +
                `Score : **${pts}** point${pts > 1 ? 's' : ''} 🏆`
            ),
        ],
      });
    } else {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#c1121f')
            .setDescription(
              `❌ Mauvaise réponse, <@${interaction.user.id}> !\n` +
                `La bonne réponse était : **${question.correctAnswer}**`
            ),
        ],
      });
    }

    // Prochaine question après une courte pause
    await new Promise((r) => setTimeout(r, 3_000));
    if (!session.active) return;

    function onEnd() {
      const s = getSession(channelId);
      if (!s) return;
      s.active = false;
      const endEmbed = buildScoreEmbed(
        s,
        '🏁 Quiz terminé !',
        `${s.totalQuestions} question${s.totalQuestions > 1 ? 's' : ''} posée${s.totalQuestions > 1 ? 's' : ''}`
      );
      channel.send({ embeds: [endEmbed] }).catch(() => null);
      destroySession(channelId);
    }

    await nextQuestion(session, channel, onEnd);
  },
};

export default handler;
