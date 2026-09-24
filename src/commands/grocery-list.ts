import { SlashCommandBuilder } from 'discord.js';

const CREATE_GROCERY_LIST_COMMAND = new SlashCommandBuilder() 
	.setName('grocery-list') 
	.setDescription('Creates a new grocery list.') 
	.toJSON();

export const GROCERY_LIST_COMMANDS = [ CREATE_GROCERY_LIST_COMMAND ]
