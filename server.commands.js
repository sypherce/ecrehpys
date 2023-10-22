const fs = require('fs');
const command_html = require('./command_html.js');
const server = require('./server.js');
const ShuffleBag = require('giffo-shufflebag');
const log = require('esm')(module)('./alerts/log.js').log;
const twurple = require('./twurple.js');
const mp3Library = require('./mp3Library.js');
const prettyStringify = require("@aitodotai/json-stringify-pretty-compact")

let global_commands_list;
function addCa(author, keyword, command) {

	const this_command = {
		author       : author,
		cooldown     : 0,
		timestamp    : 0,
		active       : true,
		tired        : {active: false},
		keyword      : [keyword],
		task         : [{customaudio: command}]
	};

	global_commands_list.push(this_command);
	global_commands_list = saveCommands();
}
function editCa(author, keyword, command) {

	for (let index = 0; index < global_commands_list.length; index++) {
		let this_keyword = global_commands_list[index].keyword.toString();
		if(typeof global_commands_list[index].altkey !== 'undefined')
		this_keyword = global_commands_list[index].altkey.toString();

		if(this_keyword === keyword) {
			//global_commands_list[index].author = author,
			global_commands_list[index].task   = [{customaudio: command}]
		}
	};

	global_commands_list = saveCommands();
}

/**
 * @param {string} filename JSON containing commands
 * @return {object} The results of JSON.parse()
 */
function loadCommands(filename = 'commands.json') {//loads and returns all commands from 'commands.json' in an JSON.parse() object
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
			case '!caa':
			case '!cae':
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
		if(a < b) return -1;
		if(a > b) return 1;

		return 0;
	});
	//put it all together and write to file
	command_html.writeHTMLFile('../stream/sounds.html', html_split.join("\r\n"));

	return command_list;
}
/**
 * @param {string} filename JSON containing commands
 * @return {object} The results of JSON.parse()
 */
function saveCommands(filename = 'commands.json', command_list = global_commands_list) {
	for (let index = 0; index < command_list.length; index++) {
		//set defaults that may not be defined
		const this_command = command_list[index];
		if(this_command.cooldown === 0) delete this_command.cooldown;
		if(this_command.active === true) delete this_command.active;
		if(typeof this_command.tired !== 'undefined') {
			if(typeof this_command.tired.active !== 'undefined') delete this_command.tired.active;
			delete this_command.tired;
		}
		if(typeof this_command.timestamp !== 'undefined') delete this_command.timestamp;

		//!this might be done elsewhere, idk
		//set media_count to 0 if it's needed
		for (let task_i = 0; task_i < this_command.task.length; task_i++) {
			if(typeof this_command.task[task_i].media !== 'undefined' && typeof this_command.task[task_i].media_counter  !== 'undefined')
				delete this_command.task[task_i].media_counter;
		}
	}
	fs.writeFileSync(`${filename}.${Date.now()}`, prettyStringify(command_list, {indent: '\t', maxLength: 1000, maxNesting: 2}));
	fs.writeFileSync(`${filename}`, prettyStringify(command_list, {indent: '\t', maxLength: 1000, maxNesting: 2}));

	return command_list;
}

global_commands_list = loadCommands();
//returns sub-string after 'command' in 'message'
/**
 * @param {string} message message being parsed
 * @param {string} command command or "prefix" we're searching for
 * @return {string} searches for a command and returns the text following it
 */
