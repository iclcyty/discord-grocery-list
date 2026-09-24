import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { GROCERY_LIST_COMMANDS } from './commands/grocery-list.js';
import { UTILTY_COMMANDS } from './commands/utility.js'

dotenv.config();

const commands = [
	...GROCERY_LIST_COMMANDS, 
	...UTILTY_COMMANDS
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

await rest.put(
    Routes.applicationCommands(process.env.APP_ID!),
    {
        body: commands,
    },
);

console.log('Registered global commands.');
