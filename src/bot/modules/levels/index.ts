import { Message, EmbedBuilder } from 'discord.js';
import { Guild } from '@prisma/client';
import { prisma } from '../../../database';
import { logger } from '../../../utils/logger';

// Cooldown anti-farm XP
const xpCooldowns = new Map<string, number>();
const XP_COOLDOWN_MS = 60_000;
const XP_PER_MESSAGE = { min: 15, max: 25 };

function calculateLevel(xp: number): number {
  return Math.floor(0.1 * Math.sqrt(xp));
}

function xpForNextLevel(level: number): number {
  return Math.pow((level + 1) / 0.1, 2);
}

export async function handleXp(message: Message, guild: Guild): Promise<void> {
  const key = `${guild.id}:${message.author.id}`;
  const now = Date.now();

  if (xpCooldowns.has(key) && now - xpCooldowns.get(key)! < XP_COOLDOWN_MS) return;
  xpCooldowns.set(key, now);

  const xpGain = Math.floor(
    Math.random() * (XP_PER_MESSAGE.max - XP_PER_MESSAGE.min + 1) + XP_PER_MESSAGE.min
  );

  try {
    const current = await prisma.userLevel.upsert({
      where: { guildId_userId: { guildId: guild.id, userId: message.author.id } },
      update: { xp: { increment: xpGain }, messages: { increment: 1 } },
      create: { guildId: guild.id, userId: message.author.id, xp: xpGain, messages: 1 },
    });

    const oldLevel = calculateLevel(current.xp - xpGain);
    const newLevel = calculateLevel(current.xp);

    // Level up !
    if (newLevel > oldLevel) {
      await prisma.userLevel.update({
        where: { guildId_userId: { guildId: guild.id, userId: message.author.id } },
        data: { level: newLevel },
      });

      const channelId = guild.levelChannelId ?? message.channelId;
      const channel = message.guild!.channels.cache.get(channelId);

      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎉 Niveau supérieur !')
          .setDescription(`Félicitations <@${message.author.id}> ! Vous êtes maintenant **niveau ${newLevel}** !`)
          .addFields({
            name: 'XP requis pour le niveau suivant',
            value: `${current.xp} / ${Math.floor(xpForNextLevel(newLevel))} XP`,
          })
          .setThumbnail(message.author.displayAvatarURL())
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => null);
      }

      logger.info('Level up', { guildId: guild.id, userId: message.author.id, level: newLevel });
    }
  } catch (error) {
    logger.error('Erreur handleXp', { error });
  }
}
