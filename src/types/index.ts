import {
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  Collection,
  Client,
  ButtonInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

export interface SlashCommand {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  cooldown?: number;
}

export interface BotEvent {
  name: string;
  once?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (...args: any[]) => Promise<void> | void;
}

export interface ButtonHandler {
  customId: string | RegExp;
  execute: (interaction: ButtonInteraction) => Promise<void>;
}

export interface SelectMenuHandler {
  customId: string | RegExp;
  execute: (interaction: StringSelectMenuInteraction) => Promise<void>;
}

export interface ExtendedClient extends Client {
  commands: Collection<string, SlashCommand>;
  buttons: Collection<string, ButtonHandler>;
  selectMenus: Collection<string, SelectMenuHandler>;
  cooldowns: Collection<string, Collection<string, number>>;
}

// Types pour le dashboard
export interface DashboardUser {
  id: string;
  username: string;
  avatar: string | null;
  guilds: DashboardGuild[];
}

export interface DashboardGuild {
  id: string;
  name: string;
  icon: string | null;
  isAdmin: boolean;
  botPresent: boolean;
}

export interface JwtPayload {
  userId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface ShiritoriSession {
  active: boolean;
  words: string[];
  currentChar: string;
  scores: Record<string, number>;
  startedAt: Date;
  lastActivity: Date;
  startedBy: string;
}

export interface JpStorySession {
  active: boolean;
  story: { userId: string; text: string; score: number; corrections: string[] }[];
  startedAt: Date;
  startedBy: string;
}
