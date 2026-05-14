import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler } from '../../types';
import { getEventConfig, setEventConfig, buildEventSetupMessage } from '../modules/events/eventConfig';

const handler: ModalHandler = {
  customId: /^ecfg_modal:/,

  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    const userId = interaction.customId.split(':')[1];

    if (interaction.user.id !== userId) return;

    const titre = interaction.fields.getTextInputValue('titre').trim();
    const description = interaction.fields.getTextInputValue('description').trim();

    setEventConfig(userId, { titre, description });

    const cfg = getEventConfig(userId);
    const setup = buildEventSetupMessage(userId, cfg);

    await interaction.deferUpdate();
    await interaction.editReply({ embeds: setup.embeds, components: setup.components as never }).catch(() => null);
  },
};

export default handler;
