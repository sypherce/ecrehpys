'use strict';
const fs = require('fs');
const path = require('path');
const command_html = require('./command_html.js');
const server = require('./server.js');
const ShuffleBag = require('giffo-shufflebag');
const twurple = require('../lib/twurple.js');
const mp3Library = require('../lib/mp3Library.js');
const prettyStringify = require("@aitodotai/json-stringify-pretty-compact");
const tts = require('../lib/tts.js');

let global_command_array;

/**
 * Loads and returns all commands from 'commands.json' in a JSON.parse() object.
 *
 * @param {string} [filename='commands.json'] - The filename of the commands JSON file.
 * @returns {Array} - An array containing all the loaded commands.
 */
function loadCommands(filename = 'commands.json') {//loads and returns all commands from 'commands.json' in an JSON.parse() object
	let html = '';
	const command_array = JSON.parse(fs.readFileSync(filename));

	for(const command of command_array) {
		//set defaults that may not be defined
		command.author ??= '';
		command.cooldown ??= 0;
		command.timestamp ??= 0;
		command.active ??= true;

		//!this might be done elsewhere, idk
		//set media_count to 0 if it's needed
		for(const task of command.task) {
			if(typeof task.media === 'object')
				task.media_counter = 0;
		}

		//altkey takes priority
		let keyword = (typeof command.altkey === 'undefined') ?
			command.keyword.at(0) :
			command.altkey.at(0);

		//remove regexps for simplicity
		if(keyword !== command.altkey) {
			keyword = keyword.replaceAll('\')', '');
			keyword = keyword.replaceAll('.*', '');
			keyword = keyword.replaceAll('\\s*', ' ');
			keyword = keyword.replaceAll('[s]', ' ');
		}

		//!this currently isn't used
		//setup the description
		let task_string = command.task[0].song || command.task[0].videonow;
		if(typeof command.description !== 'undefined') task_string = command.description;
		if(typeof task_string === 'undefined') task_string = "";

		const formatted_author_string = (command.author === '') ?
			'' :
			` [${command.author}]`;
		switch(keyword) {
			//ignore commands that aren't media related
			case '!lips':
			case 'joe':
			case '!ca':
			case '!caa':
			case '!cae':
			case '!cal':
			case '!wrap':
			case '!suso':
			case '!sso':
			case '!stickers':
			case '!notfine':
			case '!sprites':
			case 'flippers':
			case '!nc':
				break;
			//everything else gets added to the html page
			default:
				html = html.concat(`${keyword}${formatted_author_string}<br>\n`);
				break;
		}
	}
	//add mixitup commands. remove tabs from formatting
	html = html.concat(`!chomp<br>
						!inu [resident_emil_]<br>
						laugh<br>`).replace(/\t/g,'');

	//sort commands alphabetically, ignoring '!', numbers are first
	const html_split = html.split(/\r?\n/);
	html_split.sort((a, b) => {
		a = a.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, "");
		b = b.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, "");
		if(a < b) return -1;
		if(a > b) return 1;

		return 0;
	});
	//put it all together and write to file
	command_html.writeHTMLFile('../stream/sounds.html', html_split.join("\r\n"));

	return command_array;
}
/**
 * Saves the commands to a JSON file.
 * @param {string} [filename='commands.json'] - The name of the file to save the commands to.
 * @param {Array} [command_array=global_command_array] - The array of commands to save.
 * @returns {Array} - The updated array of commands.
 */
function saveCommands(filename = 'commands.json', command_array = global_command_array) {
	for(const command of command_array) {
		//set defaults that may not be defined
		if(command.cooldown === 0) delete command.cooldown;
		if(command.active === true) delete command.active;
		if(typeof command.timestamp !== 'undefined') delete command.timestamp;

		//!this might be done elsewhere, idk
		//set media_count to 0 if it's needed
		for(const task of command.task) {
			if(typeof task.media !== 'undefined' && typeof task.media_counter !== 'undefined')
				delete task.media_counter;
		}
	}
	fs.writeFileSync(`${filename}`, prettyStringify(command_array, { indent: '\t', maxLength: 1000, maxNesting: 2 }));

	return command_array;
}

global_command_array = loadCommands();
/**
 * Retrieves the query from a string by removing the prefix.
 *
 * Example: getQuery(message_lower, '!joe ');
 *
 * @param {string} string - The input string.
 * @param {string} prefix - The prefix to remove from the string.
 * @returns {string} The query extracted from the string.
 */
