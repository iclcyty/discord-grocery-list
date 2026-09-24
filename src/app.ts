import { 
    Client, 
    GatewayIntentBits,
} from 'discord.js';
import { 
    createGroceryList, 
    addItemButtonSubmit, 
    addItemModalSubmit, 
    itemRowButtonSubmit, 
    deleteItemButtonSubmit, 
    deleteSelectedButtonSubmit,
    deleteAllButtonSubmit,
    deleteListButtonSubmit,
    cancelDeleteButtonSubmit,
} from './components/grocery-list.js';
import dotenv from 'dotenv';
 
dotenv.config();
 
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
 
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
        console.log(interaction.customId)
        if (interaction.customId.startsWith('add_item_button')) {
            await addItemButtonSubmit(interaction);
            return;
        }

        if (interaction.customId.startsWith('toggle_item_button')) {
            await itemRowButtonSubmit(interaction, client);
            return;
        }

        if (interaction.customId.startsWith('delete_item_button')) {
            await deleteItemButtonSubmit(interaction, client);
            return;
        }

        if (interaction.customId.startsWith('delete_selected_button')) {
            await deleteSelectedButtonSubmit(interaction, client);
            return;
        }

        if (interaction.customId.startsWith('delete_all_button')) {
            await deleteAllButtonSubmit(interaction, client);
            return;
        }

        if (interaction.customId.startsWith('delete_list_button')) {
            await deleteListButtonSubmit(interaction, client);
            return;
        }

        if (interaction.customId.startsWith('cancel_delete_button')) {
            await cancelDeleteButtonSubmit(interaction, client);
            return;
        }

        return;
    }

    if (interaction.isModalSubmit()) {
        console.log(interaction.customId)
        if (interaction.customId.startsWith('add_item_modal')) {
            await addItemModalSubmit(interaction, client);
            return;
        }

        return;
    }
});

client.login(process.env.DISCORD_TOKEN);
