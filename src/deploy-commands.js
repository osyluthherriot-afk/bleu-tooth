/**
 * deploy-commands.js
 * Registers slash commands with Discord's API.
 * Run once:  node src/deploy-commands.js
 *
 * Set GUILD_ID in .env to deploy to a specific server (instant refresh).
 * Leave it empty to deploy globally (can take up to 1 hour to propagate).
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';

import { data as doubleData    } from './commands/roll-double.js';
import { data as halfData      } from './commands/roll-half.js';
import { data as rollOpData    } from './commands/roll-multiply.js';
import { data as rankUpData    } from './commands/rank-up.js';
import { gwfData, savageData, brawlerData } from './commands/dnd-features.js';
import { data as sodData       } from './commands/sword-or-death.js';

const commands = [
  doubleData,
  halfData,
  rollOpData,
  rankUpData,
  gwfData,
  savageData,
  brawlerData,
  sodData,
].map((c) => c.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

const clientId = process.env.CLIENT_ID;
const guildId  = process.env.GUILD_ID;

if (!clientId) {
  console.error('❌ CLIENT_ID is not set in .env — please add your bot application ID.');
  process.exit(1);
}

try {
  console.log(`🔵 Registering ${commands.length} slash command(s)…`);

  if (guildId) {
    // Guild-scoped (instant)
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`✅ Commands registered to guild ${guildId}`);
  } else {
    // Global (up to 1 hour)
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('✅ Commands registered globally (may take up to 1 hour to appear)');
  }
} catch (err) {
  console.error('❌ Failed to register commands:', err);
}