function getQuery(string, prefix) {
	const start = string.indexOf(prefix) + prefix.length;
	return string.substring(start);
}
//this needs implemented fully
async function processVariables(user, query_string, task_string) {
	task_string = task_string.replace(/\$\(\s*query\s*\)/, query_string);
	console.log('T:', `new task_string: ${task_string}`);
	let channel_info = null;

	if(task_string.search(/\$\(\s*user\s*\)/) !== -1 |
		task_string.search(/\$\(\s*touser\s*\)/) !== -1 |
		task_string.search(/\$\(\s*game_and_title\s*\)/) !== -1 |
		task_string.search(/\$\(\s*url\s*\)/) !== -1 |
		task_string.search(/\$\(\s*game\s*\)/) !== -1 |
		task_string.search(/\$\(\s*title\s*\)/) !== -1) {
		channel_info = await twurple.getChannelInfoByUsername(user);

		channel_info.game_and_title = channel_info.gameName;
		if(channel_info.gameName === 'Retro') {
			const max_title_length = 45;
			let title = channel_info.title;
			if(title.length > max_title_length)
				title = `${title.substring(0, max_title_length)}...`;

			channel_info.game_and_title = `${channel_info.gameName} (${title})`;
		}
	}

	task_string = task_string.replace(/\$\(\s*user\s*\)/, user);
	if(channel_info !== null) {
		task_string = task_string.replace(/\$\(\s*touser\s*\)/, query_string.split(' ')[1]);
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

const attacks = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const replyBag = new ShuffleBag(attacks);
let user_array = [];
async function processMessage(user, message, flags, self, extra) {
	async function loadUserArray() {
		try {
			return JSON.parse(fs.readFileSync('chatters.json'));
		} catch (e) {
			console.error(e); // error in the above string (in this case, yes)!
			return [];
		}
	}
	async function saveUserArray(array) {
		fs.writeFileSync('chatters.json', prettyStringify(array, { indent: '\t', maxLength: 1000, maxNesting: 2 }));
	}
	async function checkProfileImage(user) {
		async function writeProfileImage(filename) {
			const profile_image_url = (await twurple.getUserByName(user)).profilePictureUrl;
			const content = `<?php $name='${profile_image_url}';$fp=fopen($name,'rb');header("Content-Type:image/png");header("Content-Length:".filesize($name));fpassthru($fp);exit;?>`;
			fs.writeFile(filename, content, err => {
				if(err) {
					console.error(err);
				}
				// file written successfully
			});
		}
		user = user.toLowerCase();
		console.log('fired');
		const filename = `/var/www/html/stream/assets/users/icon/${user}.php`;

		await writeProfileImage(filename);

		fs.access(filename, fs.F_OK, err => {
			if(err) { // doesn't exist
				console.log('doesn\'t exist');
				return;
			}
			console.log('exists');
		});
	}
	function findAlertByString(string, command_array = global_command_array) {
		for(const command of command_array) {
			const keyword = (typeof command.altkey === 'undefined') ?
				command.keyword.toString() :
				command.altkey.toString();

			if(keyword === string)
				return command.task.at(0).alert;
		}
		return undefined;
	}
	async function proccessBuiltInCommands(user, message, flags, _self, _extra) {
		let message_lower = message.toLowerCase();
		if(flags.broadcaster) {
			//reload commands list, loadCommands()
			if(message_lower.indexOf('!reload') !== -1) {
				const saved_command_array = global_command_array;
				try {
					global_command_array = loadCommands();
					console.log('Commands Reloaded.');
				} catch (e) {
					global_command_array = saved_command_array;
					console.error(e); // error in the above string (in this case, yes)!
					console.log('Commands failed to reload.');
				}
			}
			//stop bot (restart if running in a loop)
			if(message_lower.indexOf('!halt') !== -1) {
				process.exit();
			}
			//clear users enabling intros again
			//also clears user avatars for chat
			//and resets "first"
			if(	message_lower.indexOf('!clear_users') !== -1 ||
				message_lower.indexOf('!refresh_users') !== -1 ||
				message_lower.indexOf('!reload_users') !== -1) {
				function deleteFile(filename) {
					fs.unlink(filename, (err => {
						if(err)
							console.log(err);
						else
							console.log(`Deleted file: ${filename}`);
					}));
				}
				function clearDirectory(directory) {
					fs.readdir(directory, (err, files) => {
						if (err) throw err;

						for (const file of files) {
							deleteFile(path.join(directory, file));
						}
					  });
				}
				user_array = [];
				deleteFile("chatters.json");
				clearDirectory('../../users/icon');
				twurple.token.resetFirst();
			}
			if(message_lower.indexOf('!debug') !== -1)
				debug = !debug;
			if(message_lower.indexOf('!test') !== -1) {
				server.sayWrapper(message);
			}
			//play full length songs if enabled
			if(message_lower.indexOf('!enable') !== -1) {
				const query = getQuery(message_lower, '!enable');
				server.sendMessage('Enable', query);
				console.log('Enable', query);
			}
			//play songsprites if disabled
			if(message_lower.indexOf('!disable') !== -1) {
				const query = getQuery(message_lower, '!disable');
				server.sendMessage('Disable', query);
				console.log('Disable', query);
			}
		}
		if(message_lower.startsWith('!timeout')) {
			const query = getQuery(message_lower, '!timeout').replace(/[^a-zA-Z0-9_]/g, " ").trim().split(' ');
			let user = query[0];
			let seconds = typeof query[1] !== 'undefined' ? query[1] : 69;
			const multiplier = typeof seconds === 'string' ? seconds.match(/[a-zA-Z]+/g)[0] : 's';//extract the multiplier first
			seconds = typeof seconds === 'string' ? seconds.match(/\d+/g)[0] : seconds;//extract time last
			switch (multiplier) {
				case 'm':
					seconds = seconds * 60;
					break;
				case 'h':
					seconds = seconds * 60 * 60;
					break;
				case 'd':
					seconds = seconds * 60 * 60 * 24;
					break;
				case 'w':
					seconds = seconds * 60 * 60 * 24 * 7;
					break;
			}
			if(user.length === 0)
				user = 'wally4000';

			const channel_info = await twurple.getChannelInfoByUsername(user);
			server.sayWrapper(`GET OUT ${channel_info.displayName} sypher18OMG`);
			/*don't await, it's faster */twurple.timeoutUser({user: channel_info.id, duration: seconds, reason: 'Is a butt'});
			const tts_filename = `../${(await tts.ttsToMP3(`GET OUT ${channel_info.displayName.replaceAll('_', ' ')}`, `alerts/assets/alerts/tts`, tts.voices[27]))}`.replace('../alerts/', '');
			server.sendMessage('TTS', `${tts_filename}`);
			server.sendMessage('Audio', 'assets/alerts/muten_dungeon.mp3');
			const is_mod = await twurple.checkUserMod(user);
			if(is_mod)
				setTimeout(function() {
					twurple.setModerator(user)
				}, (seconds + 5) * 1000);
		}
		if(message_lower.startsWith('!so ')) {
			let query = getQuery(message_lower, '!so').replace(/[^a-zA-Z0-9_]/g, " ").trim().split(' ')[0];
			if(query.length === 0)
				query = 'sypherce';
			const channel_info = await twurple.getChannelInfoByUsername(`${query}`);
			console.log(`${query}`);
			console.log(query);

			channel_info.game_and_title = channel_info.gameName;
			if(channel_info.gameName === 'Retro') {
				const max_title_length = 45;
				let title = channel_info.title;
				if(title.length > max_title_length)
					title = `${title.substring(0, max_title_length)}...`;

				channel_info.game_and_title = `${channel_info.gameName} (${title})`;
			}
			server.sayWrapper(`Hey, you should check out twitch.tv/${channel_info.displayName} ! They were last playing ${channel_info.game_and_title}.`);
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
			server.sayWrapper(`${user} says that ${item} is in the Library!`);
		}
		if(message_lower.startsWith('!unso ')) {
			let query = getQuery(message_lower, '!unso').replace(/[^a-zA-Z0-9_]/g, " ").trim().split(' ')[0];
			if(query.length === 0)
				query = 'sypherce';
			const channel_info = await twurple.getChannelInfoByUsername(`${query}`);

			server.sayWrapper(`I take it back, don't follow ${channel_info.displayName}`);
		}
		if(message_lower.indexOf('@ecrehpys') !== -1) {
			switch(replyBag.next()) {
				case 0:
					server.sayWrapper(`Meow @${user}`);
					server.sendMessage('Audio', `assets/alerts/emil_mgow.mp3`);
					break;
				case 1:
					server.sayWrapper(`@${user} sypher18Awkward`);
					break;
				case 2:
					server.sayWrapper(`@${user} sypher18OMG`);
					break;
				case 3:
					server.sendMessage('Audio', `assets/alerts/muten_whaat.mp3`);
					server.sayWrapper(`WHAT @${user.toUpperCase()}!?!??!!?!?`);
					break;
				case 4:
					server.sayWrapper(`@${user} sypher18Cry`);
					break;
				case 5:
					server.sayWrapper(`NiCe @${user}`);
					break;
				case 6:
					server.sayWrapper(`FIGHT ME @${user.toUpperCase()}!`);
					server.sendMessage('Audio', `assets/alerts/muten_whip.mp3`);
					break;
				case 7:
					server.sayWrapper(`@${user} └(°□°└）`);
					break;
				case 8:
					server.sayWrapper(`You know what? SHUT UP! D:`);
					server.sendMessage('Audio', `assets/alerts/office_shut_up.mp3`);
					break;
			}
		}
		if(message_lower.indexOf('!commands') !== -1 || message_lower.indexOf('!sounds') !== -1) {
			server.sayWrapper('https://sypherce.github.io/stream/sounds.html');
		}

		if(message_lower.indexOf('!srinfo') !== -1) {
			server.sayWrapper('https://sypherce.github.io/stream/sr.html');
		}
		else if(message_lower.indexOf('!sr') !== -1) {
			const query = getQuery(message_lower, '!sr');
			const object = mp3Library.find(query);
			if(typeof object.filename !== 'undefined' && object.filename !== '') {
				server.sendMessage('Sr', object);
				server.sayWrapper(`Requested: ${object.album} - ${object.title}`);
			}
			else {
				server.sayWrapper(`Not Found: ${query}`);
			}
		}
	}
	async function processCustomCommands(user, message, _flags, _self, extra, command_array = global_command_array) {
		let commands_triggered = 0;
		function replaceExtension(filename, original, replacement) {
			if(filename.endsWith(original))
				filename = filename.substring(0, filename.lastIndexOf(original)) + replacement;

			return filename;
		}
		function findCommandByString(string, command_array = global_command_array) {
			for(const command of command_array) {
				let keyword = command.keyword.toString();
				if(typeof command.altkey !== 'undefined')
					keyword = command.altkey.toString();

				if(keyword === string) {
					if(typeof command.task.at(0).videonow !== 'undefined')
						return command.task.at(0).videonow.toString();
					else if(typeof command.task.at(0).alert !== 'undefined')
						return command.task.at(0).alert.toString();
					else if(typeof command.task.at(0).media !== 'undefined')
						return command.task.at(0).media.toString();
					else if(typeof command.task.at(0).song !== 'undefined')
						return command.task.at(0).song.toString();

					return "";
				}
			}
			return undefined;
		}
		function isCommandCustomAudio(string, command_array = global_command_array) {
			for(const command of command_array) {
				let keyword = command.keyword.toString();
				if(typeof command.altkey !== 'undefined')
					keyword = command.altkey.toString();

				if(keyword === string) {
					if(typeof command.task.at(0).customaudio !== 'undefined')
						return true;

					return false;
				}
			}
			return false;
		}
		async function processTasks(user, command, query) {
			for(const task of command.task) {
				// this blocks all commands from being triggered
				// example !nc water
				if(task.nocommand) {//this needs to be 1st to override other commands
					return true;
				}
				// this plays audio commands spliced together
				// example !ca witw 21000 2650 !xjrigsx 400 800
				if(task.customaudio) {//this needs to be 2nd to override other commands
					let args = getQuery(message_lower, '!ca ').split(' ');
					if(task.customaudio !== 'ca')//reset args if this is a stored audio command
						args = task.customaudio.split(' ');
					if(args.length % 3 !== 0) {
						server.sayWrapper(`@${user} Syntax Error: !ca cmd start duration ...`);
						return true;
					}
					for(let index = 0; index < args.length; index += 3) {
						args[index] = findCommandByString(args.at(index));
						if(typeof args.at(index) === 'undefined') {
							server.sayWrapper(`@${user} Syntax Error: ${args[index]} is invalid`);
							commands_triggered = 0;
							return true;
						}
						if(typeof args.at(index) === 'object')
							args[index] = args.at(index).at(0);
						replaceExtension(args[index], '.gif', '.mp3');
						commands_triggered++;
					}
					server.sendMessage('CustomAudio', args);

					if(task.customaudio === 'ca')//return only if this isn't a stored audio command
						return true;
				}
				// this adds a custom audio command
				// example !caa witwrigs witw 21000 2650 !xjrigsx 400 800
				if(task.customaudioadd) {//this needs to be 3rd to override other commands
					query = getQuery(message_lower, '!caa ');
					const firstWord = query.split(" ")[0];
					query = query.substring(firstWord.length + 1, firstWord.length + 1 + query.length - firstWord.length - 1);
					const commandExists = typeof findCommandByString(firstWord) !== 'undefined';
					if(commandExists) {
						server.sayWrapper(`@${user} Command "${firstWord}" already exists. Try using !cae to edit.`);
					}
					else {
						const addCustomAudio = function (author, keyword, customaudio) {
							const new_command = {
								author: user,
								cooldown: 0,
								timestamp: 0,
								active: true,
								keyword: [firstWord],
								task: [{ customaudio: query }]
							};

							global_command_array.push(new_command);
							global_command_array = saveCommands();
						}(user, firstWord, query);
						server.sayWrapper(`@${user} Command "${firstWord}" added.`);
					}

					return true;
				}
				// this edits a custom audio command
				// example !cae witwrigs witw 21000 2650 !xjrigsx 400 800
				if(task.customaudioedit) {//this needs to be 4th to override other commands
					query = getQuery(message_lower, '!cae ');
					const firstWord = query.split(" ")[0];
					query = query.substring(firstWord.length + 1, firstWord.length + 1 + query.length - firstWord.length - 1);
					const command_to_edit = isCommandCustomAudio(firstWord);
					if(!command_to_edit) {
						server.sayWrapper(`@${user} Command "${firstWord}" doesn't exist, or is wrong type of command. Try using !caa to add it.`);
					}
					else {
						const editCustomAudio = function(author = user, keyword = firstWord, custom_audio_command = query) {
							for(const command of global_command_array) {
								const keyword_or_altkey = (typeof command.altkey !== 'undefined') ?
									command.altkey.toString() :
									command.keyword.toString();

								if(keyword_or_altkey === keyword) {
									//global_command_array[index].author = author,
									command.task = [{ customaudio: custom_audio_command }];
								}
							}

							global_command_array = saveCommands();
						}; editCustomAudio();
						server.sayWrapper(`@${user} Command "${firstWord}" edited.`);
					}

					return true;
				}
				// this lists an already saved custom audio command
				// example !cal witwrigs
				if(task.customaudiolist) {//this needs to be 5th to override other commands
					query = getQuery(message_lower, '!cal ');
					const firstWord = query.split(" ")[0];
					query = query.substring(firstWord.length + 1, firstWord.length + 1 + query.length - firstWord.length - 1);
					const command_to_list = isCommandCustomAudio(firstWord);
					if(!command_to_list) {
						server.sayWrapper(`@${user} Command "${firstWord}" doesn't exist, or is wrong type of command.`);
					}
					else {
						const listCustomAudio = function () {
							for(let command of global_command_array) {
								const keyword_or_altkey = (typeof command.altkey !== 'undefined') ?
								command.altkey.toString() :
								command.keyword.toString();

								if(keyword_or_altkey === firstWord &&
									(typeof command.task[0].customaudio !== 'undefined'))
									return `!ca ${command.task[0].customaudio}`;
							};

							return "";
						}; let response = listCustomAudio(firstWord);
						server.sayWrapper(`@${user} "${response}"`);
					}

					return true;
				}
				if(task.tts || task.ttsing) {
					function isNumber(number) {
						if(number === false ||
							number === true ||
							number === '')
							return false;
						return !isNaN(number)
					}
					let type = (task.tts + task.ttsing).replace('undefined', '');
					if(type.split(' ').length > 1) {//if it's a set command like "jim"
						message_lower = `!${type}`;
						type = type.split(' ')[0].match(/[a-zA-Z]+/g)[0];
					}
					let sub_message = getQuery(message_lower, `!${type}`);
					let voice = type;
					let tts_number = sub_message.substring(0, sub_message.indexOf(' '));
					//if(tts_number === '') {
					//	tts_number = sub_message;
					//	sub_message = '';
					//}
					if(isNumber(tts_number)) {
						console.log(1, tts_number, isNumber(tts_number), type);
						if(type === 'ttsing')
							voice = tts.all_singing_voices[tts_number];
						else
							voice = tts.voices[tts_number];
					}
					if(tts_number === 'anta')
						voice = tts.voices[28];

					sub_message = sub_message.substring(sub_message.indexOf(' '));

					const processed_message = await processVariables(user, query, sub_message);
					const tts_filename = `${(await tts.ttsToMP3(processed_message, `alerts/assets/alerts/tts`, voice))}`.replace('alerts/', '');
					server.sendMessage('TTS', tts_filename);

					return true;
				}
				//this may or may not work.
				if(task.delay) {
					await new Promise(resolve => setTimeout(resolve, task.delay));
					console.log('V:', `!delay ${parseInt(task.delay)}`);
				}
				if(task.chat) {
					const processed_message = await processVariables(user, query, task.chat);
					server.sayWrapper(processed_message);
				}
				if(task.alert) {
					server.sendMessage('Alert', task.alert);
				}
				if(task.media) {
					let filename = task.media;
					if(typeof task.media === 'object') {
						if(task.media_counter >= task.media.length)
							task.media_counter = 0;
						filename = task.media[task.media_counter];
						task.media_counter++;
					}

					if(filename.endsWith('.mp4'))
						server.sendMessage('Video', filename);
					else
						server.sendMessage('Audio', filename);
				}
				if(task.song) {
					server.sendMessage('Song', task.song);
				}
				if(task.videonow) {
					command.lasttimestamp ??= command.timestamp;
					server.sendMessage('VideoNow', task.videonow);
				}
				if(task.lips) {
					const string = message.substring(message.indexOf('!lips ') + 6).trim();
					const array = string.split(' ');

					await (async function() {
						array[0] = await emote.get(string);
					})();

					server.sendMessage('Lips', array);
				}
				if(task.joe) {
					const original = getQuery(message_lower, '!joe ');
					let repeat_length = 2;
					let result = '';
					for(let letter in original) {
						if(letter === 0 || letter === original.length - 1) {
							result += original[letter];
							continue;
						}
						const random_length = 2 + Math.floor(Math.random() * 6);
						if(random_length > repeat_length)
							repeat_length = random_length;

						result += original[letter].repeat(repeat_length);
					};
					server.sayWrapper(result);
				}
				commands_triggered++;
				console.log(commands_triggered);
			}
			return false;
		}

		let message_lower = message.toLowerCase().replace(/\s+/g, ' ').trim();

		//iterate through each command
		for(const command of command_array) {
			if(command.active === false)
				continue;//skips command, continues iterating

			//console.log('V:', `this_command.task: ${this_command.task}`);
			//iterate through multiple keywords
			for(const keyword_index in command.keyword) {
				let comparison = command.keyword.at(keyword_index);
				const query = message.substring(message_lower.indexOf(comparison) + comparison.length);

				//console.log('V:', `keywordIsIndexOf: ${comparison}`);
				let prefix = '';
				if(comparison.indexOf('!') === 0) {
					prefix = '!';
					comparison = comparison.substring(1);
				}

				if(comparison !== '' && message_lower.search(new RegExp(prefix + '\\b' + comparison + '\\b')) !== -1) {
					if(command.cooldown > extra.timestamp - command.timestamp) {
						const cooldown_seconds = Math.ceil((command.cooldown - (extra.timestamp - command.timestamp)) / 1000);
						whisper_wrapper(`@${user} cooldown for ${cooldown_seconds} more second ${((cooldown_seconds > 1) ? 's' : '')}`, user);
						continue;
					}
					command.timestamp = extra.timestamp;
					//iterate through each task, returns commands_triggered if ending early
					if(await processTasks(user, command, query))
						return commands_triggered;
				}
			}
		}

		return commands_triggered;
	}

	/* MAIN_FUNCTION() */

	if(user_array.length === 0) {
		user_array = await loadUserArray();
	}
	const isNewUser = !user_array.includes(user);
	if(isNewUser) {
		user_array.push(user);
		await saveUserArray(user_array);

		//handle intro
		const alert = findAlertByString(`!${user.toLowerCase()}`);//user commands all have !prefix
		if(alert)
			server.sendMessage('Alert', alert);
		//setup profile image for chat overlay
		await checkProfileImage(user);
	}

	if(user === process.env.BOT_USER) return;

	proccessBuiltInCommands(user, message, flags, self, extra);

	const number = await processCustomCommands(user, message, flags, self, extra);
	console.log('D:', `${user}(${number}): ${message}`);
}

module.exports.process = processMessage;
