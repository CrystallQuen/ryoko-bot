import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../../types';
import { getSession, destroySession, buildScoreEmbed, buildSetupMessage, getPendingConfig } from '../../modules/kanji/session';
import { logger } from '../../../utils/logger';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kanji')
    .setDescription('Quiz de kanji japonais')
    .addSubcommand((sub) =>
      sub.setName('start').setDescription('Configurer et démarrer un quiz')
    )
    .addSubcommand((sub) =>
      sub.setName('stop').setDescription('Arrêter le quiz en cours et afficher les scores')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'start') {
        if (getSession(interaction.channelId)?.active) {
          await interaction.reply({ content: '❌ Un quiz est déjà en cours ! Utilisez `/kanji stop` pour l\'arrêter.', ephemeral: true });
          return;
        }
        const key = `${interaction.channelId}:${interaction.user.id}`;
        const cfg = getPendingConfig(key);
        await interaction.reply(buildSetupMessage(interaction.channelId, interaction.user.id, cfg));

      } else if (sub === 'stop') {
        const session = getSession(interaction.channelId);
        if (!session?.active) {
          await interaction.reply({ content: '❌ Aucun quiz en cours dans ce salon.', ephemeral: true });
          return;
        }
        session.active = false;
        const embed = buildScoreEmbed(session, '⛔ Quiz arrêté — Tableau des scores', `Arrêté à la question ${session.current}/${session.totalQuestions}`);
        destroySession(interaction.channelId);
        await interaction.reply({ embeds: [embed] });
        logger.info('Quiz kanji arrêté manuellement', { channelId: interaction.channelId });
      }
    } catch (err) {
      logger.debug('Erreur interaction /kanji', { err });
    }
  },
};

export default command;
