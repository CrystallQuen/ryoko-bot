import { StringSelectMenuInteraction  } from 'discord.js';
import { SelectMenuHandler } from '../../types';
import {
  getPendingConfig,
  setPendingConfig,
  buildSetupMessage,
  type QuizLevel,
} from '../modules/kanji/session';
import { logger } from '../../utils/logger';

const handler: SelectMenuHandler = {
  customId: /^kcfg_(level|questions|time):/,

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    // Format : kcfg_{type}:{channelId}:{userId}
    const parts = interaction.customId.split(':');
    const type = parts[0].replace('kcfg_', ''); // level | questions | time
    const channelId = parts[1];
    const userId = parts[2];
    const key = `${channelId}:${userId}`;
    const value = interaction.values[0];

    if (interaction.user.id !== userId) {
      try {
        await interaction.reply({
          content: '❌ Seul l\'auteur de la commande peut configurer ce quiz.',
          flags: 'Ephemeral',
        });
      } catch { /**/ }
      return;
    }

    // Acquitter immédiatement pour éviter le blocage "..."
    await interaction.deferUpdate();

    // Mettre à jour la config en mémoire
    if (type === 'level') {
      setPendingConfig(key, { level: value as QuizLevel });
    } else if (type === 'questions') {
      setPendingConfig(key, { questions: parseInt(value, 10) });
    } else if (type === 'time') {
      const ms = parseInt(value, 10);
      setPendingConfig(key, { timeoutMs: ms === 0 ? null : ms });
    }

    // Reconstruire et éditer le message
    const cfg = getPendingConfig(key);
    const setup = buildSetupMessage(channelId, userId, cfg);

    try {
      await interaction.editReply({ embeds: setup.embeds, components: setup.components as never });
    } catch (err) {
      logger.debug('Impossible de mettre à jour la config kanji', { err });
    }
  },
};

export default handler;
