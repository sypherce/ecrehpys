'use strict';

require('dotenv').config();

const staticAuthProvider = require('@twurple/auth').StaticAuthProvider;
const apiClient = require('@twurple/api').ApiClient;
const easyBot = require('@twurple/easy-bot').Bot;
const commands = require('../core/server.commands.js');
const server = require('../core/server.js');
const token = require('./twurple.token.js');

let api_client;
let streamer;
let bot;

function init(streamer_id, streamer_oauth, bot_id, bot_oauth) {
	//setup streamer authorization and connect to easyBot
	const streamer_auth_provider = new staticAuthProvider(
		streamer_id, streamer_oauth, ['channel:manage:moderators', 'channel:manage:redemptions', 'channel:manage:broadcast',
		'channel:read:redemptions', 'user:read:email', 'chat:edit', 'chat:read', 'moderator:manage:banned_users']
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
	token.init(process.env.STREAMER_USER, process.env.STREAMER_ID, process.env.STREAMER_OAUTH, process.env.LISTENER_SECRET);

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
		server.sendMessage('Audio', 'alerts/muten_dungeon.mp3');
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
		sayWrapper(`${user_name} is raiding us with ${raidInfo.viewerCount} viewers!`);
		server.sendMessage('Audio', 'alerts/alert_raid.mp3');
	});
	streamer.onSub(({ broadcasterName: broadcaster_name, userName: user_name }) => {
		server.sendMessage('Audio', 'alerts/alert_sub.mp3');
		server.sayWrapper(`${user_name} just subbed!`);
		console.log(`${broadcaster_name}, ${user_name}`);
	});
	streamer.onResub(({ broadcasterName: broadcaster_name, userName: user_name, months }) => {
		server.sendMessage('Audio', 'alerts/alert_sub.mp3');
		server.sayWrapper(`${user_name} just resubbed!`);
		console.log(`${broadcaster_name}, ${user_name}, ${months}`);
	});
	streamer.onSubGift(({ broadcasterName: broadcaster_name, gifterName: gifter_name, userName: user_name }) => {
		server.sendMessage('Audio', 'alerts/alert_sub.mp3');
		gifter_name = gifter_name !== 'unoridnarywarlord' ?
			gifter_name : 'Anonymous';
		server.sayWrapper(`${gifter_name} just gifted a sub to ${user_name}!`)
		console.log(`${broadcaster_name}, ${gifter_name}, ${user_name}`);
	});
}

let getUserByNameList = [];
async function getUserByName(user_name) {
	const cached = getUserByNameList.find((element) => element.name === user_name);
	if(cached !== undefined) {
		return cached.id;
	}

	const user_id = await api_client.users.getUserByName(user_name);
	getUserByNameList.push({name:user_name, id:user_id})

	return user_id;
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
	return checkUserModByID(user_id);
}
async function checkUserModByID(user_id) {
	const broadcaster_id = await getUserByName(process.env.STREAMER_USER);
	return await api_client.moderation.checkUserMod(broadcaster_id, user_id);
}
async function setModerator(user, is_add = true) {
	const user_id = await getUserByName(user);
	const broadcaster_id = await getUserByName(process.env.STREAMER_USER);
	try {
		if(is_add === true)
			await api_client.moderation.addModerator(broadcaster_id, user_id);
		else
			await api_client.moderation.removeModerator(broadcaster_id, user_id);
	} catch(error) {
		console.error(error);
	}
	return await checkUserMod(user);
}
async function banUser(data, is_ban = true) {
	console.log(JSON.stringify(data));
	const broadcaster_id = await getUserByName(process.env.STREAMER_USER);
	try {
		if(is_ban === true)
			await api_client.moderation.banUser(broadcaster_id, data);
		else
			await api_client.moderation.unbanUser(broadcaster_id, data.user);
	} catch(error) {
		console.error(error);
	}
	return await checkUserModByID(data.user);
}
async function timeoutUser(data, is_timeout = true) {
	if(is_timeout === true & parseInt(data.duration) > 0)
	return banUser(data, is_timeout);
}

function getChannelInfo() {
	return getChannelInfoByUsername(getUserByName(process.env.STREAMER_USER))
}

