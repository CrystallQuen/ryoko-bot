import { StringSelectMenuInteraction } from 'discord.js';
import { SelectMenuHandler } from '../../types';
import { getEventConfig, setEventConfig, buildEventSetupMessage } from '../modules/events/eventConfig';

const handler: SelectMenuHandler = {
  customId: /^ecfg_duration:/,

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    const userId = interaction.customId.split(':')[1];

    if (interaction.user.id !== userId) {
      await interaction.reply({ content: '❌ Seul l\'auteur peut modifier cette configuration.', flags: 'Ephemeral' });
      return;
    }

    const duration = parseFloat(interaction.values[0]);
    setEventConfig(userId, { duration });

    await interaction.deferUpdate();
    const cfg = getEventConfig(userId);
    const setup = buildEventSetupMessage(userId, cfg);
    await interaction.editReply({ embeds: setup.embeds, components: setup.components as never });
  },
};

export default handler;
