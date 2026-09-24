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
    SectionBuilder,
    TextDisplayBuilder,
    ContainerBuilder,
} from 'discord.js';
import { GroceryList, GroceryItem } from '../types/grocery-list.js';
import { randomUUID } from 'node:crypto';

const groceryLists = new Map<string, GroceryList>();
let groceryListCount = 0;

function createAddItemButton(id: string) {
    const addItemActionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`add_item_button:${id}`)
                .setLabel('Add Item(s)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`delete_item_button:${id}`)
                .setLabel('Delete Item(s)')
                .setStyle(ButtonStyle.Secondary),
        );

    return addItemActionRow;
}

function createAddItemModal(id: string) {
    return new ModalBuilder()
        .setCustomId(`add_item_modal:${id}`)
        .setTitle('Add Item')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Item Name')
                .setDescription('Enter an Item')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('item_name')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Enter an item')
                        .setRequired(true),
                )
        );
}

function createItemRow(item: GroceryItem, id: string) {
    const button = new ButtonBuilder()
        .setCustomId(`toggle_item_button:${id}:${item.id}`)
        .setLabel(item.completed ? `☑` : `☐`)
        .setStyle(item.completed ? ButtonStyle.Success: ButtonStyle.Secondary);

    const section = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${item.name}`))
        .setButtonAccessory(button);

    return section;
}

function createGroceryListContainer(groceryList: GroceryList, id: string) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${groceryList.title}**`),
        );

    for (const item of groceryList.items) {
        container.addSectionComponents(createItemRow(item, id));
    }

    container.addActionRowComponents(createAddItemButton(id));

    return container;
}

async function fetchMessageByGroceryList(groceryList: GroceryList, client: Client) {
    const channel = await client.channels.fetch(groceryList.channelId);

    if (!channel?.isTextBased()) {
        throw new Error('Channel is not text-based');
    }

    return channel.messages.fetch(groceryList.messageId);
}

export async function createGroceryList(chatInputCommandInteraction: ChatInputCommandInteraction) {
    const groceryList: GroceryList = {
        title: `Grocery List #${++groceryListCount}`,
        items: [],
        messageId: '',
        channelId: chatInputCommandInteraction.channelId,
    };

    const response = await chatInputCommandInteraction.reply({
        flags: MessageFlags.IsComponentsV2,
        components: [
            createGroceryListContainer(groceryList, chatInputCommandInteraction.id)
        ],
        withResponse: true,
    });

    const messageId = response?.resource?.message?.id;

    if (!messageId) {
        throw new Error('Failed to get grocery list messageId');
    }

    groceryList.messageId = messageId;

    groceryLists.set(chatInputCommandInteraction.id, groceryList);
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

    const items = modalSubmitInteraction.fields.getTextInputValue('item_name')
        .split('\n')
        .map(item => item.trim())
        .filter(Boolean);

    for (const item of items) {
        groceryList.items.push({
            id: `${randomUUID()}`, 
            name: item,
            completed: false,
        });
    }

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        components: [
            createGroceryListContainer(groceryList, id)
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

    console.log(id);
    console.log(itemId);

    const groceryList = groceryLists.get(id);
    const groceryItem = groceryList?.items.find((groceryItem) => groceryItem.id === itemId);

    if (!groceryList || !groceryItem) { 
        await buttonInteraction.reply({ 
            content: 'Item does not exist', 
            flags: MessageFlags.Ephemeral,
        }); 
        return; 
    }

    groceryItem.completed = !groceryItem.completed;

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        components: [
            createGroceryListContainer(groceryList, id)
        ],
    });

    await buttonInteraction.deferUpdate();
}
