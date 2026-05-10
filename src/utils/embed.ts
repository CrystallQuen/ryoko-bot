import { EmbedBuilder, ColorResolvable } from 'discord.js';

export const COLORS = {
  primary: '#5865F2' as ColorResolvable,
  success: '#57F287' as ColorResolvable,
  error: '#ED4245' as ColorResolvable,
  warning: '#FEE75C' as ColorResolvable,
  info: '#5865F2' as ColorResolvable,
  moderation: '#EB459E' as ColorResolvable,
  neutral: '#99AAB5' as ColorResolvable,
};

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS.success).setTitle(`✅ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS.error).setTitle(`❌ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function warningEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS.warning).setTitle(`⚠️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(COLORS.info).setTitle(`ℹ️ ${title}`).setTimestamp();
  if (description) embed.setDescription(description);
  return embed;
}

export function moderationEmbed(action: string, fields: { name: string; value: string; inline?: boolean }[]): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.moderation)
    .setTitle(`🛡️ ${action}`)
    .addFields(fields)
    .setTimestamp();
}

export function gameEmbed(title: string, description: string, color: ColorResolvable = COLORS.primary): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}
