'use strict';
require('dotenv').config();
const twitchInfo = require('./twitchInfo.js');
const fs = require('fs');
const streamer = require('comfy.js');
const bot = require('comfybot.js');
const server = require('websocket').server;
const http = require('http');
const fetch = require('node-fetch');
const mp3Library = require('./mp3Library.js');
const log = require('esm')(module)('./alerts/log.js').log;
let debug = require('esm')(module)('./alerts/log.js').debug;

let commands;
function loadCommands(filename) {
	let command_list = JSON.parse(fs.readFileSync(filename));

	for (let commands_i = 0; commands_i < command_list.length; commands_i++) {
		let this_command = command_list[commands_i];

		if(typeof this_command.author    === 'undefined') this_command.author    = '';
		if(typeof this_command.cooldown  === 'undefined') this_command.cooldown  = 0;
		if(typeof this_command.timestamp === 'undefined') this_command.timestamp = 0;
		if(typeof this_command.active    === 'undefined') this_command.active    = true;
	}

	commands = command_list;
}
loadCommands('commands.json');

let user_array = [];
async function checkProfileImage(user) {
	user = user.toLowerCase();
	if(!user_array.includes(user)) {
		console.log('fired');
		user_array.push(user);
		const filename = `/var/www/html/stream/assets/users/icon/${user}.php`;

		// eslint-disable-next-line no-inner-declarations
		async function callback(err) {
			if (err) { // doesn't exist
				console.log('doesn\'t exist');
				const profile_image_url = (await twitchInfo.getUsers(user)).profile_image_url;
				const content = `<?php $name='${profile_image_url}';$fp=fopen($name,'rb');header("Content-Type:image/png");header("Content-Length:".filesize($name));fpassthru($fp);exit;?>`;
				fs.writeFile(filename, content, err => {
					if (err) {
						console.error(err);
					}
					// file written successfully
				});
				return;
			}
			console.log('exists');
		}
		fs.access(filename, fs.F_OK, callback);
	}
}

async function processCommands(user, message, flags, self, extra) {
	checkProfileImage(user);

	function getQuery(message, command) {
		const start = message.indexOf(command) + command.length;
		const length = message.length - start;
		return message.substr(start, length);
	}

	if(user === process.env.BOT_USER) return;

	let message_lower = message.toLowerCase();
	//console.log(`x: ${test2(message)}`);
	log('debug', `message: ${message}`);

	if(flags.broadcaster) {
		if(message_lower.indexOf('!reload') !== -1)
			loadCommands('commands.json');
		if(message_lower.indexOf('!debug') !== -1)
			debug = !debug;
		if(message_lower.indexOf('!ec') !== -1)
			console.log(await twitchInfo.getChannelInformation('sypherce'));
		if(message_lower.indexOf('!test') !== -1) {
			bot.Say(message);
			streamer.Say(message);
		}
		if(message_lower.indexOf('!enable') !== -1) {
			const query = getQuery(message_lower, '!enable');
			sendMessage('Enable', query);
			console.log('Enable', query);
		}
		if(message_lower.indexOf('!disable') !== -1) {
			const query = getQuery(message_lower, '!disable');
			sendMessage('Disable', query);
			console.log('Disable', query);
		}
	}

	if(message_lower.indexOf('!srinfo') !== -1) {
		say_wrapper('https://sypherce.github.io/stream/sr.html');
	}
	else if(message_lower.indexOf('!sr') !== -1) {
		const query = getQuery(message_lower, '!sr');
		const object = mp3Library.find(query);
		if(typeof object.filename !== 'undefined' && object.filename !== '') {
			sendMessage('Sr', object);
			say_wrapper(`Requested: ${object.album} - ${object.title}`);
		}
		else {
			say_wrapper(`Not Found: ${query}`);
		}
	}

	let number = await processCommandsPart2(user, message, flags, self, extra);
	log('debug', number + ' Commands activated!');
}

