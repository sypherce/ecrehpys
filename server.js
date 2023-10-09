'use strict';
require('dotenv').config();
const twitchInfo = require('./twitchInfo.js');
//const twurple = require('./twurple.js');
const fs = require('fs');
const streamer = require('comfy.js');
const bot = require('comfybot.js');
const server = require('websocket').server;
const http = require('http');
const fetch = require('node-fetch');
const mp3Library = require('./mp3Library.js');
const emote = require('./emote.js');
const log = require('esm')(module)('./alerts/log.js').log;
let debug = require('esm')(module)('./alerts/log.js').debug;
const command_html = require('./command_html.js');

//!this is temporary for the new command I'm writing
function addCustomAudio(user, keyword, command) {//new
	let this_command;
	this_command.cooldown         = 0;
	this_command.timestamp        = 0;
	this_command.active           = true;
	this_command.tired            = [];
	this_command.tired.active     = false;

	this_command.author           = user;
	this_command.keyword          = keyword;

	this_command.task.customaudio = command;
}
//!this loads all the commands from commands.json
//!sets defaults that aren't defined
//!processes regexps
//!and adds a couple nightbot commands to the list
//!while also prepping for sounds.html to be generated
//retuns all the commands in an object? maybe array?
//!check this
function loadCommands(filename) {
	let html = '';
	const command_list = JSON.parse(fs.readFileSync(filename));
	function isTired() { return (typeof this_command.tired.active !== 'undefined' && this_command.tired.active === true) }


	for (let index = 0; index < command_list.length; index++) {
		//set defaults that may not be defined
		const this_command          = command_list[index];
		this_command.author       ??= '';
		this_command.cooldown     ??= 0;
		this_command.timestamp    ??= 0;
		this_command.active       ??= true;
		this_command.tired        ??= [];
		this_command.tired.active ??= false;

		//!this might be done elsewhere, idk
		//set media_count to 0 if it's needed
		for (let task_i = 0; task_i < this_command.task.length; task_i++) {
			if(typeof this_command.task[task_i].media === 'object')
				this_command.task[task_i].media_counter = 0;
		}

		//altkey takes priority
		let keyword = (typeof this_command.altkey === 'undefined') ?
			this_command.keyword.at(0):
			this_command.altkey;

		//process regexps
		if(keyword !== this_command.altkey) {
			keyword = keyword.replaceAll('\')', '');
			keyword = keyword.replaceAll('.*', '');
			keyword = keyword.replaceAll('\\s*', ' ');
			keyword = keyword.replaceAll('[s]', ' ');
		}

		//!this currently isn't used
		//setup the description
		let task_string = this_command.task[0].song || this_command.task[0].videonow;
		if(typeof this_command.description !== 'undefined') task_string = this_command.description;
		if(typeof task_string              === 'undefined') task_string = "";

		const formatted_author_string = (this_command.author === '') ?
			'' :
			` [${this_command.author}]`;
		switch(keyword) {
			//ignore commands that aren't media related
			case '!lips':
			case 'joe':
			case '!ca':
			case '!nc':
				break;
			//everything else gets added to the html page
			default:
				html = html.concat(`${keyword}${formatted_author_string}<br>\n`);
				break;
		}
	}
	//add mixitup commands. no extra whitespace
	html = html.concat(`!chomp<br>
hydrate<br>
!inu [resident_emil_]<br>
laugh<br>`);

	//sort commands alphabetically, ignoring '!', numbers are first
	const html_split = html.split(/\r?\n/);
	html_split.sort((a, b) => {
		a = a.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, "");
		b = b.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, "");
		if (a < b) return -1;
		if (a > b) return 1;

		return 0;
	});
	command_html.writeHTMLFile('../stream/sounds.html', html_split.join("\r\n"));

	return command_list;
}
let global_commands_list = loadCommands('commands.json');


function getQuery(message, command) {
	const start = message.indexOf(command) + command.length;
	const length = message.length - start;
	return message.substr(start, length);
}

