'use strict';

require('dotenv').config();
const fs = require('fs');
const twurple = require('./twurple.js');

const staticAuthProvider = require('@twurple/auth').StaticAuthProvider;
const prettyStringify = require("@aitodotai/json-stringify-pretty-compact");

const apiClient = require('@twurple/api').ApiClient;
const AppTokenAuthProvider = require('@twurple/auth').AppTokenAuthProvider;
const EventSubHttpListener = require('@twurple/eventsub-http').EventSubHttpListener;
const NgrokAdapter = require('@twurple/eventsub-ngrok').NgrokAdapter;
const server = require('../core/server.js');
const thize = require('thize');

let first;
let first_reward;
async function resetFirst() {
	first = 1;
	fs.writeFileSync('first.json', prettyStringify([{first}], { indent: '\t', maxLength: 1000, maxNesting: 2 }));
	twurple.updateCustomReward(first_reward.id, {
		cost: first,								//The channel points cost of the reward.
		prompt: `You've done it, you're ${thize(first)}!`,				//The prompt shown to users when redeeming the reward.
		title: `${thize(first)}!`,				//The title of the reward.
		userInputRequired: false
	});
}
async function init(streamer_user = process.env.STREAMER_USER, streamer_id = process.env.STREAMER_ID, streamer_oauth = process.env.STREAMER_OAUTH, listener_secret = process.env.LISTENER_SECRET) {
	const authProviderToken = new AppTokenAuthProvider(streamer_id, process.env.STREAMER_SECRET);
	//setup api connection with streamer authorization
	let api_client_token = new apiClient({ authProvider: authProviderToken });

	const rewards = await twurple.getCustomRewards();
	rewards.forEach((element) => {
		if(	element.title !== 'Curse the Run' &&
			element.title !== 'Bless the Run' &&
			(/^[0-9]+.*!$/i).test(element.title) === false)
		twurple.deleteCustomReward(element.id);
	});

	const listener = new EventSubHttpListener({ apiClient:api_client_token, adapter: new NgrokAdapter(), secret:listener_secret});
	await api_client_token.eventSub.deleteAllSubscriptions();
	listener.start();
	const broadcaster_id = await twurple.getUserByName(streamer_user);
	listener.onChannelRedemptionAdd(broadcaster_id, (event) => {
		console.log(event.rewardTitle);
		if(	event.rewardTitle !== 'Bless the Run' &&
			event.rewardTitle !== 'Curse the Run' &&
			event.rewardTitle !== `${thize(1)}!`)
			server.sendMessage('Audio', 'assets/alerts/mario_chain_chomp.mp3');
	});
	listener.onSubscriptionCreateSuccess(event => {
		console.log('onSubscriptionCreateSuccess', event.id);
	});
	listener.onSubscriptionCreateFailure(event => {
		console.log('onSubscriptionCreateFailure', event.id);
	});

	first = fs.existsSync('first.json') ? JSON.parse(fs.readFileSync('first.json'))[0].first : 100;
	if(first < 1)
		first = 1;

	{
		let data = {
			autoFulfill: true,						//Whether the redemption should automatically set its status to fulfilled.
			backgroundColor: '#FFFF00',				//The hex code of the background color of the reward.
			cost: first,							//The channel points cost of the reward.
			globalCooldown: null,					//The cooldown between two redemptions of the reward, in seconds. 0 or `null` means no cooldown.
			isEnabled: true,						//Whether the reward is enabled (shown to users).
			maxRedemptionsPerStream: null/*first*/,			//The maximum number of redemptions of the reward per stream. 0 or `null` means no limit.
			maxRedemptionsPerUserPerStream: null,	//The maximum number of redemptions of the reward per stream for each user. 0 or `null` means no limit.
			prompt: `You've done it, you're ${thize(first)}!`,				//The prompt shown to users when redeeming the reward.
			title: `${thize(first)}!`,				//The title of the reward.
			userInputRequired: false					//Whether the reward requires user input to be redeemed.
		};
		const list = await twurple.getCustomRewards();
		for(let element of list) {
			if((/^[0-9]+.*!$/i).test(element.title)){
				first_reward = await twurple.updateCustomReward(element.id, data);
				break;
			}
		}
		if(typeof first_reward === 'undefined')
			first_reward = await twurple.createCustomReward(data);
	}
	listener.onChannelCheer(broadcaster_id, (event) => {
		server.sendMessage('Audio', 'assets/alerts/alert_bits.mp3');
		const userDisplayName = (!event.isAnonymous) ?
			event.userDisplayName : anonymous;
		server.sayWrapper(`${userDisplayName} just cheered ${event.bits} bits!`)
	});
	listener.onChannelFollow(broadcaster_id, broadcaster_id, (event) => {
		server.actionWrapper('Anonymous Follow++');
		server.sendMessage('Audio', 'assets/alerts/alert_follow.mp3');
	});
	listener.onChannelHypeTrainBegin(broadcaster_id, (event) => {
		server.sendMessage('Audio', 'assets/alerts/alert_train.mp3');
	});
	listener.onChannelRedemptionAddForReward(broadcaster_id, first_reward.id, async (event) => {
		if(first === 1)
			server.sendMessage('Audio', 'assets/alerts/ducktales_remastered_no1.mp3');
		else
			server.sendMessage('Audio', 'assets/alerts/ducktales_remastered_death.mp3');

		server.sayWrapper(`#${first} @${event.userDisplayName}`)
		await twurple.appendTitle(`@${event.userDisplayName} was #${first}`)

		first++;
		fs.writeFileSync('first.json', prettyStringify([{first}], { indent: '\t', maxLength: 1000, maxNesting: 2 }));
		first_reward = await twurple.updateCustomReward(first_reward.id, {
			cost: first,								//The channel points cost of the reward.
			prompt: `You've done it, you're ${thize(first)}!`,				//The prompt shown to users when redeeming the reward.
			title: `${thize(first)}!`,				//The title of the reward.
			userInputRequired: false
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
		prompt: `Text`,
		title: `Bless the Run`,
		userInputRequired: false
	});
	listener.onChannelRedemptionAddForReward(broadcaster_id, bless_reward.id, event => {
		server.sayWrapper(`${event.userDisplayName}!! Let's Go!!!! sypher18LUL`);
		server.sendMessage('Audio', 'assets/alerts/zelda_ww_press_start.mp3');
	});
	const curse_reward = await twurple.updateOrCreateCustomReward({
		autoFulfill: true,
		backgroundColor: '#BD0078',
		cost: 666,
		globalCooldown: null,
		isEnabled: true,
		maxRedemptionsPerStream: 9999,
		maxRedemptionsPerUserPerStream: null,
		prompt: `Text`,
		title: `Curse the Run`,
		userInputRequired: false
	});
	listener.onChannelRedemptionAddForReward(broadcaster_id, curse_reward.id, event => {
		server.sayWrapper(`oGOD  How dare you, ${event.userDisplayName}!?`)
		server.sendMessage('Audio', 'assets/alerts/muten_220v.mp3');
	});
}

module.exports.init = init;
module.exports.resetFirst = resetFirst;
