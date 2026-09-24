export type GroceryList = { 
    title: string, 
    items: GroceryItem[],
    messageId: string,
    channelId: string,
}

export type GroceryItem = {
    id: string,
    name: string,
    completed: boolean,
};
