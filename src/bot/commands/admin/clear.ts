import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { SlashCommand } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime un nombre de messages dans le salon')
    .addIntegerOption((opt) =>
      opt
        .setName('nombre')
        .setDescription('Nombre de messages à supprimer (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const amount = interaction.options.getInteger('nombre', true);
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const deleted = await channel.bulkDelete(amount, true);

    await interaction.editReply({
      content: `✅ **${deleted.size}** message${deleted.size > 1 ? 's' : ''} supprimé${deleted.size > 1 ? 's' : ''}.${deleted.size < amount ? `\n> ⚠️ Certains messages ont plus de 14 jours et n'ont pas pu être supprimés.` : ''}`,
    });
  },
};

export default command;
