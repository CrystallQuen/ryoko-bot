import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler } from '../../types';
import { getEventConfig, setEventConfig, buildEventSetupMessage, parseEventDate } from '../modules/events/eventConfig';

const handler: ModalHandler = {
  customId: /^ecfg_modal:/,

  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    const userId = interaction.customId.split(':')[1];

    if (interaction.user.id !== userId) return;

    const titre = interaction.fields.getTextInputValue('titre').trim();
    const dateStr = interaction.fields.getTextInputValue('date').trim();
    const description = interaction.fields.getTextInputValue('description').trim();

    // Valide la date immédiatement pour prévenir l'utilisateur
    const parsed = parseEventDate(dateStr);
    if (!parsed) {
      await interaction.reply({
        content: '❌ Format de date invalide. Utilisez **JJ/MM/AAAA HH:MM** (ex: 25/12/2025 20:00)',
        flags: 'Ephemeral',
      });
      return;
    }
    if (parsed <= new Date()) {
      await interaction.reply({
        content: '❌ La date doit être dans le futur.',
        flags: 'Ephemeral',
      });
      return;
    }

    setEventConfig(userId, { titre, dateStr, description });

    const cfg = getEventConfig(userId);
    const setup = buildEventSetupMessage(userId, cfg);

    await interaction.deferUpdate();
    await interaction.message?.edit({ embeds: setup.embeds, components: setup.components as never }).catch(() => null);
  },
};

export default handler;
