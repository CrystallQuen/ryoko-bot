import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Prisma } from '@prisma/client';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { errorEmbed, gameEmbed } from '../../../utils/embed';
import {
  isValidWordAsync,
  findWordStartingWith,
  getLastChar,
  endsWithN,
  START_WORDS,
} from '../../modules/games/shiritori/dictionary';
import { logger } from '../../../utils/logger';
import type { ShiritoriSession } from '../../../types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('shiritori')
    .setDescription('Jouer au Shiritori japonais')
    .addSubcommand((sub) =>
      sub.setName('start').setDescription('Commencer une partie de Shiritori')
    )
    .addSubcommand((sub) =>
      sub.setName('stop').setDescription('Arrêter la partie en cours')
    )
    .addSubcommand((sub) =>
      sub.setName('score').setDescription('Voir le score de la partie')
    )
    .addSubcommand((sub) =>
      sub
        .setName('play')
        .setDescription('Jouer un mot')
        .addStringOption((o) =>
          o.setName('mot').setDescription('Votre mot en hiragana').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const guild = interaction.guild!;
    const channelId = interaction.channelId;
    await getOrCreateGuild(guild.id, guild.name);
    const sub = interaction.options.getSubcommand();

    const existing = await prisma.gameSession.findFirst({
      where: { guildId: guild.id, channelId, type: 'SHIRITORI', active: true },
    });

    // ── start ────────────────────────────────────────────────────────────────
    if (sub === 'start') {
      if (existing) {
        await interaction.editReply({
          embeds: [errorEmbed('Partie en cours', 'Une partie de Shiritori est déjà en cours !')],
        });
        return;
      }

      const startWord = START_WORDS[Math.floor(Math.random() * START_WORDS.length)];

      const session: ShiritoriSession = {
        active: true,
        words: [startWord],
        currentChar: getLastChar(startWord),
        scores: {},
        startedAt: new Date(),
        lastActivity: new Date(),
        startedBy: interaction.user.id,
      };

      await prisma.gameSession.create({
        data: {
          guildId: guild.id,
          channelId,
          type: 'SHIRITORI',
          data: session as unknown as Prisma.JsonObject,
          active: true,
        },
      });

      await interaction.editReply({
        embeds: [
          gameEmbed(
            '🎮 Shiritori - Partie lancée !',
            `Je commence avec : **${startWord}**\n\nLe prochain mot doit commencer par **${getLastChar(startWord)}**\n\nUtilisez \`/shiritori play\` pour jouer !`
          ),
        ],
      });

      logger.info('Shiritori démarré', { guildId: guild.id, channelId });
      return;
    }

    // ── stop ─────────────────────────────────────────────────────────────────
    if (sub === 'stop') {
      if (!existing) {
        await interaction.editReply({
          embeds: [errorEmbed('Pas de partie', 'Aucune partie de Shiritori en cours ici.')],
        });
        return; // ← narrowing : existing est non-null après ce bloc
      }

      const session = existing.data as unknown as ShiritoriSession;
      session.active = false;

      await prisma.gameSession.update({
        where: { id: existing.id },
        data: { active: false, data: session as unknown as Prisma.JsonObject },
      });

      const duration = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
      const topPlayers =
        Object.entries(session.scores)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([id, score], i) => `${['🥇', '🥈', '🥉'][i]} <@${id}> : **${score} pt(s)**`)
          .join('\n') || 'Aucun score';

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🏁 Partie terminée !')
            .addFields(
              { name: 'Mots joués', value: session.words.length.toString(), inline: true },
              { name: 'Durée', value: `${Math.floor(duration / 60)}m ${duration % 60}s`, inline: true },
              { name: 'Classement', value: topPlayers }
            )
            .setTimestamp(),
        ],
      });

      return;
    }

    // ── score ─────────────────────────────────────────────────────────────────
    if (sub === 'score') {
      if (!existing) {
        await interaction.editReply({
          embeds: [errorEmbed('Pas de partie', 'Aucune partie en cours.')],
        });
        return;
      }

      const session = existing.data as unknown as ShiritoriSession;
      const scores =
        Object.entries(session.scores)
          .sort(([, a], [, b]) => b - a)
          .map(([id, score], i) => `${i + 1}. <@${id}> — **${score} pt(s)**`)
          .join('\n') || 'Aucun score encore';

      await interaction.editReply({
        embeds: [
          gameEmbed(
            `📊 Scores — ${session.words.length} mots`,
            `**Mot suivant:** commence par **${session.currentChar}**\n\n${scores}`
          ),
        ],
      });

      return;
    }

    // ── play ──────────────────────────────────────────────────────────────────
    if (sub === 'play') {
      if (!existing) {
        await interaction.editReply({
          embeds: [errorEmbed('Pas de partie', 'Aucune partie en cours. Utilisez `/shiritori start` !')],
        });
        return;
      }

      const word = interaction.options.getString('mot', true).trim().toLowerCase();
      const session = existing.data as unknown as ShiritoriSession;

      if (!word.startsWith(session.currentChar)) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              'Mot invalide',
              `Le mot doit commencer par **${session.currentChar}** !\nVous avez dit : \`${word}\``
            ),
          ],
        });
        return;
      }

      if (session.words.includes(word)) {
        await interaction.editReply({
          embeds: [errorEmbed('Déjà utilisé !', `Le mot **${word}** a déjà été joué !`)],
        });
        return;
      }

      if (!(await isValidWordAsync(word))) {
        await interaction.editReply({
          embeds: [
            errorEmbed('Mot inconnu', `**${word}** n'est pas dans le dictionnaire. Essayez un autre mot !`),
          ],
        });
        return;
      }

      if (endsWithN(word)) {
        await prisma.gameSession.update({ where: { id: existing.id }, data: { active: false } });
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#ED4245')
              .setTitle('💀 Vous avez perdu !')
              .setDescription(`Le mot **${word}** se termine par **ん** !\nLe jeu s'arrête !`)
              .setTimestamp(),
          ],
        });
        return;
      }

      // Mot valide — mise à jour session
      session.words.push(word);
      session.currentChar = getLastChar(word);
      session.scores[interaction.user.id] = (session.scores[interaction.user.id] ?? 0) + 1;
      session.lastActivity = new Date();

      const botWord = findWordStartingWith(session.currentChar, session.words);

      if (!botWord) {
        // Bot ne trouve pas de mot → joueur gagne
        await prisma.gameSession.update({
          where: { id: existing.id },
          data: { active: false, data: session as unknown as Prisma.JsonObject },
        });
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FFD700')
              .setTitle('🏆 Vous avez gagné !')
              .setDescription(
                `Je ne trouve plus de mot commençant par **${session.currentChar}** !\n\nMots joués : **${session.words.length}**`
              )
              .setTimestamp(),
          ],
        });
        return; // ← après ce return, botWord est narrowed à string
      }

      session.words.push(botWord);
      session.currentChar = getLastChar(botWord);

      await prisma.gameSession.update({
        where: { id: existing.id },
        data: { data: session as unknown as Prisma.JsonObject },
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎮 Shiritori')
            .addFields(
              { name: 'Votre mot', value: word, inline: true },
              { name: 'Mon mot', value: botWord, inline: true },
              { name: 'Prochain mot', value: `Commence par **${session.currentChar}**` }
            )
            .setFooter({ text: `${session.words.length} mots joués` })
            .setTimestamp(),
        ],
      });
    }
  },
};

export default command;
