import { 
    Client, 
    GatewayIntentBits,
} from 'discord.js';
import { createGroceryList, addItemButtonSubmit, addItemModalSubmit, itemRowButtonSubmit } from './components/grocery-list.js';
import dotenv from 'dotenv';
 
dotenv.config();
 
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const BUTTON_INTERACTION_PREFIXES = ['add_item_button', 'toggle_item_button']
 
client.once('clientReady', () => {
    console.log(`Ready! Logged in as ${client.user?.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        console.log(interaction.id)
        if (interaction.commandName === 'grocery-list') {
            await createGroceryList(interaction);
        }

        return;
    }

    if (interaction.isButton()) {
        if (!BUTTON_INTERACTION_PREFIXES.some((prefix) => interaction.customId.startsWith(prefix))) {
            return;
        }

        console.log(interaction.customId)
        if (interaction.customId.startsWith('add_item_button')) {
            await addItemButtonSubmit(interaction);
            return;
        }

        if (interaction.customId.startsWith('toggle_item_button')) {
            await itemRowButtonSubmit(interaction, client)
            return;
        }

        return;
    }

    if (interaction.isModalSubmit()) {
        // create list of valid modal submit interactions
        console.log(interaction.customId)
        if (interaction.customId.startsWith('add_item_modal')) {
            await addItemModalSubmit(interaction, client);
            return;
        }

        return;
    }
});

client.login(process.env.DISCORD_TOKEN);
