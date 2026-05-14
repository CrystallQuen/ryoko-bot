import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { logger } from '../../../utils/logger';
import type { QuizLevel, QuizMode } from '../../modules/kanji/session';
import {
  getSession,
  createSession,
  destroySession,
  nextQuestion,
  buildScoreEmbed,
  ANSWER_TIMEOUT_MS,
} from '../../modules/kanji/session';
import { getKanjiByLevel } from '../../modules/kanji/data';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kanji')
    .setDescription('Quiz de kanji japonais (style Kotoba) — répondez via les boutons !')
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Démarrer un quiz de kanji')
        .addStringOption((o) =>
          o
            .setName('niveau')
            .setDescription('Niveau JLPT des kanji')
            .setRequired(false)
            .addChoices(
              { name: 'N5 (débutant)', value: 'N5' },
              { name: 'N4 (élémentaire)', value: 'N4' },
              { name: 'N3 (intermédiaire)', value: 'N3' },
              { name: 'Mixte (tous niveaux)', value: 'mixte' }
            )
        )
        .addStringOption((o) =>
          o
            .setName('mode')
            .setDescription('Type de question')
            .setRequired(false)
            .addChoices(
              { name: 'Lecture (hiragana)', value: 'lecture' },
              { name: 'Signification (français)', value: 'signification' }
            )
        )
        .addIntegerOption((o) =>
          o
            .setName('questions')
            .setDescription('Nombre de questions (1–30, défaut 10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(30)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('stop').setDescription('Arrêter le quiz en cours')
    )
    .addSubcommand((sub) =>
      sub.setName('score').setDescription('Voir les scores de la partie en cours')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') await handleStart(interaction);
    else if (sub === 'stop') await handleStop(interaction);
    else if (sub === 'score') await handleScore(interaction);
  },
};

async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;

  if (getSession(channelId)?.active) {
    await interaction.reply({
      content: '❌ Un quiz est déjà en cours dans ce salon ! Utilisez `/kanji stop` pour l\'arrêter.',
      ephemeral: true,
    });
    return;
  }

  const level = (interaction.options.getString('niveau') ?? 'N5') as QuizLevel;
  const mode = (interaction.options.getString('mode') ?? 'lecture') as QuizMode;
  const total = interaction.options.getInteger('questions') ?? 10;

  const pool = getKanjiByLevel(level);
  if (pool.length < 4) {
    await interaction.reply({
      content: `❌ Pas assez de kanji pour ce niveau (minimum 4 requis).`,
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const session = createSession(channelId, interaction.user.id, level, mode, total);

  const levelLabels: Record<QuizLevel, string> = {
    N5: 'N5 — Débutant',
    N4: 'N4 — Élémentaire',
    N3: 'N3 — Intermédiaire',
    mixte: 'Mixte — Tous niveaux',
  };
  const modeLabel = mode === 'lecture' ? '📖 Lecture (hiragana)' : '💬 Signification (français)';

  const startEmbed = new EmbedBuilder()
    .setColor('#e63946')
    .setTitle('🎌 Quiz de Kanji — Début !')
    .setDescription(
      `**Niveau :** ${levelLabels[level]}\n` +
        `**Mode :** ${modeLabel}\n` +
        `**Questions :** ${total}\n` +
        `**Temps par question :** ${ANSWER_TIMEOUT_MS / 1000}s\n\n` +
        `Cliquez sur le bouton correspondant à la bonne réponse !\n` +
        `La première bonne réponse rapporte **1 point** 🏆`
    )
    .setFooter({ text: `Quiz démarré par ${interaction.user.displayName}` })
    .setTimestamp();

  await interaction.reply({ embeds: [startEmbed] });

  function onEnd() {
    const s = getSession(channelId);
    if (!s) return;
    s.active = false;
    const endEmbed = buildScoreEmbed(
      s,
      '🏁 Quiz terminé !',
      `${s.totalQuestions} question${s.totalQuestions > 1 ? 's' : ''} posée${s.totalQuestions > 1 ? 's' : ''}`
    );
    channel.send({ embeds: [endEmbed] }).catch(() => null);
    destroySession(channelId);
    logger.info('Quiz kanji terminé', { channelId, scores: s.scores });
  }

  await nextQuestion(session, channel, onEnd);
}

async function handleStop(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;
  const session = getSession(channelId);

  if (!session?.active) {
    await interaction.reply({ content: '❌ Aucun quiz en cours dans ce salon.', ephemeral: true });
    return;
  }

  session.active = false;
  const scoreEmbed = buildScoreEmbed(session, '⛔ Quiz arrêté', 'La partie a été interrompue.');
  destroySession(channelId);

  await interaction.reply({ embeds: [scoreEmbed] });
}

async function handleScore(interaction: ChatInputCommandInteraction): Promise<void> {
  const session = getSession(interaction.channelId);

  if (!session?.active) {
    await interaction.reply({ content: '❌ Aucun quiz en cours dans ce salon.', ephemeral: true });
    return;
  }

  const scoreEmbed = buildScoreEmbed(
    session,
    '📊 Scores en cours',
    `Question ${session.current}/${session.totalQuestions}`
  );
  await interaction.reply({ embeds: [scoreEmbed], ephemeral: true });
}

export default command;