function getQuery(message, command) {
	const start = message.indexOf(command) + command.length;
	const length = message.length - start;
	return message.substr(start, length);
}
async function processVariables(user, query_string, task_string) {
	task_string = task_string.replace(/\$\(\s*query\s*\)/, query_string);
	log('temp', `new task_string: ${task_string}`);
	let channel_info = null;

	if(task_string.search(/\$\(\s*user\s*\)/) !== -1 |
		task_string.search(/\$\(\s*touser\s*\)/) !== -1 |
		task_string.search(/\$\(\s*game_and_title\s*\)/) !== -1 |
		task_string.search(/\$\(\s*url\s*\)/) !== -1 |
		task_string.search(/\$\(\s*game\s*\)/) !== -1 |
		task_string.search(/\$\(\s*title\s*\)/) !== -1) {
		channel_info = await twurple.getChannelInfoByUsername(`${query}`);

		channel_info.game_and_title = channel_info.gameName;
		if(channel_info.gameName === 'Retro') {
			const max_title_length = 45;
			let title = channel_info.title;
			if(title.length > max_title_length)
				title = `${title.substr(0, max_title_length)}...`;

			channel_info.game_and_title = `${channel_info.gameName} (${title})`;
		}
	}

	task_string = task_string.replace(/\$\(\s*user\s*\)/, user);
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

function tired(command, setting, message, command_list = global_commands_list) {
	if(message.indexOf(command) !== -1) {
		const query = getQuery(message, `${command} `);

		for (let i = 0; i < command_list.length; i++) {
			const this_command = command_list[i];

			if(typeof this_command.altkey !== 'undefined' && this_command.altkey[0].indexOf(query) !== -1) {
				this_command.tired.active = setting;
				return true;
			}
		}
	}
	return false;
}
const attacks = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const replyBag = new ShuffleBag(attacks);
const user_array = [];
async function processMessage(user, message, flags, self, extra) {
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
	async function proccessBuiltInCommands(user, message, flags, _self, _extra){
		message_lower = message;
		if(flags.broadcaster) {
			if(message_lower.indexOf('!reload') !== -1)
				global_commands_list = loadCommands();
			if(message_lower.indexOf('!debug') !== -1)
				debug = !debug;
			if(message_lower.indexOf('!test') !== -1) {
				server.sayWrapper(message);
				streamer.Say(message);
			}
			if(message_lower.indexOf('!enable') !== -1) {
				const query = getQuery(message_lower, '!enable');
				server.sendMessage('Enable', query);
				console.log('Enable', query);
			}
			if(message_lower.indexOf('!disable') !== -1) {
				const query = getQuery(message_lower, '!disable');
				server.sendMessage('Disable', query);
				console.log('Disable', query);
			}
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
					title = `${title.substr(0, max_title_length)}...`;

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
			switch (replyBag.next()) {
				case 0:
					server.sayWrapper(`Meow @${user}`);
					server.sendMessage('Audio', `emil_mgow.mp3`);
					break;
				case 1:
					server.sayWrapper(`@${user} sypher18Awkward`);
					break;
				case 2:
					server.sayWrapper(`@${user} sypher18OMG`);
					break;
				case 3:
					server.sendMessage('Audio', `muten_whaat.mp3`);
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
					server.sendMessage('Audio', `muten_whip.mp3`);
					break;
				case 7:
					server.sayWrapper(`@${user} └(°□°└）`);
					break;
				case 8:
					server.sayWrapper(`You know what? SHUT UP! D:`);
					server.sendMessage('Audio', `office_shut_up.mp3`);
					break;
			}
		}
		if(message_lower.indexOf('!commands') !== -1 || message_lower.indexOf('!sounds') !== -1) {
			server.sayWrapper('https://sypherce.github.io/stream/sounds.html');
		}
		if(user === "sypherce" ||
			user === "missliss15")
			if(tired("!untired", false, message_lower)) return;

		if(user === "sypherce" ||
			user === "missliss15" ||
			user === "residentemil_" ||
			user === "muten_pizza" ||
			user === "subtlewookie" ||
			user === "xjrigsx") {
			if(tired("!tired", true, message_lower)) return;
		}

		const is_broken = false;
		if(is_broken && (message_lower.indexOf('!sr') !== -1)) {
			server.sayWrapper('Song requests are currently broken.');
		}
		else if(message_lower.indexOf('!srinfo') !== -1) {
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
	async function processCustomCommands(user, message, _flags, _self, extra, commands = global_commands_list) {
		let commands_triggered = 0;
		function replaceExtension(filename, original, replacement) {
			if(filename.endsWith(original))
				filename = filename.substr(0, filename.lastIndexOf(original)) + replacement;

			return filename;
		}
		function findCommandByString(string, commands = global_commands_list) {
			for (let index = 0; index < commands.length; index++) {
				let keyword = commands[index].keyword.toString();
				if(typeof commands[index].altkey !== 'undefined')
					keyword = commands[index].altkey.toString();

				if(keyword === string) {
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
		function isCommandCustomAudio(string, commands = global_commands_list) {
			for (let index = 0; index < commands.length; index++) {
				let keyword = commands[index].keyword.toString();
				if(typeof commands[index].altkey !== 'undefined')
					keyword = commands[index].altkey.toString();

				if(keyword === string) {
					if(typeof commands[index].task.at(0).customaudio !== 'undefined')
						return true

					return false;
				}
			}
			return false;
		}
		async function taskIterator9000(user, index, this_command, query){
			for (let task_index = 0; task_index < this_command.task.length; task_index++) {
				const this_task = this_command.task[task_index];

				if(this_task.nocommand) {//this needs to be 1st to override other commands
					return true;
				}
				if(this_task.customaudio) {//this needs to be 2nd to override other commands
					let args = getQuery(message_lower, '!ca ').split(' ');
					if(this_task.customaudio !== 'ca')//reset args if this is a stored audio command
						args = this_task.customaudio.split(' ');
					if(args.length % 3 !== 0) {
						server.sayWrapper(`@${user} Syntax Error: !ca cmd start duration ...`);
						return true;
					}
					for (let index = 0; index < args.length; index += 3) {
						const this_query = args[index];
						args[index] = findCommandByString(args.at(index));
						if(typeof args.at(index) === 'undefined') {
							server.sayWrapper(`@${user} Syntax Error: ${this_query} is invalid`);
							commands_triggered = 0;
							return true;
						}
						if(typeof args.at(index) === 'object')
							args[index] = args.at(index).at(0);
						replaceExtension(args[index], '.gif', '.mp3');
						commands_triggered++;
					}
					server.sendMessage('CustomAudio', args);

					if(this_task.customaudio === 'ca')//return only if this isn't a stored audio command
						return true;
				}
				if(this_task.customaudioadd) {//this needs to be 3rd to override other commands
					query = getQuery(message_lower, '!caa ');
					const firstWord = query.split(" ")[0];
					query = query.substr(firstWord.length+1, query.length - firstWord.length-1);
					const commandExists = typeof findCommandByString(firstWord) !== 'undefined';
					if(commandExists) {
						server.sayWrapper(`@${user} Command "${firstWord}" already exists. Try using !cae to edit.`);
					}
					else {
						addCa(user, firstWord, query);
						server.sayWrapper(`@${user} Command "${firstWord}" added.`);
					}

					return true;
				}
				if(this_task.customaudioedit) {//this needs to be 3rd to override other commands
					query = getQuery(message_lower, '!cae ');
					const firstWord = query.split(" ")[0];
					query = query.substr(firstWord.length+1, query.length - firstWord.length-1);
					const command_to_edit = isCommandCustomAudio(firstWord);
					if(!command_to_edit) {
						server.sayWrapper(`@${user} Command "${firstWord}" doesn't exist, or is wrong type of command. Try using !caa to add it.`);
					}
					else {
						editCa(user, firstWord, query);
						server.sayWrapper(`@${user} Command "${firstWord}" edited.`);
					}

					return true;
				}
				if(this_task.tts) {
					const processed_message = await processVariables(user, query, this_task.tts);
					server.sendMessage('TTS', processed_message);
				}
				if(this_task.delay) {
					await new Promise(resolve => setTimeout(resolve, this_task.delay));
					log('verbose', `!delay ${parseInt(this_task.delay)}`);
				}
				if(this_task.chat) {
					const processed_message = await processVariables(user, query, this_task.chat);
					server.sayWrapper(processed_message);
				}
				if(this_task.alert) {
					server.sendMessage('Alert', this_task.alert);
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
						server.sendMessage('Video', this_media);
					else
						server.sendMessage('Audio', this_media);
				}
				if(this_task.song) {
					server.sendMessage('Song', this_task.song);
				}
				if(this_task.videonow) {
					if(typeof this_command.tired.active !== 'undefined' && this_command.tired.active === true) {
						server.sendMessage('SongSprite', this_task.videonow);
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

						server.sendMessage('VideoNow', this_task.videonow);
					}
				}
				if(this_task.lips) {
					const string = message.substr(message.indexOf('!lips ') + 6).trim();
					const array = string.split(' ');

					await (async function () {
						array[0] = await emote.get(string);
					})();

					server.sendMessage('Lips', array);
				}
				if(this_task.joe) {
					const original = message_lower.substr(message_lower.indexOf('!joe ') + 5);
					let repeat_length = 2;
					let result = '';
					for (let letter = 0; letter < original.length; letter++) {
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
		for (let index = 0; index < commands.length; index++) {
			let this_command = commands[index];
			if(this_command.active === false)
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
					//iterate through each task, returns commands_triggered if ending early
					if(await taskIterator9000(user, index, this_command, query))
						return commands_triggered;
				}
			}
		}

		return commands_triggered;
	}

	const isNewUser = !user_array.includes(user);
	if(isNewUser) {
		user_array.push(user);
		//handle intro
		const alert = findAlertByString(`!${user.toLowerCase()}`);//user commands all have !prefix
		if(alert)
			server.sendMessage('Alert', alert);
		//setup profile image for chat overlay
		await checkProfileImage(user);
	}

	if(user === process.env.BOT_USER) return;

	let message_lower = message.toLowerCase();
	proccessBuiltInCommands(user, message_lower, flags, self, extra);

	const number = await processCustomCommands(user, message, flags, self, extra);
	log('debug', `${user}(${number}): ${message}`);
}

module.exports.process = processMessage;
