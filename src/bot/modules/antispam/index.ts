import { Message } from 'discord.js';
import { AntiSpamConfig } from '@prisma/client';
import { logger } from '../../../utils/logger';

// Map<guildId, Map<userId, timestamps[]>>
const spamTracker = new Map<string, Map<string, number[]>>();

export async function checkAntiSpam(message: Message, config: AntiSpamConfig): Promise<void> {
  const { guildId } = config;
  const userId = message.author.id;
  const now = Date.now();
  const windowMs = config.timeWindow * 1000;

  if (!spamTracker.has(guildId)) spamTracker.set(guildId, new Map());
  const guildMap = spamTracker.get(guildId)!;

  if (!guildMap.has(userId)) guildMap.set(userId, []);
  const timestamps = guildMap.get(userId)!;

  // Purge des timestamps expirés
  const recent = timestamps.filter((t) => now - t < windowMs);
  recent.push(now);
  guildMap.set(userId, recent);

  if (recent.length >= config.maxMessages) {
    guildMap.set(userId, []); // Reset

    const member = await message.guild!.members.fetch(userId).catch(() => null);
    if (!member) return;

    // Ignorer les admins et modérateurs
    if (member.permissions.has('Administrator') || member.permissions.has('ModerateMembers')) return;

    const reason = `Anti-spam: ${recent.length} messages en ${config.timeWindow}s`;

    try {
      if (config.action === 'mute' || config.action === 'timeout') {
        await member.timeout(config.muteDuration * 1000, reason);
        await message.channel.send(`⚠️ <@${userId}> a été mis en sourdine pour spam.`).catch(() => null);
      } else if (config.action === 'kick') {
        await member.kick(reason);
      } else if (config.action === 'ban') {
        await message.guild!.bans.create(userId, { reason });
      } else {
        await message.channel.send(`⚠️ <@${userId}>, évitez le spam !`).catch(() => null);
      }

      logger.warn('Anti-spam déclenché', { guildId, userId, action: config.action });
    } catch (error) {
      logger.error('Erreur anti-spam action', { error });
    }
  }
}