async function appendTitle(string) {
	try {
		string = string.replace(/\b69\b/g, 'NiCe');
		let title = (await getChannelInfo()).title.replace(new RegExp(` --- .*`), '');

		await api_client.channels.updateChannelInfo(await getUserByName(process.env.STREAMER_USER), {
			title: `${title} --- ${string}`
		});
	} catch (error) {
		console.log(`Update title failed: ${error}`);
	}
}

function actionWrapper(message) {
	console.log('D:', `/me ${message}`);
	bot.action(process.env.STREAMER_USER, message);
}
function sayWrapper(message) {
	console.log('D:', message);
	bot.say(process.env.STREAMER_USER, message);
}
function streamerSayWrapper(message) {
	console.log('D:', message);
	streamer.say(message);
}

//https://twurple.js.org/reference/api/classes/HelixChannelPointsApi.html
async function createCustomReward(data = {
	autoFulfill: false,						//Whether the redemption should automatically set its status to fulfilled.
	backgroundColor: '#00FF00',				//The hex code of the background color of the reward.
	cost: 1,								//The channel points cost of the reward.
	globalCooldown: null,					//The cooldown between two redemptions of the reward, in seconds. 0 or `null` means no cooldown.
	isEnabled: true,						//Whether the reward is enabled (shown to users).
	maxRedemptionsPerStream: null,			//The maximum number of redemptions of the reward per stream. 0 or `null` means no limit.
	maxRedemptionsPerUserPerStream: null,	//The maximum number of redemptions of the reward per stream for each user. 0 or `null` means no limit.
	prompt: 'this is a prompt',				//The prompt shown to users when redeeming the reward.
	title: `this is ___${Date.now()}`,		//The title of the reward.
	userInputRequired: false				//Whether the reward requires user input to be redeemed.
}) {
	let reward = undefined;
	try {
		const broadcaster_id = (await getUserByName(process.env.STREAMER_USER)).id;
		reward = api_client.channelPoints.createCustomReward(broadcaster_id, data);
		console.log(reward.id);
	} catch (error) {
		console.log(error);
	}
	return reward;
}
async function getCustomRewards(onlyManageable = true) {
	const broadcaster_id = await getUserByName(process.env.STREAMER_USER);
	const rewards = await api_client.channelPoints.getCustomRewards(broadcaster_id, onlyManageable);
	return rewards;
}
async function deleteCustomReward(rewardId) {
	const broadcaster_id = await getUserByName(process.env.STREAMER_USER);
	return await api_client.channelPoints.deleteCustomReward(broadcaster_id, rewardId)
}
async function updateCustomReward(rewardId, data) {
	const broadcaster_id = await getUserByName(process.env.STREAMER_USER);
	return await api_client.channelPoints.updateCustomReward(broadcaster_id, rewardId, data)
}
async function updateOrCreateCustomReward(data) {
	let reward;
	if(typeof data.title !== 'undefined')
	{
		const list = await getCustomRewards();
		for(let element of list) {
			if(element.title === data.title){
				return updateCustomReward(element.id, data);
			}
		}
	}
	return createCustomReward(data);
}

module.exports.init = init;
module.exports.token = token;
module.exports.checkUserMod = checkUserMod;
module.exports.checkUserModByID = checkUserModByID;
module.exports.getUserByName = getUserByName;
module.exports.getStreamByUserName = getStreamByUserName;
module.exports.getChannelInfoByUsername = getChannelInfoByUsername;
module.exports.setModerator = setModerator;
module.exports.actionWrapper = actionWrapper;
module.exports.sayWrapper = sayWrapper;
module.exports.banUser = banUser;
module.exports.timeoutUser = timeoutUser;
module.exports.streamerSayWrapper = streamerSayWrapper;
module.exports.createCustomReward = createCustomReward;
module.exports.getCustomRewards = getCustomRewards;
module.exports.deleteCustomReward = deleteCustomReward;
module.exports.updateCustomReward = updateCustomReward;
module.exports.updateOrCreateCustomReward = updateOrCreateCustomReward;
module.exports.appendTitle = appendTitle;