async function processVariables(user, query_string, task_string) {

	//console.log('query_string:' + query_string + ' task_string:' + task_string);
	task_string= task_string.replace(/\$\(\s*query\s*\)/, query_string);
	log('temp', `new task_string: ${task_string}`);
	let channel_info = null;

	if(task_string.search(/\$\(\s*user\s*\)/) !== -1 |
	task_string.search(/\$\(\s*touser\s*\)/) !== -1 |
	task_string.search(/\$\(\s*game_and_title\s*\)/) !== -1 |
	task_string.search(/\$\(\s*url\s*\)/) !== -1 |
	task_string.search(/\$\(\s*game\s*\)/) !== -1 |
	task_string.search(/\$\(\s*title\s*\)/) !== -1) {
		channel_info = await twitchInfo.getChannelInformation(query_string.split(' ')[1]);

		if(channel_info.game_name === 'Retro') {
			let title = channel_info.title;
			if(title.length > 45)
				title = `${title.substr(0, 45)}...`;

			channel_info.game_and_title = `Retro (${title})`;
		}
		else {
			channel_info.game_and_title = channel_info.game_name;
		}
	}

	task_string = task_string.replace(/\$\(\s*user\s*\)/,	user);
	if(channel_info !==null) {
		task_string = task_string.replace(/\$\(\s*touser\s*\)/, channel_info.game_and_title);
		task_string = task_string.replace(/\$\(\s*game_and_title\s*\)/, channel_info.game_and_title);
		task_string = task_string.replace(/\$\(\s*game\s*\)/, channel_info.game_name);
		task_string = task_string.replace(/\$\(\s*title\s*\)/, channel_info.title);
		task_string = task_string.replace(/\$\(\s*url\s*\)/, `twitch.tv/${channel_info.broadcaster_name}`);
	}
	task_string = task_string.replace(/\$\(\s*1\s*\)/, query_string.split(' ')[1]);
	task_string = task_string.replace(/\$\(\s*2\s*\)/, query_string.split(' ')[2]);
	task_string = task_string.replace(/\$\(\s*3\s*\)/, query_string.split(' ')[3]);
	task_string = task_string.replace(/\$\(\s*4\s*\)/, query_string.split(' ')[4]);
	task_string = task_string.replace(/\$\(\s*5\s*\)/, query_string.split(' ')[5]);
	task_string = task_string.replace(/\$\(\s*6\s*\)/, query_string.split(' ')[6]);
	task_string = task_string.replace(/\$\(\s*7\s*\)/, query_string.split(' ')[7]);
	task_string = task_string.replace(/\$\(\s*8\s*\)/, query_string.split(' ')[8]);
	task_string = task_string.replace(/\$\(\s*9\s*\)/, query_string.split(' ')[9]);

	return task_string;
}

