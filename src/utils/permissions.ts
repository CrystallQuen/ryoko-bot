import { GuildMember, PermissionFlagsBits, PermissionsBitField } from 'discord.js';

export function isModerator(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    member.permissions.has(PermissionFlagsBits.BanMembers) ||
    member.permissions.has(PermissionFlagsBits.KickMembers) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

export function isAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

export function canModerate(moderator: GuildMember, target: GuildMember): boolean {
  if (!moderator.guild.members.me) return false;
  if (target.id === moderator.guild.ownerId) return false;
  if (target.id === moderator.id) return false;

  const modPos = moderator.roles.highest.position;
  const targetPos = target.roles.highest.position;
  return modPos > targetPos;
}

export function botCanModerate(target: GuildMember): boolean {
  const bot = target.guild.members.me;
  if (!bot) return false;
  if (target.id === target.guild.ownerId) return false;
  return bot.roles.highest.position > target.roles.highest.position;
}

export const MOD_PERMISSIONS = new PermissionsBitField([
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
]);
