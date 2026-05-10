import { GuildMember, EmbedBuilder, AttachmentBuilder, PartialGuildMember } from 'discord.js';
import { BotEvent } from '../../types';
import { getOrCreateGuild } from '../../database';
import { logger } from '../../utils/logger';
import { generateWelcomeCard } from '../modules/welcome/welcomeCard';

const MEMBRE_ROLE_ID = '1394696937713831997';
const MEMBRE_ROLE_NAME = /^membre$/i;

// Empêche le double envoi si plusieurs events GuildMemberUpdate arrivent en rafale
const welcomeCooldown = new Set<string>();

const event: BotEvent = {
  name: 'guildMemberUpdate',
  async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    try {
      // Détecte si le rôle Membre vient d'être ajouté (vérifie par ID puis par nom)
      const hasMembre = (m: GuildMember | PartialGuildMember) =>
        m.roles.cache.has(MEMBRE_ROLE_ID) ||
        m.roles.cache.some((r) => MEMBRE_ROLE_NAME.test(r.name));

      const gainedMembre = !hasMembre(oldMember) && hasMembre(newMember);

      if (!gainedMembre) return;

      // Cooldown 30s par membre pour éviter le double envoi
      const cooldownKey = `${newMember.guild.id}:${newMember.id}`;
      if (welcomeCooldown.has(cooldownKey)) return;
      welcomeCooldown.add(cooldownKey);
      setTimeout(() => welcomeCooldown.delete(cooldownKey), 30_000);

      const guildData = await getOrCreateGuild(newMember.guild.id, newMember.guild.name);

      if (!guildData.welcomeEnabled || !guildData.welcomeChannelId) return;

      const channel = newMember.guild.channels.cache.get(guildData.welcomeChannelId);
      if (!channel?.isTextBased()) return;

      const memberCount = newMember.guild.memberCount;

      let message = guildData.welcomeMessage ?? `Bienvenue sur **{guild}**, {user} ! 🎉`;
      message = message
        .replace(/{user}/g, `<@${newMember.id}>`)
        .replace(/{username}/g, newMember.user.username)
        .replace(/{guild}/g, newMember.guild.name)
        .replace(/{count}/g, memberCount.toString());

      const embedData = guildData.welcomeEmbed as Record<string, unknown> | null;
      const accentColor: string = (embedData?.color as string) ?? '#f25858';

      // --- Génération du panneau image ---
      let cardAttachment: AttachmentBuilder | null = null;
      try {
        const cardBuffer = await generateWelcomeCard({
          username: newMember.user.username,
          displayName: newMember.displayName,
          avatarUrl: newMember.user.displayAvatarURL({ extension: 'png' }),
          guildName: newMember.guild.name,
          memberCount,
          backgroundUrl: guildData.welcomeImageUrl ?? null,
          accentColor,
        });
        cardAttachment = new AttachmentBuilder(cardBuffer, { name: 'welcome.png' });
      } catch (cardError) {
        logger.warn('Impossible de générer la carte de bienvenue', { error: cardError });
      }

      // --- Envoi ---
      if (embedData) {
        const embed = new EmbedBuilder()
          .setColor((accentColor as `#${string}`) ?? '#f25858')
          .setTitle(
            (embedData.title as string)?.replace(/{username}/g, newMember.user.username) ?? 'Bienvenue !'
          )
          .setDescription(message)
          .setTimestamp();

        if (cardAttachment) {
          embed.setImage('attachment://welcome.png');
        } else {
          embed.setThumbnail(newMember.user.displayAvatarURL());
        }

        if (embedData.footer) {
          embed.setFooter({
            text: (embedData.footer as string).replace(/{count}/g, memberCount.toString()),
          });
        }

        await channel.send({
          embeds: [embed],
          ...(cardAttachment ? { files: [cardAttachment] } : {}),
        });
      } else {
        await channel.send({
          content: message,
          ...(cardAttachment ? { files: [cardAttachment] } : {}),
        });
      }

      // --- DM de bienvenue ---
      if (guildData.welcomeDmEnabled && guildData.welcomeDmMessage) {
        const dm = guildData.welcomeDmMessage
          .replace(/{user}/g, newMember.user.username)
          .replace(/{guild}/g, newMember.guild.name);
        await newMember.user.send(dm).catch(() => null);
      }

      logger.info('Bienvenue (rôle Membre) envoyé', {
        guildId: newMember.guild.id,
        userId: newMember.id,
      });
    } catch (error) {
      logger.error('Erreur événement guildMemberUpdate', { error });
    }
  },
};

export default event;
