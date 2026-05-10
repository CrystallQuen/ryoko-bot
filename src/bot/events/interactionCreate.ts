import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  Collection,
} from 'discord.js';
import { BotEvent, ExtendedClient } from '../../types';
import { errorEmbed } from '../../utils/embed';
import { logger } from '../../utils/logger';

const event: BotEvent = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    const client = interaction.client as ExtendedClient;

    // Slash commands
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;

      // Cooldown
      if (!client.cooldowns.has(cmd.data.name)) {
        client.cooldowns.set(cmd.data.name, new Collection());
      }
      const timestamps = client.cooldowns.get(cmd.data.name)!;
      const cooldown = (cmd.cooldown ?? 3) * 1000;
      const now = Date.now();
      const userId = interaction.user.id;

      if (timestamps.has(userId)) {
        const expiresAt = timestamps.get(userId)! + cooldown;
        if (now < expiresAt) {
          const remaining = ((expiresAt - now) / 1000).toFixed(1);
          const reply = { embeds: [errorEmbed('Cooldown', `Attendez encore **${remaining}s** avant de réutiliser cette commande.`)], ephemeral: true };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
          return;
        }
      }

      timestamps.set(userId, now);
      setTimeout(() => timestamps.delete(userId), cooldown);

      try {
        await cmd.execute(interaction as ChatInputCommandInteraction);
      } catch (error) {
        logger.error(`Erreur dans la commande /${interaction.commandName}`, { error, userId, guildId: interaction.guildId });
        const errorReply = { embeds: [errorEmbed('Erreur', 'Une erreur inattendue s\'est produite.')], ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply);
        } else {
          await interaction.reply(errorReply);
        }
      }
    }

    // Boutons
    if (interaction.isButton()) {
      const handler = client.buttons.find((h) => {
        if (typeof h.customId === 'string') return h.customId === interaction.customId;
        return h.customId.test(interaction.customId);
      });

      if (!handler) return;

      try {
        await handler.execute(interaction as ButtonInteraction);
      } catch (error) {
        logger.error(`Erreur dans le bouton ${interaction.customId}`, { error });
      }
    }

    // Menus déroulants
    if (interaction.isStringSelectMenu()) {
      const handler = client.selectMenus.find((h) => {
        if (typeof h.customId === 'string') return h.customId === interaction.customId;
        return h.customId.test(interaction.customId);
      });

      if (!handler) return;

      try {
        await handler.execute(interaction as StringSelectMenuInteraction);
      } catch (error) {
        logger.error(`Erreur dans le menu ${interaction.customId}`, { error });
      }
    }
  },
};

export default event;
