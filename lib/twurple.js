'use strict';

require('dotenv').config();

const staticAuthProvider = require('@twurple/auth').StaticAuthProvider;
const apiClientFunction = require('@twurple/api').ApiClient;
const easyBot = require('@twurple/easy-bot').Bot;
const commands = require('../core/server.commands.js');
const server = require('../core/server.js');
const eventsub = require('./twurple.eventsub.js');
const log = require('esm')(module)('../alerts/lib/log.js').log;

let apiClient;
let streamer;
let bot;

function init(streamerId, streamerOauth, botId, botOauth) {
	//setup streamer authorization and connect to easyBot
	const streamerAuthProvider = new staticAuthProvider(streamerId, streamerOauth, [
		'channel:manage:moderators',
		'channel:manage:redemptions',
		'channel:manage:broadcast',
		'channel:read:redemptions',
		'user:read:email',
		'chat:edit',
		'chat:read',
		'moderator:manage:banned_users',
		'moderator:read:followers',
		'bits:read',
		'channel:read:hype_train',
	]);
	streamer = new easyBot({
		authProvider: streamerAuthProvider,
		channels: [process.env.STREAMER_USER],
		commands: [],
		chatClientOptions: [{ requestMembershipEvents: true }],
	});

	//setup bot authorization and connect to easyBot
	const botAuthProvider = new staticAuthProvider(botId, botOauth, [
		'channel:manage:moderators',
		'channel:manage:redemptions',
		'channel:read:redemptions',
		'user:read:email',
		'chat:edit',
		'chat:read',
	]);
	bot = new easyBot({
		authProvider: botAuthProvider,
		channels: [process.env.STREAMER_USER],
		commands: [],
	});

	//setup api connection with streamer authorization
	apiClient = new apiClientFunction({ authProvider: streamerAuthProvider });
	eventsub.init(process.env.STREAMER_USER, process.env.STREAMER_ID, process.env.STREAMER_OAUTH, process.env.LISTENER_SECRET, streamerAuthProvider);

	const lurkerCounter = [];
	streamer.onJoin(({ broadcasterName: broadcaster_name, userName: user_name }) => {
		switch (user_name) {
			case broadcaster_name:
			case process.env.BOT_USER:
			case 'nightbot':
				break;
			default:
				if (lurkerCounter.indexOf(user_name) === -1) {
					lurkerCounter.push(user_name);
					log.debug(`Lurker #${lurkerCounter.length}, ${user_name} joined!`);
				}
				break;
		}
	});
	streamer.onLeave(({ broadcasterName: broadcaster_name, userName: user_name }) => {
		switch (user_name) {
			case broadcaster_name:
			case process.env.BOT_USER:
			case 'nightbot':
				break;
			default:
				if (lurkerCounter.indexOf(user_name) !== -1) {
					lurkerCounter.pop(user_name);
					log.debug(`Lurker #${lurkerCounter.length}, ${user_name} parted!`);
				}
				break;
		}
	});
	streamer.onBan(({ broadcasterName: broadcaster_name, userName: user_name, messageObject: message_object }) => {
		log.debug(`streamer.onBan ${user_name} ${message_object}`);
		sayWrapper(`Goodbye ${user_name}!`);
		server.sendMessage('Audio', 'alerts/muten_dungeon.mp3');
	});

	streamer.onMessage(({ broadcasterName: broadcaster_name, userName: user_name, text, isAction: is_action }) => {
		const flags = { broadcaster: broadcaster_name === user_name };
		const extra = { timestamp: Date.now() };
		commands.process(user_name, text, flags, null, extra);
	});
	streamer.onWhisper(({ broadcasterName: broadcaster_name, userName: user_name, text, msg }) => {
		streamer.onMessage({ broadcaster_name, user_name, text, msg });
		streamer.Say(`@${user_name}`);
	});
	streamer.onMessageRemove(({ broadcasterName: broadcaster_name, messageID: message_id, msg }) => {
		log.debug(`${broadcaster_name}, ${message_id}, ${msg}`);
	});
	streamer.onTimeout(({ broadcasterName: broadcaster_name, userName: user_name, duration, msg }) => {
		log.debug(`${broadcaster_name}, ${user_name}, ${duration}, ${msg}`);
	});
	streamer.onRaid(({ broadcasterName: broadcaster_name, userName: user_name, raidInfo, msg }) => {
		sayWrapper(`${user_name} is raiding us!`);
		//	with ${raidInfo.viewerCount()} viewers!`);
		server.sendMessage('Audio', 'alerts/alert_raid.mp3');
		log.debug(`${broadcaster_name}, ${user_name}, ${raidInfo}, ${msg}`);
	});
	streamer.onSub(({ broadcasterName: broadcaster_name, userName: user_name }) => {
		server.sendMessage('Audio', 'alerts/alert_sub.mp3');
		server.sayWrapper(`${user_name} just subbed!`);
		log.debug(`${broadcaster_name}, ${user_name}`);
	});
	streamer.onResub(({ broadcasterName: broadcaster_name, userName: user_name, months }) => {
		server.sendMessage('Audio', 'alerts/alert_sub.mp3');
		server.sayWrapper(`${user_name} just resubbed!`);
		log.debug(`${broadcaster_name}, ${user_name}, ${months}`);
	});
	streamer.onSubGift(({ broadcasterName: broadcaster_name, gifterName: gifter_name, userName: user_name }) => {
		server.sendMessage('Audio', 'alerts/alert_sub.mp3');
		server.sayWrapper(`${gifter_name} just gifted a sub to ${user_name}!`);
		log.debug(`${broadcaster_name}, ${gifter_name}, ${user_name}`);
	});
}