async function processCommandsPart2(user, message, _flags, _self, extra) {
	//check if 'string' contains indexOf(). if it does, we return it's (contents)
	function keywordIsIndexOf(string) {
		const start = 'indexOf(\'';
		const end = '\')';

		let start_index = string.indexOf(start);
		let end_index = string.lastIndexOf(end);
		if(start_index === -1 | end_index === -1)
			return '';

		return string.slice(start_index + start.length, end_index);
	}

	let message_lower = message.toLowerCase();
	let retVal = 0;

	for (let commands_i = 0; commands_i < commands.length; commands_i++) {
		let this_command = commands[commands_i];
		if(!this_command.active)
			continue;//skips command, continues iterating

		log('verbose', `this_command.task: ${this_command.task}`);
		for (let keyword_i = 0; keyword_i < this_command.keyword.length; keyword_i++) {
			let comparison = keywordIsIndexOf(this_command.keyword[keyword_i]);
			let query = message.substr(message_lower.indexOf(comparison) + comparison.length);

			log('verbose', `keywordIsIndexOf: ${comparison}`);

			if(comparison !== '' && message_lower.search(new RegExp('\\b' + comparison + '\\b')) !== -1) {
				if(this_command.cooldown > extra.timestamp - this_command.timestamp) {
					const cooldown_seconds = Math.ceil((this_command.cooldown - (extra.timestamp - this_command.timestamp)) / 1000);
					whisper_wrapper(`@${user} cooldown for ${cooldown_seconds} more second ${((cooldown_seconds > 1) ? 's' : '')}`, user);
				}
				else {
					commands[commands_i].timestamp = extra.timestamp;

					for (let task_i = 0; task_i < this_command.task.length; task_i++) {
						let this_task = this_command.task[task_i];
						if(this_task.tts) {
							let processed_message = await processVariables(user, query, this_task.tts);
							sendMessage('TTS', processed_message);
						}
						if(this_task.delay) {
							await new Promise(resolve => setTimeout(resolve, this_task.delay));
							log('verbose', `!delay ${parseInt(this_task.delay)}`);
						}
						if(this_task.chat) {
							let processed_message = await processVariables(user, query, this_task.chat);
							say_wrapper(processed_message);
						}

						//https://animate.style/#javascript
						if(this_task.media) {
							if(this_task.media.indexOf('mp4') !== -1)
								sendMessage('Video', this_task.media);
							else
								sendMessage('Audio', this_task.media);
						}
						if(this_task.song) {
							sendMessage('Song', this_task.song);
						}
						if(this_task.videonow) {
							sendMessage('VideoNow', this_task.videonow);
						}

						retVal++;
					}
				}
			}
		}
	}

	return retVal;
}

let connection = null;

async function init() {
	streamer.Init(process.env.STREAMER_USER, process.env.STREAMER_OAUTH);
	bot.Init(process.env.BOT_USER, process.env.BOT_OAUTH, process.env.STREAMER_USER);
	twitchInfo.init(process.env.STREAMER_ID, process.env.STREAMER_SECRET);

	//return await getAuthToken(process.env.BOT_ID, process.env.BOT_SECRET);
}

