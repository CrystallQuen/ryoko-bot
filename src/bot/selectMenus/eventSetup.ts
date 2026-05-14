import { StringSelectMenuInteraction } from 'discord.js';
import { SelectMenuHandler } from '../../types';
import { getEventConfig, setEventConfig, buildEventSetupMessage } from '../modules/events/eventConfig';

const handler: SelectMenuHandler = {
  customId: /^ecfg_(date|hour|minute|duration):/,

  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const type = parts[0].replace('ecfg_', '');
    const userId = parts[1];

    if (interaction.user.id !== userId) {
      await interaction.reply({ content: '❌ Seul l\'auteur peut modifier cette configuration.', flags: 'Ephemeral' });
      return;
    }

    if (type === 'date') {
      setEventConfig(userId, { selectedDate: interaction.values[0] });
    } else if (type === 'hour') {
      setEventConfig(userId, { selectedHour: parseInt(interaction.values[0]) });
    } else if (type === 'minute') {
      setEventConfig(userId, { selectedMinute: parseInt(interaction.values[0]) });
    } else if (type === 'duration') {
      setEventConfig(userId, { duration: parseFloat(interaction.values[0]) });
    }

    await interaction.deferUpdate();
    const cfg = getEventConfig(userId);
    const setup = buildEventSetupMessage(userId, cfg);
    await interaction.editReply({ embeds: setup.embeds, components: setup.components as never });
  },
};

export default handler;
