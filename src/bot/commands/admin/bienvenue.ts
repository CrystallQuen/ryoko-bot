import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { SlashCommand } from '../../../types';
import { prisma, getOrCreateGuild } from '../../../database';
import { successEmbed, errorEmbed, infoEmbed } from '../../../utils/embed';
import { logger } from '../../../utils/logger';
import { generateWelcomeCard } from '../../modules/welcome/welcomeCard';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const URL_RE = /^https?:\/\/.+/i;

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('bienvenue')
    .setDescription('Configurer le panneau de bienvenue')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('activer')
        .setDescription('Activer le message de bienvenue')
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon où envoyer le message')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('desactiver').setDescription('Désactiver le message de bienvenue')
    )
    .addSubcommand((sub) =>
      sub
        .setName('salon')
        .setDescription('Changer le salon de bienvenue')
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Nouveau salon')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('message')
        .setDescription('Définir le message de bienvenue')
        .addStringOption((o) =>
          o
            .setName('texte')
            .setDescription('Variables : {user} {username} {guild} {count}')
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('background')
        .setDescription('Définir une image de fond pour la carte (URL)')
        .addStringOption((o) =>
          o
            .setName('url')
            .setDescription('URL directe vers une image (jpg/png/gif)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('supprimer-background').setDescription('Supprimer le background personnalisé')
    )
    .addSubcommand((sub) =>
      sub
        .setName('couleur')
        .setDescription('Couleur d\'accent de la carte (#RRGGBB)')
        .addStringOption((o) =>
          o
            .setName('hex')
            .setDescription('Ex: #5865F2')
            .setRequired(true)
            .setMinLength(7)
            .setMaxLength(7)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('apercu').setDescription('Voir la configuration actuelle')
    )
    .addSubcommand((sub) =>
      sub.setName('test').setDescription('Envoyer une carte de test ici')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ flags: 'Ephemeral' });
    } catch {
      return;
    }

    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    try {
      const guildData = await getOrCreateGuild(guild.id, guild.name);

      // ── activer ───────────────────────────────────────────────────────────
      if (sub === 'activer') {
        const channel = interaction.options.getChannel('salon', true);
        await prisma.guild.update({
          where: { id: guild.id },
          data: { welcomeEnabled: true, welcomeChannelId: channel.id },
        });
        await interaction.editReply({
          embeds: [successEmbed('Bienvenue activé', `Les cartes de bienvenue seront envoyées dans <#${channel.id}> dès qu'un membre reçoit le rôle **Membre**.`)],
        });
        logger.info('Welcome activé', { guildId: guild.id, channelId: channel.id });

      // ── desactiver ────────────────────────────────────────────────────────
      } else if (sub === 'desactiver') {
        await prisma.guild.update({
          where: { id: guild.id },
          data: { welcomeEnabled: false },
        });
        await interaction.editReply({
          embeds: [successEmbed('Bienvenue désactivé', 'Plus aucun message de bienvenue ne sera envoyé.')],
        });

      // ── salon ─────────────────────────────────────────────────────────────
      } else if (sub === 'salon') {
        const channel = interaction.options.getChannel('salon', true);
        await prisma.guild.update({
          where: { id: guild.id },
          data: { welcomeChannelId: channel.id },
        });
        await interaction.editReply({
          embeds: [successEmbed('Salon mis à jour', `Salon de bienvenue : <#${channel.id}>`)],
        });

      // ── message ───────────────────────────────────────────────────────────
      } else if (sub === 'message') {
        const text = interaction.options.getString('texte', true);
        await prisma.guild.update({
          where: { id: guild.id },
          data: { welcomeMessage: text },
        });
        const preview = text
          .replace(/{user}/g, `<@${interaction.user.id}>`)
          .replace(/{username}/g, interaction.user.username)
          .replace(/{guild}/g, guild.name)
          .replace(/{count}/g, guild.memberCount.toString());
        await interaction.editReply({
          embeds: [
            successEmbed('Message mis à jour')
              .setDescription(`**Aperçu :**\n${preview}`),
          ],
        });

      // ── background ────────────────────────────────────────────────────────
      } else if (sub === 'background') {
        const url = interaction.options.getString('url', true);
        if (!URL_RE.test(url)) {
          await interaction.editReply({ embeds: [errorEmbed('URL invalide', 'L\'URL doit commencer par http:// ou https://')] });
          return;
        }
        await prisma.guild.update({
          where: { id: guild.id },
          data: { welcomeImageUrl: url },
        });
        await interaction.editReply({
          embeds: [successEmbed('Background mis à jour', 'Il sera utilisé sur toutes les prochaines cartes de bienvenue.')],
        });

      // ── supprimer-background ──────────────────────────────────────────────
      } else if (sub === 'supprimer-background') {
        await prisma.guild.update({
          where: { id: guild.id },
          data: { welcomeImageUrl: null },
        });
        await interaction.editReply({
          embeds: [successEmbed('Background supprimé', 'Le dégradé par défaut sera utilisé.')],
        });

      // ── couleur ───────────────────────────────────────────────────────────
      } else if (sub === 'couleur') {
        const hex = interaction.options.getString('hex', true).toUpperCase();
        if (!HEX_COLOR_RE.test(hex)) {
          await interaction.editReply({ embeds: [errorEmbed('Couleur invalide', 'Format attendu : #RRGGBB (ex: #5865F2)')] });
          return;
        }
        const current = (guildData.welcomeEmbed as Record<string, unknown> | null) ?? {};
        await prisma.guild.update({
          where: { id: guild.id },
          data: { welcomeEmbed: { ...current, color: hex } },
        });
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(hex as `#${string}`).setTitle('✅ Couleur mise à jour').setDescription(`Nouvel accent : **${hex}**`)],
        });

      // ── show ──────────────────────────────────────────────────────────────
      } else if (sub === 'apercu') {
        const embedData = guildData.welcomeEmbed as Record<string, unknown> | null;
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('👋 Configuration Bienvenue')
          .addFields(
            { name: '⚡ Activé', value: guildData.welcomeEnabled ? '✅ Oui' : '❌ Non', inline: true },
            {
              name: '📣 Salon',
              value: guildData.welcomeChannelId ? `<#${guildData.welcomeChannelId}>` : '❌ Non défini',
              inline: true,
            },
            {
              name: '🎨 Couleur',
              value: (embedData?.color as string) ?? '#f25858',
              inline: true,
            },
            {
              name: '💬 Message',
              value: guildData.welcomeMessage ?? '*(défaut)*',
              inline: false,
            },
            {
              name: '🖼️ Arrière-plan',
              value: guildData.welcomeImageUrl ? `[Voir l'image](${guildData.welcomeImageUrl})` : '*(dégradé par défaut)*',
              inline: true,
            },
            {
              name: '📩 Message privé',
              value: guildData.welcomeDmEnabled ? '✅ Activé' : '❌ Désactivé',
              inline: true,
            },
            {
              name: '🔑 Déclencheur',
              value: 'Attribution du rôle **Membre**',
              inline: false,
            }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });

      // ── test ──────────────────────────────────────────────────────────────
      } else if (sub === 'test') {
        const embedData = guildData.welcomeEmbed as Record<string, unknown> | null;
        const accentColor: string = (embedData?.color as string) ?? '#f25858';

        let cardAttachment: AttachmentBuilder | null = null;
        try {
          const buf = await generateWelcomeCard({
            username: interaction.user.username,
            displayName: interaction.member
              ? (interaction.member as { displayName?: string }).displayName ?? interaction.user.username
              : interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png' }),
            guildName: guild.name,
            memberCount: guild.memberCount,
            backgroundUrl: guildData.welcomeImageUrl ?? null,
            accentColor,
          });
          cardAttachment = new AttachmentBuilder(buf, { name: 'welcome.png' });
        } catch (err) {
          logger.warn('Erreur génération carte test', { error: err });
        }

        const embed = new EmbedBuilder()
          .setColor(accentColor as `#${string}`)
          .setTitle('👋 Aperçu de la carte de bienvenue')
          .setDescription(`Voici ce que verront les nouveaux membres lorsqu'ils recevront le rôle **Membre**.`)
          .setTimestamp();

        if (cardAttachment) embed.setImage('attachment://welcome.png');

        await interaction.editReply({
          embeds: [embed],
          ...(cardAttachment ? { files: [cardAttachment] } : {}),
        });
      }
    } catch (error) {
      logger.error('Erreur /bienvenue', { error, sub });
      await interaction.editReply({
        embeds: [errorEmbed('Erreur', 'Une erreur est survenue. Vérifie que la base de données est connectée.')],
      });
    }
  },
};

export default command;