async function getAuthToken(CLIENTIDGOESHERE, CLIENTSECRETGOESHERE) {
	try {
		const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENTIDGOESHERE}&client_secret=${CLIENTSECRETGOESHERE}&grant_type=client_credentials`,{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		try {
			return await response.json();
		} catch(parseError) {
			log('temp', 'failed to parse JSON:', parseError);
		}
	} catch(error) {
		log('temp', 'Failed to fetch:', error);
	}
}

{//dummy functions
	let chatter_counter = 0;
	streamer.onMessageDeleted = (id, extra) => {
		console.log(`streamer.onMessageDeleted: ${id} ${extra}`);
	};
	streamer.onReward = (user, reward, cost, message, extra) => {
		console.log(`streamer.onReward ${user} ${reward} ${cost} ${message} ${extra}`);
	};
	streamer.onJoin = (user, _self, _extra) => {
		switch (user){
		case process.env.STREAMER_USER:
		case process.env.BOT_USER:
		case 'nightbot':
			break;
		default:
			chatter_counter++;
			console.log(`Chatter #${chatter_counter}, ${user} joined!`);
			break;
		}
	};
	streamer.onPart = (user, _self, _extra) => {
		switch (user){
		case process.env.STREAMER_USER:
		case process.env.BOT_USER:
		case 'nightbot':
			break;
		default:
			chatter_counter--;
			console.log(`Chatter #${chatter_counter}, ${user} parted!`);
			break;
		}
	};
	streamer.onHosted = (user, viewers, autohost, extra) => {
		console.log(`streamer.onHosted ${user} ${viewers} ${autohost} ${extra}`);
	};
	streamer.onBan = (bannedUsername, extra) => {
		console.log(`streamer.onBan ${bannedUsername} ${extra}`);
	};
	streamer.onTimeout = (timedOutUsername, durationInSeconds, extra) => {
		console.log(`streamer.onTimeout ${timedOutUsername} ${durationInSeconds} ${extra}`);
		//test3(`_timeout ${timedOutUsername} ${durationInSeconds}`);
	};
	streamer.onRaid = (user, viewers, extra) => {
		console.log(`streamer.onRaid ${user} ${viewers} ${extra}`);
	};
	streamer.onCheer = (user, message, bits, flags, extra) => {
		console.log(`streamer.onCheer ${user} ${message} ${bits} ${flags} ${extra}`);
	};
	streamer.onSub = (user, message, subTierInfo, extra) => {
		console.log(`streamer.onSub ${user} ${message} ${subTierInfo} ${extra}`);
	};
	streamer.onResub = (user, message, streamMonths, cumulativeMonths, subTierInfo, extra) => {
		console.log(`streamer.onResub ${user} ${message} ${streamMonths} ${cumulativeMonths} ${subTierInfo} ${extra}`);
	};
	streamer.onSubGift = (gifterUser, streakMonths, recipientUser, senderCount, subTierInfo, extra) => {
		console.log(`streamer.onSubGift ${gifterUser} ${streakMonths} ${recipientUser} ${senderCount} ${subTierInfo} ${extra}`);
	};
	streamer.onSubMysteryGift = (gifterUser, numbOfSubs, senderCount, subTierInfo, extra) => {
		console.log(`streamer.onSubMysteryGift ${gifterUser} ${numbOfSubs} ${senderCount} ${subTierInfo} ${extra}`);
	};
	streamer.onGiftSubContinue = (user, sender, extra) => {
		console.log(`streamer.onGiftSubContinue ${user} ${sender} ${extra}`);
	};
	streamer.onConnected = (address, port, isFirstConnect) => {
		console.log(`streamer.onConnected ${address} ${port} ${isFirstConnect}`);
	};
	streamer.onReconnect = (reconnectCount) => {
		console.log(`streamer.onReconnect ${reconnectCount}`);
	};
	streamer.onError = (error) => {
		console.log(`streamer.onError ${error}`);
	};
}
streamer.onChat = (user, message, flags, self, extra) => {
	let _dummy;
	processCommands(user, message, flags, self, extra).then(
		result => _dummy = result
	);
};
bot.onWhisper = (user, message, flags, self, extra) => {
	let _dummy;
	processCommands(user, message, flags, self, extra).then(
		result => _dummy = result
	);
};
streamer.onCommand = (user, command, message, flags, extra) => {
	let _dummy;
	processCommands(user, `!${command} ${message}`, flags, null, extra).then(
		result => _dummy = result
	);
};

function say_wrapper(message) {
	log('debug', message);
	bot.Say(message);
}
function whisper_wrapper(message, _user) {
	//whisper restriction https://discuss.dev.twitch.tv/t/my-bot-cant-send-a-whisp/21481
	log('debug', message);
	bot.Say(`Whisper: ${message}`);//bot.Whispter(message);
}

const socket = new server({
	httpServer: http.createServer().listen(1337)
});

function sendMessage(id, contents) {
	if(connection === null) return;

	if(typeof contents === 'object')
		contents = JSON.stringify(contents);
	else
		contents = `"${contents}"`;

	const message = `{"${id}" : ${contents}}`;

	log('debug', `sendMessage(${message})`);
	connection.sendUTF(message);
}
socket.on('request', function(request) {
	connection = request.accept(null, request.origin);
	console.log(request.origin);

	connection.on('message', function(message) {
		let object = JSON.parse(message.utf8Data);
		console.log(message.utf8Data);
		if(object.Message === 'Client') {
			sendMessage('Message', 'Server');
		}
		else if(object.Message === 'Request Queue') {

			let entry = [mp3Library.getEntry(Math.floor(Math.random()*mp3Library.entries())),
				mp3Library.getEntry(Math.floor(Math.random()*mp3Library.entries())),
				mp3Library.getEntry(Math.floor(Math.random()*mp3Library.entries()))];
			sendMessage('Sr', entry[0]);
			sendMessage('Sr', entry[1]);
			sendMessage('Sr', entry[2]);
		}
		else {
			console.log('Unsupported!');
		}
	});

	connection.on('close', function(_connection) {
		console.log('connection closed');
	});
});

module.exports.sendMessage = sendMessage;
module.exports.init = init;