const getUserByName = (() => {
	const getUserByNameList = [];

	return async (userName) => {
		const cached = getUserByNameList.find((element) => element.name === userName);
		if (cached !== undefined) {
			return cached.id;
		}

		const userId = await apiClient.users.getUserByName(userName);
		getUserByNameList.push({ name: userName, id: userId });

		return userId;
	};
})();
async function getStreamByUserName(userName) {
	return await apiClient.streams.getStreamsByUserNames(userName);
}
async function getChannelInfoById(userId) {
	return await apiClient.channels.getChannelInfoById(userId);
}
async function getChannelInfoByUsername(userName) {
	const user = (await getUserByName(userName)) || (await getUserByName(process.env.STREAMER_USER));
	log.debug(user.id);

	return await getChannelInfoById(user.id);
}

async function checkUserMod(user) {
	const userId = await getUserByName(user);
	return checkUserModByID(userId);
}
async function checkUserModByID(userId) {
	const broadcasterId = await getUserByName(process.env.STREAMER_USER);
	return await apiClient.moderation.checkUserMod(broadcasterId, userId);
}
async function setModerator(user, isAdd = true) {
	const userId = await getUserByName(user);
	const broadcasterId = await getUserByName(process.env.STREAMER_USER);
	try {
		if (isAdd === true) await apiClient.moderation.addModerator(broadcasterId, userId);
		else await apiClient.moderation.removeModerator(broadcasterId, userId);
	} catch (error) {
		console.error(error);
	}
	return await checkUserMod(user);
}
async function banUser(data, isBan = true) {
	log.debug(JSON.stringify(data));
	const broadcasterId = await getUserByName(process.env.STREAMER_USER);
	try {
		if (isBan === true) await apiClient.moderation.banUser(broadcasterId, data);
		else await apiClient.moderation.unbanUser(broadcasterId, data.user);
	} catch (error) {
		console.error(error);
	}
	return await checkUserModByID(data.user);
}
async function timeoutUser(data, isTimeout = true) {
	if ((isTimeout === true) & (parseInt(data.duration) > 0)) return banUser(data, isTimeout);
}

async function getChannelInfo() {
	return getChannelInfoByUsername(await getUserByName(process.env.STREAMER_USER));
}

async function appendTitle(string) {
	try {
		string = string.replace(/\b69\b/g, 'NiCe');
		const title = (await getChannelInfo()).title.replace(new RegExp(` --- .*`), '');

		await apiClient.channels.updateChannelInfo(await getUserByName(process.env.STREAMER_USER), {
			title: `${title} --- ${string}`,
		});
	} catch (error) {
		log.warn(`Update title failed: ${error}`);
	}
}

function actionWrapper(message) {
	log.debug(`/me ${message}`);
	bot.action(process.env.STREAMER_USER, message);
}
function sayWrapper(message) {
	log.debug(message);
	bot.say(process.env.STREAMER_USER, message);
}
function streamerSayWrapper(message) {
	log.debug(message);
	streamer.say(message);
}

//https://twurple.js.org/reference/api/classes/HelixChannelPointsApi.html
async function createCustomReward(
	data = {
		autoFulfill: false, //Whether the redemption should automatically set its status to fulfilled.
		backgroundColor: '#00FF00', //The hex code of the background color of the reward.
		cost: 1, //The channel points cost of the reward.
		globalCooldown: null, //The cooldown between two redemptions of the reward, in seconds. 0 or `null` means no cooldown.
		isEnabled: true, //Whether the reward is enabled (shown to users).
		maxRedemptionsPerStream: null, //The maximum number of redemptions of the reward per stream. 0 or `null` means no limit.
		maxRedemptionsPerUserPerStream: null, //The maximum number of redemptions of the reward per stream for each user. 0 or `null` means no limit.
		prompt: 'this is a prompt', //The prompt shown to users when redeeming the reward.
		title: `this is ___${Date.now()}`, //The title of the reward.
		userInputRequired: false, //Whether the reward requires user input to be redeemed.
	}
) {
	try {
		const broadcasterId = (await getUserByName(process.env.STREAMER_USER)).id;
		const reward = apiClient.channelPoints.createCustomReward(broadcasterId, data);
		log.debug(reward.id);
		return reward;
	} catch (error) {
		log.debug(error);
		return undefined;
	}
}
async function getCustomRewards(onlyManageable = true) {
	const broadcasterId = await getUserByName(process.env.STREAMER_USER);
	return await apiClient.channelPoints.getCustomRewards(broadcasterId, onlyManageable);
}
async function deleteCustomReward(rewardId) {
	const broadcasterId = await getUserByName(process.env.STREAMER_USER);
	return await apiClient.channelPoints.deleteCustomReward(broadcasterId, rewardId);
}
async function updateCustomReward(rewardId, data) {
	const broadcasterId = await getUserByName(process.env.STREAMER_USER);
	return await apiClient.channelPoints.updateCustomReward(broadcasterId, rewardId, data);
}
async function updateOrCreateCustomReward(data) {
	if (typeof data.title !== 'undefined') {
		const list = await getCustomRewards();
		for (const element of list) {
			if (element.title === data.title) {
				return updateCustomReward(element.id, data);
			}
		}
	}
	return createCustomReward(data);
}

module.exports.init = init;
module.exports.eventsub = eventsub;
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
