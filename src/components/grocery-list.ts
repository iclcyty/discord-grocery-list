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
import {
    DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
    DeleteCommand,
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { GroceryList, GroceryItem } from '../types/grocery-list.js';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();
 
const dynamoDBClient = new DynamoDBClient({
    region: "ap-southeast-2",
    ...(process.env.DYNAMODB_ENDPOINT && {
        endpoint: process.env.DYNAMODB_ENDPOINT,
        credentials: {
            accessKeyId: "test",
            secretAccessKey: "test",
        }
    }),
});

const dynamoDB = DynamoDBDocumentClient.from(dynamoDBClient);

const tableName = "grocery-lists";

async function saveGroceryList(groceryList: GroceryList) {
    await dynamoDB.send(
        new PutCommand({
            TableName: tableName,
            Item: {
                id: groceryList.id,
                title: groceryList.title,
                items: groceryList.items,
                messageId: groceryList.messageId,
                channelId: groceryList.channelId,
            },
        }),
    );
}

async function getGroceryList(id: string) {
    const result = await dynamoDB.send(
        new GetCommand({
            TableName: tableName,
            Key: {
                id,
            },
        }),
    );

    return result.Item as GroceryList | undefined;
}

async function deleteGroceryList(id: string) {
    await dynamoDB.send(
        new DeleteCommand({
            TableName: tableName,
            Key: {
                id,
            },
        }),
    );
}

async function incrementGroceryListCount() {
    const result = await dynamoDB.send(
        new UpdateCommand({
            TableName: tableName,
            Key: {
                id: '__counter__',
            },
            UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one',
            ExpressionAttributeNames: {
                '#count': 'count',
            },
            ExpressionAttributeValues: {
                ':zero': 0,
                ':one': 1,
            },
            ReturnValues: 'UPDATED_NEW',
        }),
    );

    return Number(result.Attributes?.count);
}

function createItemButtons(id: string) {
    const itemButtonsActionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`add_item_button:${id}`)
                .setLabel('Add Item(s)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`delete_item_button:${id}`)
                .setLabel('Delete Item(s)')
                .setStyle(ButtonStyle.Danger),
        );

    return itemButtonsActionRow;
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

    container.addActionRowComponents(createItemButtons(id));

    return container;
}

function createDeleteContainer(id: string) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Delete Menu**`))
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete_selected_button:${id}`)
                    .setLabel('Delete Selected')
                    .setStyle(ButtonStyle.Danger)
            )
        )
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete_all_button:${id}`)
                    .setLabel('Delete All')
                    .setStyle(ButtonStyle.Danger)
            )
        )
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete_list_button:${id}`)
                    .setLabel('Delete List')
                    .setStyle(ButtonStyle.Danger),
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`cancel_delete_button:${id}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary),
            )
        );

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
    const counter = await incrementGroceryListCount();

    const groceryList: GroceryList = {
        id: chatInputCommandInteraction.id,
        title: `Grocery List #${counter}`,
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

    await saveGroceryList(groceryList);
}

export async function addItemButtonSubmit(buttonInteraction: ButtonInteraction) {
    const id = buttonInteraction.customId.split(':')[1];
    
    const groceryList = await getGroceryList(id);

    if (!id || !groceryList) {
        await buttonInteraction.reply({
            content: 'This grocery list no longer exists.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    await buttonInteraction.showModal(createAddItemModal(id));
}

export async function deleteItemButtonSubmit(buttonInteraction: ButtonInteraction, client: Client) {
    const id = buttonInteraction.customId.split(':')[1];

    const groceryList = await getGroceryList(id);

    if (!id || !groceryList) {
        await buttonInteraction.reply({
            content: 'This grocery list no longer exists.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    await buttonInteraction.deferUpdate();

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        components: [
            createDeleteContainer(id)
        ],
    });
}

export async function addItemModalSubmit(modalSubmitInteraction: ModalSubmitInteraction, client: Client) {
    const id = modalSubmitInteraction.customId.split(':')[1];

    const groceryList = await getGroceryList(id);

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

    await modalSubmitInteraction.deferUpdate();

    await saveGroceryList(groceryList);

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        components: [
            createGroceryListContainer(groceryList, id)
        ],
    });
}

export async function itemRowButtonSubmit(buttonInteraction: ButtonInteraction, client: Client) {
    const split = buttonInteraction.customId.split(':');
    const id = split[1];
    const itemId = split[2]

    console.log(id);
    console.log(itemId);

    const groceryList = await getGroceryList(id);
    const groceryItem = groceryList?.items.find((groceryItem) => groceryItem.id === itemId);

    if (!groceryList || !groceryItem) { 
        await buttonInteraction.reply({ 
            content: 'Item does not exist', 
            flags: MessageFlags.Ephemeral,
        }); 
        return; 
    }

    groceryItem.completed = !groceryItem.completed;

    await buttonInteraction.deferUpdate();

    await saveGroceryList(groceryList);

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        components: [
            createGroceryListContainer(groceryList, id)
        ],
    });
}

export async function deleteSelectedButtonSubmit(buttonInteraction: ButtonInteraction, client: Client) {
    const id = buttonInteraction.customId.split(':')[1];

    const groceryList = await getGroceryList(id);

    if (!id || !groceryList) {
        await buttonInteraction.reply({
            content: 'This grocery list no longer exists.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    groceryList.items = groceryList.items.filter((item) => !item.completed);

    await buttonInteraction.deferUpdate();

    await saveGroceryList(groceryList);

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        components: [
            createGroceryListContainer(groceryList, id)
        ],
    });
}

export async function deleteAllButtonSubmit(buttonInteraction: ButtonInteraction, client: Client) {
    const id = buttonInteraction.customId.split(':')[1];

    const groceryList = await getGroceryList(id);

    if (!id || !groceryList) {
        await buttonInteraction.reply({
            content: 'This grocery list no longer exists.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }
    
    groceryList.items.length = 0;

    await buttonInteraction.deferUpdate();

    await saveGroceryList(groceryList);

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        components: [
            createGroceryListContainer(groceryList, id)
        ],
    });
}

export async function deleteListButtonSubmit(buttonInteraction: ButtonInteraction, client: Client) {
    const id = buttonInteraction.customId.split(':')[1];

    const groceryList = await getGroceryList(id);

    if (!id || !groceryList) {
        await buttonInteraction.reply({
            content: 'This grocery list no longer exists.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    await buttonInteraction.deferUpdate();

    const message = await fetchMessageByGroceryList(groceryList, client);
    await message.delete();

    await deleteGroceryList(id);
}

export async function cancelDeleteButtonSubmit(buttonInteraction: ButtonInteraction, client: Client) {
    const id = buttonInteraction.customId.split(':')[1];

    const groceryList = await getGroceryList(id);

    if (!id || !groceryList) {
        await buttonInteraction.reply({
            content: 'This grocery list no longer exists.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    await buttonInteraction.deferUpdate();

    const message = await fetchMessageByGroceryList(groceryList, client);

    await message.edit({
        components: [
            createGroceryListContainer(groceryList, id)
        ],
    });
}
