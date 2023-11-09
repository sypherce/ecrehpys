'use strict';

require('dotenv').config();

const staticAuthProvider = require('@twurple/auth').StaticAuthProvider;
const apiClient = require('@twurple/api').ApiClient;
const easyBot = require('@twurple/easy-bot').Bot;
const commands = require('../core/server.commands.js');
const server = require('../core/server.js');

let api_client;
let streamer;
let bot;

function init(streamer_id, streamer_oauth, bot_id, bot_oauth) {
	//setup streamer authorization and connect to easyBot
	const streamer_auth_provider = new staticAuthProvider(
		streamer_id, streamer_oauth, ['channel:manage:moderators', 'channel:manage:redemptions',
		'channel:read:redemptions', 'user:read:email', 'chat:edit', 'chat:read']
	);
	streamer = new easyBot({
		authProvider: streamer_auth_provider,
		channels: [process.env.STREAMER_USER],
		commands: [],
		chatClientOptions: [{ requestMembershipEvents: true }]
	});

	//setup bot authorization and connect to easyBot
	const bot_auth_provider = new staticAuthProvider(
		bot_id, bot_oauth, ['channel:manage:moderators', 'channel:manage:redemptions',
		'channel:read:redemptions', 'user:read:email', 'chat:edit', 'chat:read']
	);
	bot = new easyBot({
		authProvider: bot_auth_provider,
		channels: [process.env.STREAMER_USER],
		commands: []
	});

	//setup api connection with streamer authorization
	api_client = new apiClient({ authProvider: streamer_auth_provider });

	let lurker_counter = [];
	streamer.onJoin(({ broadcasterName: broadcaster_name, userName: user_name }) => {
		switch(user_name) {
			case broadcaster_name:
			case process.env.BOT_USER:
			case 'nightbot':
				break;
			default:
				if(lurker_counter.indexOf(user_name) === -1) {
					lurker_counter.push(user_name);
					console.log(`Lurker #${lurker_counter.length}, ${user_name} joined!`);
				}
				break;
		}
	});
	streamer.onLeave(({ broadcasterName: broadcaster_name, userName: user_name }) => {
		switch(user_name) {
			case broadcaster_name:
			case process.env.BOT_USER:
			case 'nightbot':
				break;
			default:
				if(lurker_counter.indexOf(user_name) !== -1) {
					lurker_counter.pop(user_name);
					console.log(`Lurker #${lurker_counter.length}, ${user_name} parted!`);
				}
				break;
		}
	});
	streamer.onBan(({ broadcasterName: broadcaster_name, userName: user_name, messageObject: message_object }) => {
		console.log(`streamer.onBan ${user_name} ${message_object}`);
		sayWrapper(`Goodbye ${user_name}!`);
		server.sendMessage('Audio', "muten_dungeon.mp3");
	});

	streamer.onMessage(({ broadcasterName: broadcaster_name, userName: user_name, text, isAction: is_action }) => {
		let flags = { broadcaster: (broadcaster_name === user_name) };
		let extra = { timestamp: Date.now() };
		commands.process(user_name, text, flags, null, extra);
	});
	streamer.onWhisper(({ broadcasterName: broadcaster_name, userName: user_name, text, msg }) => {
		streamer.onMessage(({ broadcaster_name, user_name, text, msg }));
		streamer.Say(`@${user_name}`);
	});
	streamer.onMessageRemove(({ broadcasterName: broadcaster_name, messageID: message_id, msg }) => {
		console.log(`${broadcaster_name}, ${message_id}, ${msg}`);
	});
	streamer.onTimeout(({ broadcasterName: broadcaster_name, userName: user_name, duration, msg }) => {
		console.log(`${broadcaster_name}, ${user_name}, ${duration}, ${msg}`);
	});
	streamer.onRaid(({ broadcasterName: broadcaster_name, userName: user_name, raidInfo, msg }) => {
		console.log(`${broadcaster_name}, ${user_name}, ${raidInfo}, ${msg}`);
	});
	streamer.onSub(({ broadcasterName: broadcaster_name, userName: user_name }) => {
		console.log(`${broadcaster_name}, ${user_name}`);
	});
	streamer.onResub(({ broadcasterName: broadcaster_name, userName: user_name, months }) => {
		console.log(`${broadcaster_name}, ${user_name}, ${months}`);
	});
	streamer.onSubGift(({ broadcasterName: broadcaster_name, gifterName: gifter_name, userName: user_name }) => {
		console.log(`${broadcaster_name}, ${gifter_name}, ${user_name}`);
	});
}
async function getUserByName(user_name) {
	return await api_client.users.getUserByName(user_name);
}
async function getStreamByUserName(user_name) {
	return await api_client.streams.getStreamsByUserNames(user_name);
}
async function getChannelInfoById(user_id) {
	return await api_client.channels.getChannelInfoById(user_id);
}
async function getChannelInfoByUsername(user_name) {
	let user = await getUserByName(user_name);
	console.log(user.id);
	return await getChannelInfoById(user.id);
}

async function checkUserMod(user) {
	const user_id = await getUserByName(user);
	const broadcaster_id = await getUserByName(process.env.STREAMER_USER);
	return await api_client.moderation.checkUserMod(broadcaster_id, user_id);
}
async function addModerator(user) {
	const user_id = await getUserByName(user);
	const broadcaster_id = await getUserByName(process.env.STREAMER_USER);
	try {
		await api_client.moderation.addModerator(broadcaster_id, user_id);
	} catch(error) {
		console.error(error);
	}
	return await checkUserMod(user);
}
async function removeModerator(user) {
	const user_id = await getUserByName(user);
	const broadcaster_id = await getUserByName(process.env.STREAMER_USER);
	try {
		await api_client.moderation.removeModerator(broadcaster_id, user_id);
	} catch(error) {
		console.error(error);
	}
	return await checkUserMod(user);
}

function sayWrapper(message) {
	console.log('D:', message);
	bot.say('sypherce', message);
}
function streamerSayWrapper(message) {
	console.log('D:', message);
	streamer.say(message);
}

module.exports.init = init;
module.exports.getUserByName = getUserByName;
module.exports.getStreamByUserName = getStreamByUserName;
module.exports.getChannelInfoByUsername = getChannelInfoByUsername;
module.exports.addModerator = addModerator;
module.exports.removeModerator = removeModerator;
module.exports.sayWrapper = sayWrapper;
module.exports.streamerSayWrapper = streamerSayWrapper;
