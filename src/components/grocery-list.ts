import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    LabelBuilder,
    ButtonInteraction,
    ModalSubmitInteraction,
    ChatInputCommandInteraction,
    Client,
    MessageFlags,
} from 'discord.js';
import { GroceryList, GroceryItem } from '../types/grocery-list.js';
import { randomUUID } from 'node:crypto';

const groceryLists = new Map<string, GroceryList>();
let groceryListCount = 0;

function createAddItemButton(id: string) {
    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`add_item_button:${id}`)
                .setLabel('Add item')
                .setStyle(ButtonStyle.Primary),
        );
}

function createAddItemModal(id: string) {
    return new ModalBuilder()
        .setCustomId(`add_item_modal:${id}`)
        .setTitle('Add Item')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Item name')
                .setDescription('Enter the item you want to add')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('item_name')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Enter an item')
                        .setRequired(true),
                ),
        );
}

function createItemRow(item: GroceryItem) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`toggle_item_button:${item.id}`)
            .setLabel(item.completed ? `☑ ${item.name}` : `☐ ${item.name}`)
            .setStyle(item.completed ? ButtonStyle.Success : ButtonStyle.Secondary)
    )
}

async function fetchMessageByGroceryList(groceryList: GroceryList, client: Client) {
    const channel = await client.channels.fetch(groceryList.channelId);

    if (!channel?.isTextBased()) {
        throw new Error('Channel is not text-based');
    }

    return channel.messages.fetch(groceryList.messageId);
}

export async function createGroceryList(chatInputCommandInteraction: ChatInputCommandInteraction) {
    const response = await chatInputCommandInteraction.reply({
        content: `Grocery List #**${++groceryListCount}**`,
        components: [
            createAddItemButton(chatInputCommandInteraction.id)
        ],
        withResponse: true,
    });

    const messageId = response?.resource?.message?.id;
    const channelId = chatInputCommandInteraction.channelId;

    if (!messageId) {
        throw new Error('Failed to get grocery list messageId');
    }

    const list: GroceryList = {
        title: `Grocery List #${groceryListCount}`,
        items: [],
        messageId,
        channelId,
    };

    groceryLists.set(chatInputCommandInteraction.id, list);
}

export async function addItemButtonSubmit(buttonInteraction: ButtonInteraction) {
    const id = buttonInteraction.customId.split(':')[1];
    
    if (!id || !groceryLists.has(id)) {
        await buttonInteraction.reply({
            content: 'This grocery list no longer exists.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    await buttonInteraction.showModal(createAddItemModal(id));
}

export async function addItemModalSubmit(modalSubmitInteraction: ModalSubmitInteraction, client: Client) {
    const id = modalSubmitInteraction.customId.split(':')[1];

    const groceryList = groceryLists.get(id);

    if (!id || !groceryList) {
        await modalSubmitInteraction.reply({
            content: 'This grocery list no longer exists.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    const itemName = modalSubmitInteraction.fields.getTextInputValue('item_name');

    groceryList.items.push({
        id: `${id}:${randomUUID()}`, 
        name: itemName,
        completed: false,
    });

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        content: `**${groceryList.title}**`,
        components: [
            ...groceryList.items.map((item) => createItemRow(item)),
            createAddItemButton(id),
        ],
    });

    await modalSubmitInteraction.reply({
        content: 'Item added.',
        flags: MessageFlags.Ephemeral,
    });
}

export async function itemRowButtonSubmit(buttonInteraction: ButtonInteraction, client: Client) {
    const split = buttonInteraction.customId.split(':');
    const id = split[1];
    const itemId = split[2]

    const groceryList = groceryLists.get(id);
    const groceryItem = groceryList?.items.find((groceryItem) => groceryItem.id === itemId);

    if (!groceryList || !groceryItem) { 
        await buttonInteraction.reply({ 
            content: 'This grocery item no longer exists.', 
            flags: MessageFlags.Ephemeral,
        }); 
        return; 
    }

    groceryItem.completed = !groceryItem.completed;

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        content: `**${groceryList.title}**`,
        components: [
            ...groceryList.items.map((item) => createItemRow(item)),
            createAddItemButton(id),
        ],
    });

    await buttonInteraction.deferUpdate();
}
