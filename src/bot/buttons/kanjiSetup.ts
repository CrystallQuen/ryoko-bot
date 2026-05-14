import { ButtonInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { ButtonHandler } from '../../types';
import {
  getSession,
  createSession,
  destroySession,
  nextQuestion,
  buildScoreEmbed,
  getPendingConfig,
  clearPendingConfig,
} from '../modules/kanji/session';
import { getKanjiByLevel } from '../modules/kanji/data';
import { logger } from '../../utils/logger';

const handler: ButtonHandler = {
  customId: /^kcfg_start:/,

  async execute(interaction: ButtonInteraction): Promise<void> {
    // Format : kcfg_start:{channelId}:{userId}
    const [, channelId, userId] = interaction.customId.split(':');
    const key = `${channelId}:${userId}`;

    if (interaction.user.id !== userId) {
      try { await interaction.reply({ content: '❌ Seul l\'auteur de la commande peut démarrer ce quiz.', ephemeral: true }); } catch { /**/ }
      return;
    }

    if (getSession(channelId)?.active) {
      try { await interaction.reply({ content: '❌ Un quiz est déjà en cours dans ce salon !', ephemeral: true }); } catch { /**/ }
      return;
    }

    const cfg = getPendingConfig(key);
    clearPendingConfig(key);

    if (getKanjiByLevel(cfg.level).length === 0) {
      try { await interaction.reply({ content: '❌ Aucun kanji disponible pour ce niveau.', ephemeral: true }); } catch { /**/ }
      return;
    }

    const channel = interaction.channel as TextChannel;
    const session = createSession(channelId, userId, cfg);

    try { await interaction.message.delete(); } catch { /**/ }

    const levelLabel = { N5: 'N5 — Débutant 🌱', N4: 'N4 — Élémentaire 📗', N3: 'N3 — Intermédiaire 📘' };
    const timeLabel = cfg.timeoutMs === null ? '♾️ Illimité' : `⏱️ ${cfg.timeoutMs / 1000}s par question`;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#e63946')
          .setTitle('🎌 Quiz de Kanji — C\'est parti !')
          .setDescription(
            `**Niveau :** ${levelLabel[cfg.level]}\n` +
              `**Questions :** ${cfg.questions}\n` +
              `**Temps :** ${timeLabel}\n\n` +
              `Tapez votre réponse directement dans le chat !\n` +
              `Lectures **et** significations sont acceptées 💬`
          )
          .setFooter({ text: `Quiz démarré par ${interaction.user.displayName}` })
          .setTimestamp(),
      ],
    });

    function onEnd() {
      const s = getSession(channelId);
      if (!s) return;
      s.active = false;
      const endEmbed = buildScoreEmbed(
        s,
        '🏁 Quiz terminé — Tableau des scores',
        `${s.totalQuestions} question${s.totalQuestions > 1 ? 's' : ''} • Niveau ${cfg.level}`
      );
      channel.send({ embeds: [endEmbed] }).catch(() => null);
      destroySession(channelId);
      logger.info('Quiz kanji terminé', { channelId, scores: s.scores });
    }

    await nextQuestion(session, channel, onEnd);
  },
};

export default handler;