function tired(command, setting, message, command_list = global_commands_list) {
	if(message.indexOf(command) !== -1) {
		const query = getQuery(message, `${command} `);

		for (let i = 0; i < command_list.length; i++) {
			const this_command = command_list[i];

			if(typeof this_command.altkey !== 'undefined' && this_command.altkey[0].indexOf(query) !== -1){
				this_command.tired.active = setting;
				return true;
			}
		}
	}
	return false;
}

const ShuffleBag = require('giffo-shufflebag');
const attacks = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const replyBag = new ShuffleBag(attacks);
const user_array = [];
async function processCommands(user, message, flags, self, extra) {
	async function writeProfileImage(){
		const filename = `/var/www/html/stream/assets/users/icon/${user}.php`;
		const profile_image_url = (await twitchInfo.getUsers(user)).profile_image_url;
		const content = `<?php $name='${profile_image_url}';$fp=fopen($name,'rb');header("Content-Type:image/png");header("Content-Length:".filesize($name));fpassthru($fp);exit;?>`;
		fs.writeFile(filename, content, err => {
			if (err) {
				console.error(err);
			}
			// file written successfully
		});
	}
	async function checkProfileImage(user) {
		user = user.toLowerCase();
		console.log('fired');
		const filename = `/var/www/html/stream/assets/users/icon/${user}.php`;

		await writeProfileImage();

		fs.access(filename, fs.F_OK, err => {
			if (err) { // doesn't exist
				console.log('doesn\'t exist');
				return;
			}
			console.log('exists');
		});
	}

	const isNewUser = !user_array.includes(user);
	if(isNewUser) {
		user_array.push(user);
		//handle intro
		const alert = findAlertByString(`!${user.toLowerCase()}`);//user commands all have !prefix
		if(alert)
			sendMessage('Alert', alert);
		//setup profile image for chat overlay
		await checkProfileImage(user);
	}

	if(user === process.env.BOT_USER) return;

	let message_lower = message.toLowerCase();

	if(flags.broadcaster) {
		if(message_lower.indexOf('!reload') !== -1)
			global_commands_list = loadCommands('commands.json');
		if(message_lower.indexOf('!debug') !== -1)
			debug = !debug;
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
	if(message_lower.startsWith('!so ')) {
		let query = getQuery(message_lower, '!so').replace(/[^a-zA-Z0-9_]/g, " ").trim().split(' ')[0];
		if(query.length === 0)
			query = 'sypherce';
		const channel_info = await twitchInfo.getChannelInformation(`${query}`);

		channel_info.game_and_title = channel_info.game_name;
		if(channel_info.game_name === 'Retro') {
			const max_title_length = 45;
			if(channel_info.title.length > max_title_length)
				channel_info.title = `${channel_info.title.substr(0, max_title_length)}...`;

			channel_info.game_and_title = `${channel_info.game_name} (${channel_info.title})`;
		}
		bot.Say(`Hey, you should check out twitch.tv/${channel_info.broadcaster_name} ! They were last playing ${channel_info.game_and_title}.`);
	}
	if(message_lower.indexOf('!library') !== -1) {
		const item_list = ["The Fighter's Sword", "The Master Sword", "The Master Sword", "The Butter Sword", "The Fighter's Shield",
			"The Red Shield", "The Mirror Shield", "The Green Clothes", "The Blue Mail", "The Red Mail", "The Pegasus Shoes", "The Power Glove",
			"The Titan's Mitt", "Zora's Flippers", "The Moon Pearl", "The Bow", "The Silver Arrows", "The Boomerang", "The Magical Boomerang",
			"The Hookshot", "some Bombs", "a Mushroom", "The Magic Powder", "The Fire Rod", "The Ice Rod", "The Bombos Medallion", "The Ether Medallion",
			"The Quake Medallion", "The Lantern", "The Magic Hammer", "The Shovel", "The Ocarina", "a Bug Catching Net", "The Book of Mudora",
			"an Empty Bottle", "The Cane of Somaria", "The Cane of Byrna ", "a Magic Cape", "The Magic Mirror", "some Medicine of Life",
			"some Medicine of Magic", "some Medicine of Life and Magic", "a Fairy enslaved in a jar", "a Bee in a jar", "a Golden Bee in a jar",
			"a Super Bomb", "an Arrow", "some Rupee.... I mean Garbage"];
		const item = item_list[Math.floor(Math.random() * item_list.length)];
		bot.Say(`${user} says that ${item} is in the Library!`);
	}
	if(message_lower.startsWith('!unso ')) {
		let query = getQuery(message_lower, '!unso').replace(/[^a-zA-Z0-9_]/g, " ").trim().split(' ')[0];
		if(query.length === 0)
			query = 'sypherce';
		const channel_info = await twitchInfo.getChannelInformation(`${query}`);

		bot.Say(`I take it back, don't follow ${channel_info.broadcaster_name}`);
	}
	if(message_lower.indexOf('@ecrehpys') !== -1) {
		switch (replyBag.next()){
		case 0:
			bot.Say(`Meow @${user}`);
			sendMessage('Audio', `emil_mgow.mp3`);
			break;
		case 1:
			bot.Say(`@${user} sypher18Awkward`);
			break;
		case 2:
			bot.Say(`@${user} sypher18OMG`);
			break;
		case 3:
			sendMessage('Audio', `muten_whaat.mp3`);
			bot.Say(`WHAT @${user.toUpperCase()}!?!??!!?!?`);
			break;
		case 4:
			bot.Say(`@${user} sypher18Cry`);
			break;
		case 5:
			bot.Say(`NiCe @${user}`);
			break;
		case 6:
			bot.Say(`FIGHT ME @${user.toUpperCase()}!`);
			sendMessage('Audio', `muten_whip.mp3`);
			break;
		case 7:
			bot.Say(`@${user} └(°□°└）`);
			break;
		case 8:
			bot.Say(`You know what? SHUT UP! D:`);
			sendMessage('Audio', `office_shut_up.mp3`);
			break;
		}
	}
	if(message_lower.indexOf('!commands') !== -1 || message_lower.indexOf('!sounds') !== -1) {
		bot.Say('https://sypherce.github.io/stream/sounds.html');
	}
	if(user === "sypherce"   ||
	   user === "missliss15")
		if(tired("!untired", false, message_lower)) return;

	if(user === "sypherce"      ||
	   user === "missliss15"    ||
	   user === "residentemil_" ||
	   user === "muten_pizza"   ||
	   user === "subtlewookie"  ||
	   user === "xjrigsx") {
		if(tired("!tired", true, message_lower)) return;
	}

	const is_broken = false;
	if(is_broken && (message_lower.indexOf('!sr') !== -1)) {
		say_wrapper('Song requests are currently broken.');
	}
	else if(message_lower.indexOf('!srinfo') !== -1) {
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

	const number = await processCommandsPart2(user, message, flags, self, extra);
	log('debug', `${user}(${number}): ${message}`);
}

async function processVariables(user, query_string, task_string) {
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
	if(channel_info !== null) {
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
function findAlertByString(string, commands = global_commands_list) {
	for (let index = 0; index < commands.length; index++) {
		const keyword = (typeof commands[index].altkey === 'undefined') ?
			commands[index].keyword.toString() :
			commands[index].altkey.toString();

		if(keyword === string)
			return commands[index].task.at(0).alert;
	}
	return undefined;
}

function findCommandByString(string, commands = global_commands_list) {
	for (let index = 0; index < commands.length; index++) {
		let keyword = commands[index].keyword.toString();
		if(typeof commands[index].altkey  !== 'undefined')
			keyword = commands[index].altkey.toString();

		if(keyword === string){
			if(typeof commands[index].task.at(0).videonow !== 'undefined')
				return commands[index].task.at(0).videonow.toString();
			else if(typeof commands[index].task.at(0).alert !== 'undefined')
				return commands[index].task.at(0).alert.toString();
			else if(typeof commands[index].task.at(0).media !== 'undefined')
				return commands[index].task.at(0).media.toString();
			else if(typeof commands[index].task.at(0).song !== 'undefined')
				return commands[index].task.at(0).song.toString();

			return "";
		}
	}
	return undefined;
}


function replaceExtension(filename, original, replacement) {
	if(filename.endsWith(original))
		filename = filename.substr(0, filename.lastIndexOf(original)) + replacement;

	return filename;
}

async function processCommandsPart2(user, message, _flags, _self, extra, commands = global_commands_list) {
	let message_lower = message.toLowerCase().replace(/\s+/g,' ').trim();
	let commands_triggered = 0;

	//iterate through each command
	for (let index = 0; index < commands.length; index++) {
		let this_command = commands[index];
		if(!this_command.active)
			continue;//skips command, continues iterating

		log('verbose', `this_command.task: ${this_command.task}`);
		//iterate through multiple keywords
		for (let keyword_index = 0; keyword_index < this_command.keyword.length; keyword_index++) {
			let comparison = this_command.keyword.at(keyword_index);
			const query = message.substr(message_lower.indexOf(comparison) + comparison.length);

			log('verbose', `keywordIsIndexOf: ${comparison}`);
			let prefix = '';
			if(comparison.indexOf('!') === 0) {
				prefix = '!';
				comparison = comparison.substr(1);
			}

			if(comparison !== '' && message_lower.search(new RegExp(prefix + '\\b' + comparison + '\\b')) !== -1) {
				if(this_command.cooldown > extra.timestamp - this_command.timestamp) {
					const cooldown_seconds = Math.ceil((this_command.cooldown - (extra.timestamp - this_command.timestamp)) / 1000);
					whisper_wrapper(`@${user} cooldown for ${cooldown_seconds} more second ${((cooldown_seconds > 1) ? 's' : '')}`, user);
					continue;
				}
				commands[index].timestamp = extra.timestamp;
				//iterate through each task
				for (let task_index = 0; task_index < this_command.task.length; task_index++) {
					let this_task = this_command.task[task_index];

					if(this_task.nocommand) {//this needs to be 1st to override other commands
						return commands_triggered;
					}
					if(this_task.customaudio) {//this needs to be 2nd to override other commands
						const args = getQuery(message_lower, '!ca ').split(' ');
						if(args.length %3 !== 0) {
							say_wrapper(`Syntax Error: !ca cmd start duration ...`);
							return commands_triggered;
						}
						for (let index = 0; index < args.length; index+=3) {
							args[index] = findCommandByString(args.at(index));
							if(typeof args.at(index) === 'undefined')
								continue;
							if(typeof args.at(index) === 'object')
								args[index] = args.at(index).at(0);
							replaceExtension(args[index], '.gif', '.mp3');
							commands_triggered++;
						}
						sendMessage('CustomAudio', args);
						return commands_triggered;
					}
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
					if(this_task.alert) {
						sendMessage('Alert', this_task.alert);
					}
					if(this_task.media) {
						let this_media = this_task.media;
						if(typeof this_media === 'object') {
							if(commands[index].task[task_index].media_counter >= commands[index].task[task_index].media.length)
								commands[index].task[task_index].media_counter = 0;
							this_media = commands[index].task[task_index].media[commands[index].task[task_index].media_counter];
							commands[index].task[task_index].media_counter++;
						}

						if(this_media.endsWith('.mp4'))
							sendMessage('Video', this_media);
						else
							sendMessage('Audio', this_media);
					}
					if(this_task.song) {
						sendMessage('Song', this_task.song);
					}
					if(this_task.videonow) {
						if(typeof this_command.tired.active !== 'undefined' && this_command.tired.active === true) {
							sendMessage('SongSprite', this_task.videonow);
						}
						else {
							this_command.lasttimestamp      ??= this_command.timestamp;
							this_command.tired.max_count    ??= 3;
							this_command.tired.counter      ??= 0;
							this_command.tired.active_delay ??= 1;

							//console.log(this_command.timestamp);
							if(this_command.timestamp > this_command.lasttimestamp + this_command.tired.active_delay) {
								//console.log(`${this_command.timestamp} > ${this_command.lasttimestamp} + ${this_command.tired.active_delay}`);
								this_command.lasttimestamp = this_command.timestamp;
								//temporarily disabled until we work on the client side
								//this_command.tired.counter++;
								//console.log(`${this_command.tired.counter}`);
								if(this_command.tired.counter > this_command.tired.max_count) {
									this_command.tired.active = true;
								}
							}

							sendMessage('VideoNow', this_task.videonow);
						}
					}
					if(this_task.lips) {
						const string = message.substr(message.indexOf('!lips ') + 6).trim();
						const array = string.split(' ');

						await (async function(){
							array[0] = await emote.get(string);
						})();

						sendMessage('Lips', array);
					}
					if(this_task.joe) {
						const original = message_lower.substr(message_lower.indexOf('!joe ') + 5);
						let repeat_length = 2;
						let result = '';
						for(let letter = 0; letter < original.length; letter++){
							if(letter == 0 || letter == original.length - 1) {
								result += original[letter];
								continue;
							}
							const random_length = 2 + Math.floor(Math.random() * 6);
							if(random_length > repeat_length)
								repeat_length = random_length;

								result += original[letter].repeat(repeat_length);
						};
						say_wrapper(result);
					}

					commands_triggered++;
				}
			}
		}
	}

	return commands_triggered;
}

async function init() {
	streamer.Init(process.env.STREAMER_USER, process.env.STREAMER_OAUTH);
	bot.Init(process.env.BOT_USER, process.env.BOT_OAUTH, process.env.STREAMER_USER);
	twitchInfo.init(process.env.STREAMER_ID, process.env.STREAMER_SECRET);
//let user = await twurple.GetUserByName('nightbot');
//console.log(user);
//console.log(JSON.stringify(user));


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
	var lurker_counter = [];//add lurker counter
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
			if(lurker_counter.indexOf(user) === -1) {
				lurker_counter.push(user);
				console.log(`Lurker #${lurker_counter.length}, ${user} joined!`);
			}
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
			if(lurker_counter.indexOf(user) !== -1) {
				lurker_counter.pop(user);
				console.log(`Lurker #${lurker_counter.length}, ${user} parted!`);
			}
			break;
		}
	};
	streamer.onHosted = (user, viewers, autohost, extra) => {
		console.log(`streamer.onHosted ${user} ${viewers} ${autohost} ${extra}`);
	};
	streamer.onBan = (bannedUsername, extra) => {
		console.log(`streamer.onBan ${bannedUsername} ${extra}`);
		say_wrapper(`Goodbye ${bannedUsername}!`)
		sendMessage('Audio', "muten_dungeon.mp3");
	};
	streamer.onTimeout = (timedOutUsername, durationInSeconds, extra) => {
		console.log(`streamer.onTimeout ${timedOutUsername} ${durationInSeconds} ${extra}`);
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
	processCommands(user, message, flags, self, extra);
};
bot.onWhisper = (user, message, flags, self, extra) => {
	processCommands(user, message, flags, self, extra);
	bot.Say(`@${user}`);
};
streamer.onCommand = (user, command, message, flags, extra) => {
	processCommands(user, `!${command} ${message}`, flags, null, extra);
};

function say_wrapper(message) {
	log('debug', message);
	bot.Say(message);
}
function whisper_wrapper(message, _user) {
	//whisper restriction https://discuss.dev.twitch.tv/t/my-bot-cant-send-a-whisp/21481
	log('debug', message);
	bot.Say(`Whisper: ${message}`);//bot.Whisper(message);
}

const socket = new server({
	httpServer: http.createServer().listen(1338)
});

let connection = null;
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
socket.on('request', (request) => {
	connection = request.accept(null, request.origin);
	console.log(request.origin);

	connection.on('message', (message) => {
		let object = JSON.parse(message.utf8Data);
		console.log(message.utf8Data);
		switch (object.Message){
		case 'Client':
			sendMessage('Message', 'Server');
			break;
		case 'Request Queue':
			let entry = [mp3Library.getEntry(Math.floor(Math.random()*mp3Library.entries())),
				mp3Library.getEntry(Math.floor(Math.random()*mp3Library.entries())),
				mp3Library.getEntry(Math.floor(Math.random()*mp3Library.entries()))];
			sendMessage('Sr', entry[0]);
			sendMessage('Sr', entry[1]);
			sendMessage('Sr', entry[2]);
			break;
		default:
			console.log('Unsupported!');
			break;
		}
	});

	connection.on('close', (_connection) => {
		console.log('connection closed');
	});
});

module.exports.sendMessage = sendMessage;
module.exports.init = init;
