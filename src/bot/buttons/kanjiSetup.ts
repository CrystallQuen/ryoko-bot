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
import { clearSetup, isStarting, lockStart, unlockStart } from '../modules/kanji/lock';
import { getKanjiByLevel } from '../modules/kanji/data';
import { logger } from '../../utils/logger';

const handler: ButtonHandler = {
  customId: /^kcfg_start:/,

  async execute(interaction: ButtonInteraction): Promise<void> {
    const [, channelId, userId] = interaction.customId.split(':');
    const key = `${channelId}:${userId}`;

    if (interaction.user.id !== userId) {
      await interaction.reply({ content: '❌ Seul l\'auteur peut démarrer ce quiz.', ephemeral: true }).catch(() => null);
      return;
    }

    if (getSession(channelId)?.active || isStarting(channelId)) {
      await interaction.reply({ content: '❌ Un quiz est déjà en cours dans ce salon !', ephemeral: true }).catch(() => null);
      return;
    }

    // Verrouiller avant tout await
    lockStart(channelId);
    clearSetup(channelId);

    // Acquitter l'interaction immédiatement — si ça échoue c'est qu'une autre instance a déjà répondu
    try {
      await interaction.deferUpdate();
    } catch {
      unlockStart(channelId);
      return;
    }

    // Supprimer le message de configuration (erreur silencieuse)
    await interaction.message.delete().catch(() => null);

    try {
      const cfg = getPendingConfig(key);
      clearPendingConfig(key);

      const channel = interaction.channel as TextChannel;
      const session = createSession(channelId, userId, cfg);
      unlockStart(channelId);

      const levelLabel: Record<string, string> = {
        N5: 'N5 — Débutant 🌱',
        N4: 'N4 — Élémentaire 📗',
        N3: 'N3 — Intermédiaire 📘',
      };
      const timeLabel = cfg.timeoutMs === null
        ? '♾️ Illimité'
        : `⏱️ ${cfg.timeoutMs / 1000}s par question`;

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
    } catch (err) {
      unlockStart(channelId);
      logger.error('Erreur démarrage quiz kanji', { err });
    }
  },
};

export default handler;
