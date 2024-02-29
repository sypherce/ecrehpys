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
let first_reward;
async function resetFirst() {
	first = 1;
	fs.writeFileSync('config/first.json', prettyStringify([{ first }], { indent: '\t', maxLength: 1000, maxNesting: 2 }));
	twurple.updateCustomReward(first_reward.id, {
		cost: first, //The channel points cost of the reward.
		prompt: `You've done it, you're ${thize(first)}!`, //The prompt shown to users when redeeming the reward.
		title: `${thize(first)}!`, //The title of the reward.
	});
}
async function init(
	streamer_user = process.env.STREAMER_USER,
	streamer_id = process.env.STREAMER_ID,
	streamer_oauth = process.env.STREAMER_OAUTH,
	listener_secret = process.env.LISTENER_SECRET,
	streamer_auth_provider
) {
	//setup api connection with streamer authorization
	const api_client_token = new apiClient({ authProvider: streamer_auth_provider });

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
		apiClient: api_client_token,
	});
	await api_client_token.eventSub.deleteAllSubscriptions();
	listener.start();
	const broadcaster_id = await twurple.getUserByName(streamer_user);
	listener.onChannelRedemptionAdd(broadcaster_id, (event) => {
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
		log.debug('onSubscriptionCreateSuccess', event.id);
	});
	listener.onSubscriptionCreateFailure((event) => {
		log.debug('onSubscriptionCreateFailure', event.id);
	});

	first = (() => {
		const filePath = 'config/first.json';
		if (fs.existsSync(filePath)) {
			const firstValue = JSON.parse(fs.readFileSync(filePath))[0].first;
			return firstValue < 1 ? 1 : firstValue;
		}
		throw new Error('config/first.json not found');
	})();

	first_reward = await (async () => {
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
	listener.onChannelCheer(broadcaster_id, (event) => {
		server.sendMessage('Audio', 'alerts/alert_bits.mp3');
		const userDisplayName = !event.isAnonymous ? event.userDisplayName : anonymous;
		server.sayWrapper(`${userDisplayName} just cheered ${event.bits} bits!`);
	});
	listener.onChannelFollow(broadcaster_id, broadcaster_id, (event) => {
		server.actionWrapper('Anonymous Follow++');
		server.sendMessage('Audio', 'alerts/alert_follow.mp3');
	});
	listener.onChannelHypeTrainBegin(broadcaster_id, (event) => {
		server.sendMessage('Audio', 'alerts/alert_train.mp3');
	});
	listener.onChannelRedemptionAddForReward(broadcaster_id, first_reward.id, async (event) => {
		if (first === 1) server.sendMessage('Audio', 'alerts/ducktales_remastered_no1.mp3');
		else server.sendMessage('Audio', 'alerts/ducktales_remastered_death.mp3');

		server.sayWrapper(`#${first} @${event.userDisplayName}`);
		await twurple.appendTitle(`@${event.userDisplayName} was #${first}`);

		first++;
		fs.writeFileSync('config/first.json', prettyStringify([{ first }], { indent: '\t', maxLength: 1000, maxNesting: 2 }));
		first_reward = await twurple.updateCustomReward(first_reward.id, {
			cost: first, //The channel points cost of the reward.
			prompt: `You've done it, you're ${thize(first)}!`, //The prompt shown to users when redeeming the reward.
			title: `${thize(first)}!`, //The title of the reward.
		});
	});
	const bless_reward = await twurple.updateOrCreateCustomReward({
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
	listener.onChannelRedemptionAddForReward(broadcaster_id, bless_reward.id, (event) => {
		server.sayWrapper(`${event.userDisplayName}!! Let's Go!!!! sypher18LUL`);
		server.sendMessage('Audio', 'alerts/zelda_ww_press_start.mp3');
	});
	const curse_reward = await twurple.updateOrCreateCustomReward({
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
	listener.onChannelRedemptionAddForReward(broadcaster_id, curse_reward.id, (event) => {
		server.sayWrapper(`oGOD  How dare you, ${event.userDisplayName}!?`);
		server.sendMessage('Audio', 'alerts/muten_220v.mp3');
	});

	async function ttsWrapper(event, type) {
		let [_, tts_number, spokenText] = (() => {
			const regex = /(\d*)\s*(.*)/;
			let match = event.input.match(regex);
			return match;
		})();

		const voice = (() => {
			log.debug(`tts_number: ${tts_number}, spokenText: ${spokenText} event.input: ${event.input}`);
			switch (type) {
				case 'tts':
					if (tts_number === false || tts_number === true || tts_number === '') {
						tts_number = Math.floor(Math.random() * tts.voices.length);
					}
					return tts.voices[tts_number];
				case 'ttsing':
					if (tts_number === false || tts_number === true || tts_number === '') {
						tts_number = Math.floor(Math.random() * tts.singing_voices.length);
					}
					return tts.all_singing_voices[tts_number];
				case 'ttsanta':
					return tts.voices[28];
			}
		})();

		const tts_filename = `${await tts.ttsToMP3(spokenText, `alerts/assets/alerts/tts`, voice)}`.replace('alerts/', '');
		server.sendMessage('TTS', tts_filename);
	}

	const tts_reward = await twurple.updateOrCreateCustomReward({
		autoFulfill: true,
		backgroundColor: '#BD0078',
		cost: 1000,
		globalCooldown: 10,
		isEnabled: true,
		maxRedemptionsPerStream: null,
		maxRedemptionsPerUserPerStream: null,
		prompt: `Enter a number followed by text to have the bot read it out loud. type !tts in chat for a list of voices. Example: 1 Hello World`,
		title: `TTS - Text To Speech`,
		userInputRequired: true,
	});
	listener.onChannelRedemptionAddForReward(broadcaster_id, tts_reward.id, async (event) => {
		ttsWrapper(event, 'tts');
	});

	const ttsing_reward = await twurple.updateOrCreateCustomReward({
		autoFulfill: true,
		backgroundColor: '#BD0078',
		cost: 1000,
		globalCooldown: 30,
		isEnabled: true,
		maxRedemptionsPerStream: null,
		maxRedemptionsPerUserPerStream: null,
		prompt: `Enter a number followed by text to have the bot read it out loud. type !ttsing in chat for a list of voices. Example: 1 Hello World`,
		title: `TTSing - Text to Singing`,
		userInputRequired: true,
	});
	listener.onChannelRedemptionAddForReward(broadcaster_id, ttsing_reward.id, async (event) => {
		ttsWrapper(event, 'ttsing');
	});
}

module.exports.init = init;
module.exports.resetFirst = resetFirst;
