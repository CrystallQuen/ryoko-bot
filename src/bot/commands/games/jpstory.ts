import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Prisma } from '@prisma/client';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { errorEmbed, gameEmbed } from '../../../utils/embed';
import { logger } from '../../../utils/logger';
import type { JpStorySession } from '../../../types';

const START_SENTENCES = [
  '昔々、遠い国に一人の少女がいました。',
  '春の朝、桜の花びらが風に舞っていました。',
  '暗い森の中で、不思議な光が見えました。',
  '海の近くの小さな村に、勇敢な漁師が住んでいました。',
  '雪が降る夜に、旅人が古い宿屋に着きました。',
];

function analyzeJapanese(text: string): { score: number; feedback: string[]; corrections: string[] } {
  const feedback: string[] = [];
  const corrections: string[] = [];
  let score = 0;

  const kanjiMatch = text.match(/[一-龯]/g);
  if (kanjiMatch && kanjiMatch.length > 0) {
    score += kanjiMatch.length * 2;
    feedback.push(`✅ Kanji utilisés : ${kanjiMatch.length} (+${kanjiMatch.length * 2} pts)`);
  }

  const kanaMatch = text.match(/[぀-ヿ]/g);
  if (kanaMatch && kanaMatch.length > 0) {
    score += Math.min(kanaMatch.length, 20);
    feedback.push(`✅ Kana présents : ${kanaMatch.length} (+${Math.min(kanaMatch.length, 20)} pts)`);
  }

  if (/[。！？、]/.test(text)) {
    score += 3;
    feedback.push('✅ Ponctuation japonaise utilisée (+3 pts)');
  }

  if (text.length >= 20) {
    score += 5;
    feedback.push('✅ Phrase longue (+5 pts)');
  }
  if (text.length >= 40) {
    score += 5;
    feedback.push('✅ Phrase très longue (+5 pts)');
  }

  const latinMatch = text.match(/[a-zA-Z]/g);
  if (latinMatch && latinMatch.length > 3) {
    score = Math.max(0, score - 5);
    corrections.push('⚠️ Évitez de mélanger trop de caractères latins dans le texte japonais.');
  }

  if (score === 0) {
    corrections.push('❌ Utilisez des caractères japonais (hiragana, katakana, kanji) !');
  }

  return { score, feedback, corrections };
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('jp-story')
    .setDescription('Mini-jeu de rédaction japonaise collaborative')
    .addSubcommand((sub) => sub.setName('start').setDescription('Commencer une histoire'))
    .addSubcommand((sub) => sub.setName('stop').setDescription("Terminer l'histoire"))
    .addSubcommand((sub) =>
      sub
        .setName('ecrire')
        .setDescription("Continuer l'histoire")
        .addStringOption((o) =>
          o.setName('phrase').setDescription('Votre phrase en japonais').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('classement').setDescription('Voir les scores')),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const guild = interaction.guild!;
    const channelId = interaction.channelId;
    await getOrCreateGuild(guild.id, guild.name);
    const sub = interaction.options.getSubcommand();

    const existing = await prisma.gameSession.findFirst({
      where: { guildId: guild.id, channelId, type: 'JP_STORY', active: true },
    });

    if (sub === 'start') {
      if (existing) {
        await interaction.editReply({
          embeds: [errorEmbed('Déjà en cours', 'Une histoire est déjà en cours !')],
        });
        return;
      }

      const startSentence = START_SENTENCES[Math.floor(Math.random() * START_SENTENCES.length)];

      const session: JpStorySession = {
        active: true,
        story: [{ userId: 'bot', text: startSentence, score: 0, corrections: [] }],
        startedAt: new Date(),
        startedBy: interaction.user.id,
      };

      await prisma.gameSession.create({
        data: {
          guildId: guild.id,
          channelId,
          type: 'JP_STORY',
          data: session as unknown as Prisma.JsonObject,
          active: true,
        },
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📖 Histoire japonaise — Début !')
            .setDescription(
              `Je commence l'histoire :\n\n> ${startSentence}\n\nContinuez avec \`/jp-story write\` !`
            )
            .addFields({
              name: 'Système de points',
              value:
                '• Kanji : +2 pts/kanji\n• Phrase longue : +5 pts\n• Ponctuation : +3 pts\n• Mélange latin : -5 pts',
            })
            .setTimestamp(),
        ],
      });

      logger.info('jp-story démarré', { guildId: guild.id, channelId });
      return;
    }

    if (sub === 'stop') {
      if (!existing) {
        await interaction.editReply({
          embeds: [errorEmbed("Pas d'histoire", 'Aucune histoire en cours.')],
        });
        return;
      }

      const session = existing.data as unknown as JpStorySession;

      const playerScores: Record<string, number> = {};
      for (const entry of session.story) {
        if (entry.userId === 'bot') continue;
        playerScores[entry.userId] = (playerScores[entry.userId] ?? 0) + entry.score;
      }

      const ranking =
        Object.entries(playerScores)
          .sort(([, a], [, b]) => b - a)
          .map(([id, s], i) => `${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} <@${id}> : **${s} pts**`)
          .join('\n') || 'Aucun score';

      const fullStory = session.story.map((e) => e.text).join(' ');

      await prisma.gameSession.update({ where: { id: existing.id }, data: { active: false } });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('📖 Histoire terminée !')
            .setDescription(
              `> ${fullStory.substring(0, 300)}${fullStory.length > 300 ? '...' : ''}`
            )
            .addFields(
              { name: 'Segments écrits', value: (session.story.length - 1).toString(), inline: true },
              { name: 'Classement', value: ranking }
            )
            .setTimestamp(),
        ],
      });

      return;
    }

    if (sub === 'ecrire') {
      if (!existing) {
        await interaction.editReply({
          embeds: [
            errorEmbed("Pas d'histoire", 'Aucune histoire en cours. Utilisez `/jp-story start` !'),
          ],
        });
        return;
      }

      const phrase = interaction.options.getString('phrase', true).trim();
      const { score, feedback, corrections } = analyzeJapanese(phrase);

      const session = existing.data as unknown as JpStorySession;
      session.story.push({ userId: interaction.user.id, text: phrase, score, corrections });

      await prisma.gameSession.update({
        where: { id: existing.id },
        data: { data: session as unknown as Prisma.JsonObject },
      });

      const embed = new EmbedBuilder()
        .setColor(score > 0 ? '#57F287' : '#ED4245')
        .setTitle('✍️ Contribution ajoutée')
        .addFields(
          { name: 'Votre phrase', value: phrase },
          { name: 'Points', value: `**${score} pts**`, inline: true },
          { name: 'Analyse', value: feedback.join('\n') || 'Pas de bonus', inline: false }
        )
        .setTimestamp();

      if (corrections.length) {
        embed.addFields({ name: 'Corrections', value: corrections.join('\n') });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'classement') {
      if (!existing) {
        await interaction.editReply({
          embeds: [errorEmbed("Pas d'histoire", 'Aucune histoire en cours.')],
        });
        return;
      }

      const session = existing.data as unknown as JpStorySession;
      const playerScores: Record<string, number> = {};
      for (const entry of session.story) {
        if (entry.userId === 'bot') continue;
        playerScores[entry.userId] = (playerScores[entry.userId] ?? 0) + entry.score;
      }

      const ranking =
        Object.entries(playerScores)
          .sort(([, a], [, b]) => b - a)
          .map(([id, s], i) => `${i + 1}. <@${id}> — **${s} pts**`)
          .join('\n') || 'Aucun score encore';

      await interaction.editReply({ embeds: [gameEmbed('📊 Scores actuels', ranking)] });
    }
  },
};

export default command;
