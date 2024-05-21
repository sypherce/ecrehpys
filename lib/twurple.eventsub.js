'use strict';

require('dotenv').config();
const fs = require('fs');
const twurple = require('./twurple.js');

const prettyStringify = require('@aitodotai/json-stringify-pretty-compact');

const apiClient = require('@twurple/api').ApiClient;
const EventSubWsListener = require('@twurple/eventsub-ws').EventSubWsListener;
const server = require('../core/server.js');
const thize = require('thize');
const tts = require('../lib/tts.js');
const log = require('esm')(module)('../alerts/lib/log.js').log;

let first;
let firstReward;
async function resetFirst() {
	first = 1;
	fs.writeFileSync('config/first.json', prettyStringify([{ first }], { indent: '\t', maxLength: 1000, maxNesting: 2 }));
	twurple.updateCustomReward(firstReward.id, {
		cost: first, //The channel points cost of the reward.
		prompt: `You've done it, you're ${thize(first)}!`, //The prompt shown to users when redeeming the reward.
		title: `${thize(first)}!`, //The title of the reward.
	});
}
async function init(
	streamerUser = process.env.STREAMER_USER,
	streamerId = process.env.STREAMER_ID,
	streamerOauth = process.env.STREAMER_OAUTH,
	listenerSecret = process.env.LISTENER_SECRET,
	streamerAuthProvider
) {
	//setup api connection with streamer authorization
	const apiClientToken = new apiClient({ authProvider: streamerAuthProvider });

	const rewards = await twurple.getCustomRewards();
	rewards.forEach((element) => {
		if (
			element.title !== 'Curse the Run' &&
			element.title !== 'Bless the Run' &&
			/^[0-9]+.*!$/i.test(element.title) === false &&
			element.title !== `TTS Title`
		)
			twurple.deleteCustomReward(element.id);
	});

	const listener = new EventSubWsListener({
		apiClient: apiClientToken,
	});
	await apiClientToken.eventSub.deleteAllSubscriptions();
	listener.start();
	const broadcasterId = await twurple.getUserByName(streamerUser);
	listener.onChannelRedemptionAdd(broadcasterId, (event) => {
		log.debug(event.rewardTitle);
		if (
			event.rewardTitle !== 'Bless the Run' &&
			event.rewardTitle !== 'Curse the Run' &&
			event.rewardTitle !== `${thize(1)}!` &&
			event.rewardTitle !== `TTS Title`
		)
			server.sendMessage('Audio', 'alerts/mario_chain_chomp.mp3');
	});
	listener.onSubscriptionCreateSuccess((event) => {
		//log.debug('onSubscriptionCreateSuccess', event.id);
	});
	listener.onSubscriptionCreateFailure((event) => {
		log.warning('onSubscriptionCreateFailure', event.id);
	});

	first = (() => {
		const filePath = 'config/first.json';
		if (fs.existsSync(filePath)) {
			const firstValue = JSON.parse(fs.readFileSync(filePath))[0].first;
			return firstValue < 1 ? 1 : firstValue;
		}
		throw new Error('config/first.json not found');
	})();

	firstReward = await (async () => {
		const data = {
			autoFulfill: true, //Whether the redemption should automatically set its status to fulfilled.
			backgroundColor: '#FFFF00', //The hex code of the background color of the reward.
			cost: first, //The channel points cost of the reward.
			globalCooldown: 5, //The cooldown between two redemptions of the reward, in seconds. 0 or `null` means no cooldown.
			isEnabled: true, //Whether the reward is enabled (shown to users).
			maxRedemptionsPerStream: 9999, //The maximum number of redemptions of the reward per stream. 0 or `null` means no limit.
			maxRedemptionsPerUserPerStream: null, //The maximum number of redemptions of the reward per stream for each user. 0 or `null` means no limit.
			prompt: `You've done it, you're ${thize(first)}!`, //The prompt shown to users when redeeming the reward.
			title: `${thize(first)}!`, //The title of the reward.
			userInputRequired: false, //Whether the reward requires user input to be redeemed.
		};
		//find existing 'first' reward
		for (const element of await twurple.getCustomRewards()) {
			if (/^[0-9]+.*!$/i.test(element.title)) {
				return await twurple.updateCustomReward(element.id, data);
			}
		}
		return await twurple.createCustomReward(data);
	})();
	listener.onChannelCheer(broadcasterId, (event) => {
		server.sendMessage('Audio', 'alerts/alert_bits.mp3');
		const userDisplayName = !event.isAnonymous ? event.userDisplayName : anonymous;
		server.sayWrapper(`${userDisplayName} just cheered ${event.bits} bits!`);
	});
	listener.onChannelFollow(broadcasterId, broadcasterId, (event) => {
		server.actionWrapper('Anonymous Follow++');
		server.sendMessage('Audio', 'alerts/alert_follow.mp3');
	});
	listener.onChannelHypeTrainBegin(broadcasterId, (event) => {
		server.sendMessage('Audio', 'alerts/alert_train.mp3');
	});
	listener.onChannelRedemptionAddForReward(broadcasterId, firstReward.id, async (event) => {
		if (first === 1) server.sendMessage('Audio', 'alerts/ducktales_remastered_no1.mp3');
		else server.sendMessage('Audio', 'alerts/ducktales_remastered_death.mp3');

		server.sayWrapper(`#${first} @${event.userDisplayName}`);
		await twurple.appendTitle(`@${event.userDisplayName} was #${first}`);

		first++;
		fs.writeFileSync('config/first.json', prettyStringify([{ first }], { indent: '\t', maxLength: 1000, maxNesting: 2 }));
		firstReward = await twurple.updateCustomReward(firstReward.id, {
			cost: first, //The channel points cost of the reward.
			prompt: `You've done it, you're ${thize(first)}!`, //The prompt shown to users when redeeming the reward.
			title: `${thize(first)}!`, //The title of the reward.
		});
	});
	const blessReward = await twurple.updateOrCreateCustomReward({
		autoFulfill: true,
		backgroundColor: '#FFFF00',
		cost: 777,
		globalCooldown: null,
		isEnabled: true,
		maxRedemptionsPerStream: 9999,
		maxRedemptionsPerUserPerStream: null,
		prompt: `Give a Blessing to the current Run`,
		title: `Bless the Run`,
		userInputRequired: false,
	});
	listener.onChannelRedemptionAddForReward(broadcasterId, blessReward.id, (event) => {
		server.sayWrapper(`${event.userDisplayName}!! Let's Go!!!! sypher18LUL`);
		server.sendMessage('Audio', 'alerts/zelda_ww_press_start.mp3');
	});
	const curseReward = await twurple.updateOrCreateCustomReward({
		autoFulfill: true,
		backgroundColor: '#BD0078',
		cost: 666,
		globalCooldown: null,
		isEnabled: true,
		maxRedemptionsPerStream: 9999,
		maxRedemptionsPerUserPerStream: null,
		prompt: `Lay a Curse on the current Run`,
		title: `Curse the Run`,
		userInputRequired: false,
	});
	listener.onChannelRedemptionAddForReward(broadcasterId, curseReward.id, (event) => {
		server.sayWrapper(`oGOD  How dare you, ${event.userDisplayName}!?`);
		server.sendMessage('Audio', 'alerts/muten_220v.mp3');
	});

	async function ttsWrapper(event, type) {
		let [_, ttsNumber, spokenText] = (() => {
			const regex = /(\d*)\s*(.*)/;
			let match = event.input.match(regex);
			return match;
		})();

		const voice = (() => {
			log.debug(`ttsNumber: ${ttsNumber}, spokenText: ${spokenText} event.input: ${event.input}`);
			switch (type) {
				case 'tts':
					if (ttsNumber === false || ttsNumber === true || ttsNumber === '') {
						ttsNumber = Math.floor(Math.random() * tts.voices.length);
					}
					return tts.voices[ttsNumber];
				case 'ttsing':
					if (ttsNumber === false || ttsNumber === true || ttsNumber === '') {
						ttsNumber = Math.floor(Math.random() * tts.singingVoices.length);
					}
					return tts.allSingingVoices[ttsNumber];
				case 'ttsanta':
					return tts.voices[28];
			}
		})();

		const ttsFilename = `${await tts.ttsToMP3(spokenText, `alerts/assets/alerts/tts`, voice)}`.replace('alerts/', '');
		server.sendMessage('TTS', ttsFilename);
	}

	const ttsReward = await twurple.updateOrCreateCustomReward({
		autoFulfill: false,
		backgroundColor: '#BD0078',
		cost: 100,
		globalCooldown: 10,
		isEnabled: true,
		maxRedemptionsPerStream: null,
		maxRedemptionsPerUserPerStream: null,
		prompt: `Enter a number followed by text to have the bot read it out loud. type !tts in chat for a list of voices. Example: 1 Hello World`,
		title: `TTS - Text To Speech`,
		userInputRequired: true,
	});
	listener.onChannelRedemptionAddForReward(broadcasterId, ttsReward.id, async (event) => {
		ttsWrapper(event, 'tts');
	});

	const ttsingReward = await twurple.updateOrCreateCustomReward({
		autoFulfill: false,
		backgroundColor: '#BD0078',
		cost: 100,
		globalCooldown: 30,
		isEnabled: true,
		maxRedemptionsPerStream: null,
		maxRedemptionsPerUserPerStream: null,
		prompt: `Enter a number followed by text to have the bot read it out loud. type !ttsing in chat for a list of voices. Example: 1 Hello World`,
		title: `TTSing - Text to Singing`,
		userInputRequired: true,
	});
	listener.onChannelRedemptionAddForReward(broadcasterId, ttsingReward.id, async (event) => {
		ttsWrapper(event, 'ttsing');
	});
}

module.exports.init = init;
module.exports.resetFirst = resetFirst;
