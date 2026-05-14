import { StringSelectMenuInteraction } from 'discord.js';
import { SelectMenuHandler } from '../../types';
import { getPendingConfig, setPendingConfig, buildSetupMessage, type QuizLevel } from '../modules/kanji/session';
import { logger } from '../../utils/logger';

const handler: SelectMenuHandler = {
  customId: /^kcfg_(level|questions|time):/,

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    // Format : kcfg_{type}:{channelId}:{userId}
    const [typeWithPrefix, channelId, userId] = interaction.customId.split(':');
    const type = typeWithPrefix.replace('kcfg_', '');
    const key = `${channelId}:${userId}`;
    const value = interaction.values[0];

    if (interaction.user.id !== userId) {
      try {
        await interaction.reply({ content: '❌ Seul l\'auteur de la commande peut configurer ce quiz.', ephemeral: true });
      } catch { /* expirée */ }
      return;
    }

    if (type === 'level') {
      setPendingConfig(key, { level: value as QuizLevel });
    } else if (type === 'questions') {
      setPendingConfig(key, { questions: parseInt(value, 10) });
    } else if (type === 'time') {
      const ms = parseInt(value, 10);
      setPendingConfig(key, { timeoutMs: ms === 0 ? null : ms });
    }

    const cfg = getPendingConfig(key);
    try {
      await interaction.update(buildSetupMessage(channelId, userId, cfg));
    } catch (err) {
      logger.debug('Impossible de mettre à jour la config kanji', { err });
    }
  },
};

export default handler;
