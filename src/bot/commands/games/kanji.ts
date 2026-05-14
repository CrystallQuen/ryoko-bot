import { SlashCommandBuilder, ChatInputCommandInteraction  } from 'discord.js';
import { SlashCommand } from '../../../types';
import {
  getSession,
  destroySession,
  buildScoreEmbed,
  buildSetupMessage,
  getPendingConfig,
  clearPendingConfig,
} from '../../modules/kanji/session';
import { hasOpenSetup, registerSetup, clearSetup } from '../../modules/kanji/lock';
import { saveQuizStats, buildHistoryEmbed } from '../../modules/kanji/stats';
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
    )
    .addSubcommand((sub) =>
      sub.setName('score').setDescription('Voir le tableau des scores de la partie en cours')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'start') {
        // Quiz déjà actif
        if (getSession(interaction.channelId)?.active) {
          await interaction.reply({
            content: '❌ Un quiz est déjà en cours dans ce salon ! Utilisez `/kanji stop` pour l\'arrêter.',
            flags: 'Ephemeral',
          });
          return;
        }

        // Panneau de configuration déjà ouvert — on le refuse pour éviter les doublons
        if (hasOpenSetup(interaction.channelId)) {
          await interaction.reply({
            content: '❌ Un panneau de configuration est déjà ouvert dans ce salon. Cliquez sur **Démarrer** ou attendez qu\'il expire.',
            flags: 'Ephemeral',
          });
          return;
        }

        const key = `${interaction.channelId}:${interaction.user.id}`;
        const cfg = getPendingConfig(key);
        const setup = buildSetupMessage(interaction.channelId, interaction.user.id, cfg);

        await interaction.reply(setup);

        // Enregistrer que ce salon a un setup ouvert
        registerSetup(interaction.channelId);

        // Auto-nettoyage après 5 minutes si personne n'a cliqué Démarrer
        setTimeout(() => {
          clearSetup(interaction.channelId);
          clearPendingConfig(key);
        }, 5 * 60 * 1000);

      } else if (sub === 'stop') {
        const session = getSession(interaction.channelId);
        if (!session?.active) {
          await interaction.reply({ content: '❌ Aucun quiz en cours dans ce salon.', flags: 'Ephemeral' });
          return;
        }
        session.active = false;
        const embed = buildScoreEmbed(
          session,
          '⛔ Quiz arrêté — Tableau des scores',
          `Arrêté à la question ${session.current}/${session.totalQuestions}`
        );
        await saveQuizStats(session);
        destroySession(interaction.channelId);
        await interaction.reply({ embeds: [embed] });
        logger.info('Quiz kanji arrêté manuellement', { channelId: interaction.channelId });

      } else if (sub === 'score') {
        const guildId = interaction.guildId;
        if (!guildId) return;

        const session = getSession(interaction.channelId);
        if (session?.active) {
          // Quiz en cours : scores de la partie actuelle
          const embed = buildScoreEmbed(
            session,
            '📊 Scores en cours',
            `Question ${session.current}/${session.totalQuestions} • Niveau ${session.level}`
          );
          await interaction.reply({ embeds: [embed], flags: 'Ephemeral' });
        } else {
          // Pas de quiz actif : historique global du serveur
          await interaction.deferReply({ flags: 'Ephemeral' });
          const embed = await buildHistoryEmbed(guildId);
          await interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (err) {
      logger.debug('Erreur interaction /kanji', { err });
    }
  },
};

export default command;
