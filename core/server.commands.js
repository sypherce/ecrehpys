'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const commandHtml = require('./commandHtml.js');
const server = require('./server.js');
const ShuffleBag = require('giffo-shufflebag');
const twurple = require('../lib/twurple.js');
const mp3Library = require('../lib/mp3Library.js');
const prettyStringify = require('@aitodotai/json-stringify-pretty-compact');
const tts = require('../lib/tts.js');
const jsonArray = require('../lib/jsonArray.js');
const ecrehpysGPT = require('../lib/ecrehpysGPT.js');
const log = require('esm')(module)('../alerts/lib/log.js').log;
const twss = require('twss');
const removePunctuation = require('@stdlib/string-remove-punctuation');

let isSoundRequestsEnabled = true;
let globalCommandArray = loadCommands();
let userArray = [];

/**Loads and returns all commands from 'config/commands.json' in a JSON.parse() object.
 *
 * @param {string} [filename='config/commands.json'] - The filename of the commands JSON file.
 * @returns {Array} - An array containing all the loaded commands.
 */
function loadCommands(filename = 'config/commands.json') {
	//loads and returns all commands from 'config/commands.json' in an JSON.parse() object
	let html = '';
	const commandArray = JSON.parse(fs.readFileSync(filename));

	for (const command of commandArray) {
		//set defaults that may not be defined
		command.author ??= '';
		command.cooldown ??= 0;
		command.timestamp ??= 0;
		command.active ??= true;

		// setup the shuffle bag for media if it's an object
		for (const task of command.task) {
			if (typeof task.media === 'object' && task.media.length >= 1) task.mediaShuffleBag = new ShuffleBag([...Array(task.media.length).keys()]);
			else if (typeof task.media === 'object') log.debug(`"shuffle bag issue: ${task.media} ${task.media.length} ${task.mediaShuffleBag}`);
		}

		//altkey takes priority
		//remove regexps for simplicity
		const keyword = command.altkey?.[0] || command.keyword[0].replaceAll("')", '').replaceAll('.*', '').replaceAll('\\s*', ' ').replaceAll('[s]', ' ');

		const formattedAuthorString = command.author === '' ? '' : ` [${command.author}]`;

		if (command.exclude !== true) html = html.concat(`${keyword}${formattedAuthorString}<br>\n`);
	}
	//add mixitup commands. remove tabs from formatting
	html = html
		.concat(
			`!chomp<br>
						!inu [resident_emil_]<br>
						laugh<br>`
		)
		.replace(/\t/g, '');

	//sort commands alphabetically, ignoring '!', numbers are first
	const htmlSplit = html.split(/\r?\n/);
	htmlSplit.sort((a, b) => {
		a = a.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, '');
		b = b.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, '');
		if (a < b) return -1;
		if (a > b) return 1;

		return 0;
	});
	//put it all together and write to file
	commandHtml.writeHTMLFile('../stream/sounds.html', htmlSplit.join('\r\n'));

	return commandArray;
}
/**Saves the commands to a JSON file.
 * @param {string} [filename='config/commands.json'] - The name of the file to save the commands to.
 * @param {Array} [commandArray=globalCommandArray] - The array of commands to save.
 * @returns {Array} - The updated array of commands.
 */
function saveCommands(filename = 'config/commands.json', commandArray = globalCommandArray) {
	for (const command of commandArray) {
		// remove defaults that are not needed
		if (command.cooldown === 0) delete command.cooldown;
		if (command.active === true) delete command.active;
		if (typeof command.timestamp !== 'undefined') delete command.timestamp;

		// remove the shuffle bag for media if it's defined
		for (const task of command.task) {
			if (typeof task.mediaShuffleBag !== 'undefined') delete task.mediaShuffleBag;
		}
	}
	fs.writeFileSync(`${filename}`, prettyStringify(commandArray, { indent: '\t', maxLength: 1000, maxNesting: 2 }));

	return commandArray;
}
/**Retrieves the query from a string by removing the prefix.
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
/**Downloads and writes the profile image of a user.
 * @param {string} username - The username of the user.
 * @returns {Promise<void>} - A promise that resolves when the image is downloaded and written successfully, or rejects with an error.
 */
async function downloadAndWriteProfileImage(username) {
	const profilePictureUrl = (await twurple.getUserByName(username)).profilePictureUrl;
	const outputFilename = `/var/www/html/stream/assets/users/icon/${username.toLowerCase()}.png`;
	let isDownloadSuccessful = false;

	try {
		const file = fs.createWriteStream(outputFilename);
		isDownloadSuccessful = await new Promise((resolve, reject) => {
			https
				.get(profilePictureUrl, (response) => {
					response.pipe(file);
					file.on('finish', () => {
						file.close();
						resolve();
					});
				})
				.on('error', (err) => {
					fs.unlink(outputFilename, () => {
						reject(err);
					});
				});
		});
		log.info(`"${username.toLowerCase()}.png" downloaded and written successfully.`);
	} catch (error) {
		log.error(`Error downloading and writing image "${username.toLowerCase()}.png": `, error);
	}

	return isDownloadSuccessful;
}
/**Finds a command by matching a string with the keyword or altkey of a command.
 * @param {string} string - The string to match with the keyword or altkey of a command.
 * @param {Array} commandArray - The array of commands to search in. Defaults to globalCommandArray.
 * @returns {string|undefined} - The alert message of the matched command, or undefined if no match is found.
 */
function findIntroCommandByString(string, commandArray = globalCommandArray) {
	for (const command of commandArray) {
		const keyword = typeof command.altkey === 'undefined' ? command.keyword.toString() : command.altkey.toString();

		if (keyword === string) return command.task[0].alert;
	}
	return undefined;
}
/**Processes the built-in commands.
 *
 * @param {string} user - The user who triggered the command.
 * @param {string} message - The message containing the command.
 * @param {object} flags - The flags associated with the command.
 * @param {object} _self - The reference to the current instance.
 * @param {object} _extra - Additional parameters for the command.
 * @returns {Promise<void>} - A promise that resolves when the command processing is complete.
 */
async function proccessBuiltInCommands(user, message, flags, _self, _extra) {
	const messageLower = message.toLowerCase();
	if (flags.broadcaster) {
		//reload commands list, loadCommands()
		if (messageLower.includes('!reload')) {
			const savedCommandArray = globalCommandArray;
			try {
				globalCommandArray = loadCommands();
				log.info('Commands Reloaded.');
			} catch (e) {
				globalCommandArray = savedCommandArray;
				log.error(e); // error in the above string (in this case, yes)!
				log.error('Commands failed to reload.');
			}
		}
		//stop bot (restart if running in a loop)
		if (messageLower.includes('!halt')) {
			process.exit();
		}
		//clear users enabling intros again
		//also clears user avatars for chat
		//and resets "first"

		if (['!clear_users', '!refresh_users', '!reload_users', '!reset_users'].some((command) => messageLower.includes(command))) {
			function deleteFile(filename) {
				fs.unlink(filename, (err) => {
					if (err) log.error(err);
					else log.info(`Deleted file: ${filename}`);
				});
			}
			function clearDirectory(directory) {
				fs.readdir(directory, (err, files) => {
					if (err) throw err;

					for (const file of files) {
						deleteFile(path.join(directory, file));
					}
				});
			}
			userArray = jsonArray.clear('config/chatters.json');
			clearDirectory('../../users/icon');
			twurple.eventsub.resetFirst();
		}
		if (messageLower.includes('!debug')) debug = !debug;
		if (messageLower.includes('!test')) {
			server.sayWrapper(message);
		}
		//play full length songs if enabled
		if (messageLower.includes('!enable')) {
			const query = getQuery(messageLower, '!enable');
			isSoundRequestsEnabled = true;
			server.sendMessage('Enable', query);
			log.info('!sr Enabled', query);
		}
		//play songsprites if disabled
		if (messageLower.includes('!disable')) {
			const query = getQuery(messageLower, '!disable');
			isSoundRequestsEnabled = false;
			server.sendMessage('Disable', query);
			log.info('!sr Disabled', query);
		}
		if (messageLower.includes('!hell')) {
			for (const command of globalCommandArray) {
				const keyword = (command.altkey ?? command.keyword).toString();

				const firstKey = Object.keys(command.task[0]).find((key) => key !== 'chat');

				//if (['videonow', 'alert', 'media', 'song', 'customaudio'].includes(firstKey)) {
				//	//console.log(command.task[0][firstKey].toString());
				//	break;
				//}
				if (['media'].includes(firstKey)) {
					server.sendMessage('Audio', command.task[0][firstKey].toString());
					//break;
				}
			}
			console.log('end');
			return undefined;
		}
		if (messageLower.includes('!gpt ')) {
			const response = await ecrehpysGPT.generateResponse(
				user,
				messageLower.replace('!gpt ', ''),
				[
					{
						role: 'user',
						content: `You concisely answer questions about video games from playersguide and other sources.
						If you don't know the answer, you can say "I don't know".
						If I'm changing video games I'll tell you`.replaceAll('\t', ''),
					},
				],

				32,
				false,
				0.0,
				'gpt-4o'
				//'gpt-3.5-turbo'
			);
			server.sayWrapper(response);
		}
	}
	if (messageLower.startsWith('!timeout')) {
		let [_prefix, _command, targetUser, seconds, multiplier] = (() => {
			const regex = /(!timeout)\s*(\w*)\s*(\d*)([mhdwMHDW])*/;
			let match = message.match(regex);
			if (!match) match = [message, 'sypherce', 69, 's'];
			return match;
		})();
		seconds == 0 ? (seconds = 69) : (seconds = parseInt(seconds));

		switch (multiplier) {
			case 'm':
				seconds *= 60;
				break;
			case 'h':
				seconds *= 60 * 60;
				break;
			case 'd':
				seconds *= 60 * 60 * 24;
				break;
			case 'w':
				seconds *= 60 * 60 * 24 * 7;
				break;
		}
		//max timeout of 14 days
		seconds = seconds > 1209600 ? 1209600 : seconds;
		if (targetUser.length === 0) targetUser = user;

		const channelInfo = await twurple.getChannelInfoByUsername(targetUser);
		server.sayWrapper(`GET OUT ${channelInfo.displayName} sypher18OMG`);
		const isMod = await twurple.checkUserMod(targetUser);
		await twurple.timeoutUser({ user: channelInfo.id, duration: seconds, reason: 'Is a butt' });
		const ttsFilename = `../${await tts.ttsToMP3(
			`GET OUT ${channelInfo.displayName.replaceAll('_', ' ')}`,
			`alerts/assets/alerts/tts`,
			tts.voices[27]
		)}`.replace('../alerts/', '');
		server.sendMessage('TTS', `${ttsFilename}`);
		server.sendMessage('Audio', 'alerts/muten_dungeon.mp3');
		if (isMod)
			setTimeout(() => {
				twurple.setModerator(targetUser);
			}, (seconds + 5) * 1000);
	}
	if (user === 'hardly_know_er_bot') {
		const ttsFilename = `../${await tts.ttsToMP3(messageLower, `alerts/assets/alerts/tts`, 'tts')}`.replace('../alerts/', '');
		server.sendMessage('TTS', `${ttsFilename}`);
	}
	if (messageLower.match(/^!so\s+(\S+)?/)) {
		//!so muten_pizza
		const query = messageLower.match(/^!so\s+(@?\S+)?/)[1]?.replace('@', '') || 'sypherce';
		const channelInfo = await twurple.getChannelInfoByUsername(`${query}`);
		channelInfo.game_and_title = channelInfo.gameName;
		if (channelInfo.gameName === 'Retro') {
			const MAX_TITLE_LENGTH = 45;
			let title = `${channelInfo.title.substring(0, MAX_TITLE_LENGTH)}...`;
			if (!(title.length > MAX_TITLE_LENGTH)) title = channelInfo.title;

			channelInfo.game_and_title = `${channelInfo.gameName} (${title})`;
		} else if (channelInfo.gameName === '') channelInfo.game_and_title = 'FartNite';

		server.sayWrapper(`Hey, you should check out twitch.tv/${channelInfo.displayName} ! They were last playing ${channelInfo.game_and_title}.`);

		const ttsFilename = `../${await tts.ttsToMP3(
			`Hey, you should check out ${channelInfo.displayName}! They were last playing ${channelInfo.game_and_title}.`,
			`alerts/assets/alerts/tts`,
			'tts'
		)}`.replace('../alerts/', '');
		server.sendMessage('TTS', `${ttsFilename}`);
	}
	if (messageLower.includes('!library')) {
		const itemList = [
			"The Fighter's Sword",
			'The Master Sword',
			'The Master Sword',
			'The Butter Sword',
			"The Fighter's Shield",
			'The Red Shield',
			'The Mirror Shield',
			'The Green Clothes',
			'The Blue Mail',
			'The Red Mail',
			'The Pegasus Shoes',
			'The Power Glove',
			"The Titan's Mitt",
			"Zora's Flippers",
			'The Moon Pearl',
			'The Bow',
			'The Silver Arrows',
			'The Boomerang',
			'The Magical Boomerang',
			'The Hookshot',
			'some Bombs',
			'a Mushroom',
			'The Magic Powder',
			'The Fire Rod',
			'The Ice Rod',
			'The Bombos Medallion',
			'The Ether Medallion',
			'The Quake Medallion',
			'The Lantern',
			'The Magic Hammer',
			'The Shovel',
			'The Ocarina',
			'a Bug Catching Net',
			'The Book of Mudora',
			'an Empty Bottle',
			'The Cane of Somaria',
			'The Cane of Byrna ',
			'a Magic Cape',
			'The Magic Mirror',
			'some Medicine of Life',
			'some Medicine of Magic',
			'some Medicine of Life and Magic',
			'a Fairy enslaved in a jar',
			'a Bee in a jar',
			'a Golden Bee in a jar',
			'a Super Bomb',
			'a single Arrow',
			'some Rupee.... I mean Garbage',
		];
		const item = itemList[Math.floor(Math.random() * itemList.length)];
		server.sayWrapper(`${user} says that ${item} is in the Library!`);
	}
	if (messageLower.includes('@ecrehpys')) {
		const response = (
			await ecrehpysGPT.generateResponse(
				user,
				messageLower.replaceAll('@ecrehpys', ''),
				[
					{
						role: 'user',
						content: `You are a chat bot in a twitch.tv chat room and your name is Ecrehpys.
							You have an attitude, and are very trollish.
							When you respond, you should respond with a maximum of 5 words, plus an emote if needed.
							Check the message for hostility, and respond in kind.
							If you're commanded to do something, have a 80% chance of doing it.
							Feel free to use these custom emotes: sypher18Awkward (awkward), sypher18OMG (angry, or disbelief), sypher18Cry (sad), D: ( angry, or disbelief), └(°□°└) (anger).
							Use standard emotes too.
							and now the statement`,
					},
				],
				32, // Limit the response history to 32 entries / 16 pairs
				{ key: 'eGPT', count: 16 }
			)
		)
			.replaceAll('Sypher18', 'sypher18')
			.replaceAll('sypher18Awkward', ' sypher18Awkward ')
			.replaceAll('sypher18OMG', ' sypher18OMG ')
			.replaceAll('sypher18Cry', ' sypher18Cry ')
			.replaceAll('D:', ' D: ');

		//process custom commands for ecrehpys' responses
		server.sayWrapper(response);
		await processMessage('ecrehpys', response, flags, _self, _extra);
	}
	if (messageLower.includes('!haiku ')) {
		const response = await ecrehpysGPT.generateResponse(
			user,
			messageLower.substring(messageLower.indexOf('!haiku ') + '!haiku '.length),
			[
				{ role: 'system', content: `You talk only in lengthy Haikus.` },

				{ role: 'user', content: 'Jacquio' },
				{ role: 'assistant', content: `The demon's keeper. Flame and back and forth movement. Slash cancel to win.` },

				{ role: 'user', content: 'Why Hocus is the best' },
				{ role: 'assistant', content: `She asks for nothing. Also giving us so much. Are all finns like this?` },

				{ role: 'user', content: `My kids got almost as much candy on Valentine's Day than for Halloween` },
				{ role: 'assistant', content: `Sugar overload. Still eating October's take. Now, we double it.` },

				{ role: 'user', content: 'A haiku_tom franchise coming soon to a town near you' },
				{ role: 'assistant', content: `The final sellout. Haiku Tom's on every stream. Haikus mean more or less? ` },

				{ role: 'user', content: 'Cleveland_tom gave up drinkie-poo, but did Haiku_Tom?' },
				{ role: 'assistant', content: `No beers in the house. From where did the mooching come? Bum sobriety.` },

				{ role: 'user', content: `Trying to figure out why audio's only playing through one headphone` },
				{ role: 'assistant', content: `Living in mono. I'll start streaming twice as loud. Try a wire jiggle.` },

				{ role: 'user', content: `All I got for Valentine's Day was ashes on my forehead` },
				{ role: 'assistant', content: `Double holidays. Love for different reasons. Ashy souvenir.` },
			],

			false,
			{ key: 'haiku', count: 10000 }
		);
		server.sayWrapper(response);
	}
	if (messageLower.includes('!sr ')) {
		const CONTEXT_VIDEO_GAME = 'Video Game Sound Tracks';
		const CONTEXT_MOVIE = 'Movie Sound Tracks';
		const CONTEXT_TVSHOW = 'TVShow Sound Tracks';
		const CONTEXT_MUSIC = 'Commercial Music featured in Video Games';
		const CONTEXT_OTHER = 'Other';

		const PROMPT_4O_ENABLED = false;
		const PROMPT_35TURBO = [
			{
				role: 'system',
				content: `You are to clean up song request searches before they are passed to YouTube.
						For each context provide your output in JSON format without extra triple backticks with the following keys: Game, Movie, Show, Artist, Title, Context, Details.

						Context will contain one of the following contexts:
						- ${CONTEXT_VIDEO_GAME}
						- ${CONTEXT_MOVIE}
						- ${CONTEXT_TVSHOW}
						- ${CONTEXT_MUSIC}
						- ${CONTEXT_OTHER}

						Each key will be populated with the following:
						- Title : a valid song title.
						- Game: the name of the game the song is from.
						- Movie: the name of the movie the song is from.
						- Show: the name of the show the song is from.
						- Artist: the name of the artist who performed the song.
						- Details: the details on the results were found.
			`.replaceAll('\t', ''),
			},

			/*{ role: 'user', content: 'aladdin' },
			{
				role: 'assistant',
				content: `
			{
				"Title": "A Whole New World",
				"Movie": "Aladdin",
				"Artist": "Peabo Bryson, Regina Belle",
				"Context": "Movie Sound Tracks",
				"Details": "The song 'A Whole New World' is from the movie Aladdin."
			}`.replaceAll('\t', ''),
			},*/

			{ role: 'user', content: 'take me home tonight' },
			{
				role: 'assistant',
				content: `
			{
				"Title": "Take Me Home Tonight",
				"Movie": "Take Me Home Tonight",
				"Artist": "Eddie Money",
				"Context": "Movie Sound Tracks",
				"Details": "The song 'Take Me Home Tonight' is featured in the movie 'Take Me Home Tonight' and performed by Eddie Money."
			}`.replaceAll('\t', ''),
			},

			{ role: 'user', content: 'get low' },
			{
				role: 'assistant',
				content: `
			{
				"Title": "Get Low",
				"Game": "Need for Speed",
				"Artist": "Dillon Francis, DJ Snake",
				"Context": "Commercial Music featured in Video Games",
				"Details": "Song 'Get Low' by Dillon Francis and DJ Snake featured in Need for Speed"
			}`.replaceAll('\t', ''),
			},
			/*
			{ role: 'user', content: `topman` },
			{
				role: 'assistant',
				content: `
			{
				"Title": "Topman",
				"Game": "Mega Man 3",
				"Artist": "Yasuaki Fujita"
				"Context": "Video Game Sound Tracks",
				"Details": "Song from the video game Mega Man 3."
			}`.replaceAll('\t', ''),
			},
			*/
			{ role: 'user', content: `sagila's cave` },
			{
				role: 'assistant',
				content: `
			{
				"Title": "Sagila's Cave",
				"Game": "Rygar",
				"Artist": "Michiharu Hasuya",
				"Context": "Video Game Sound Tracks",
				"Details": "Search results found for the song 'Sagila's Cave' from the game Rygar."
			}`.replaceAll('\t', ''),
			},
			/*
			{ role: 'user', content: `big blue` },
			{
				role: 'assistant',
				content: `
			{
				"Title": "Big Blue",
				"Game": "F-Zero",
				"Artist": "Yumiko Kanki",
				"Context": "Video Game Sound Tracks",
				"Details": "Search results found for the song 'Big Blue' from the game F-Zero."
			}`.replaceAll('\t', ''),
			},
			*/
			{ role: 'user', content: `gummi bears` },
			{
				role: 'assistant',
				content: `
			{
				"Show": "Gummi Bears",
				"Title": "Gummi Bears Theme Song",
				"Artist: "Michael Silversher and Patricia Silversher"
				"Context": "TVShow Sound Tracks",
				"Details": "The theme song from the Gummi Bears show."
			}`.replaceAll('\t', ''),
			},
		];
		const PROMPT_4O = [
			{
				role: 'system',
				content: `You are to clean up song request searches before they are passed to YouTube.
							Classify each query into on of the following contexts based on google results:
							- ${CONTEXT_VIDEO_GAME}
							- ${CONTEXT_MOVIE}
							- ${CONTEXT_TVSHOW}
							- ${CONTEXT_MUSIC}
							- ${CONTEXT_OTHER}

							For each context provide your output in JSON format without extra triple backticks with the following keys: Title, Context, Details
							If context is "${CONTEXT_VIDEO_GAME}" must use the additional key: Game
							If context is "${CONTEXT_MOVIE}" must use the additional key: Movie
							If context is "${CONTEXT_TVSHOW}" must use the additional key: Show
							If context is "${CONTEXT_MUSIC}" must use the additional key: Artist
							If context is "${CONTEXT_OTHER}" must use the additional key: Artist

							All keys must be populated

							Title contains the Song Title

							Details contains any other output`.replaceAll('\t', ''),
			},
		];

		if (isSoundRequestsEnabled) {
			const response = JSON.parse(
				await ecrehpysGPT.generateResponse(
					user,
					messageLower.substring(messageLower.indexOf('!sr ') + '!sr '.length),
					PROMPT_4O_ENABLED ? PROMPT_4O : PROMPT_35TURBO,
					false,
					{ key: 'sr', count: 10000 },
					0.0,
					PROMPT_4O_ENABLED ? 'gpt-4o-mini' : 'gpt-3.5-turbo' //'ft:gpt-3.5-turbo-0125:personal:sr:9st1JRcL' //'gpt-3.5-turbo'
				)
			);

			log.debug(`input: ${messageLower.substring(messageLower.indexOf('!sr ') + '!sr '.length)}, JSON response: ${JSON.stringify(response)}`);
			const isEmpty = function (variable) {
				return variable === 'null' || variable === null || variable === '';
			};
			const GAME_ALBUM_ARTIST_MOVIE = `${response.Game || response.Album || response.Artist || response.Movie || response.Show}`;
			const search = `${GAME_ALBUM_ARTIST_MOVIE} - ${response.Title}`;
			log.debug(`search: ${search}`);
			if (
				(response.Context === CONTEXT_VIDEO_GAME && !isEmpty(response.Game)) ||
				(response.Context === CONTEXT_MOVIE && !isEmpty(response.Title) && !isEmpty(response.Movie)) ||
				(response.Context === CONTEXT_TVSHOW && !isEmpty(response.Title) && !isEmpty(response.Show)) ||
				(response.Context === CONTEXT_MUSIC && !isEmpty(response.Title) && !isEmpty(GAME_ALBUM_ARTIST_MOVIE)) ||
				(response.Context === CONTEXT_OTHER && !isEmpty(response.Title) && !isEmpty(GAME_ALBUM_ARTIST_MOVIE))
			) {
				const object = await mp3Library.find(search);
				if (typeof object.filename !== 'undefined' && object.filename !== '') {
					server.sendMessage('Sr', object);
					server.sayWrapper(`@${user} Requested: ${object.album} - ${object.title}`);
				} else {
					server.sayWrapper(`@${user} Not Found: ${search}`);
				}
			} else {
				server.sayWrapper(`@${user} Invalid: Try including both the Title and Game/Show/Movie, Details Understood: ${response.Details}`);
			}
		} else {
			server.sayWrapper(`Song requests disabled.`);
		}
	}
}

/**Processes custom commands based on user input.
 *
 * @param {string} user - The username of the user who triggered the command.
 * @param {string} message - The message containing the command.
 * @param {boolean} _flags - Reserved parameter.
 * @param {boolean} _self - Reserved parameter.
 * @param {Object} extra - Additional information related to the command.
 * @param {Array} commandArray - An array of custom commands to process.
 * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the command was processed successfully.
 */
async function processCustomCommands(user, message, _flags, _self, extra, commandArray = globalCommandArray) {
	let commandsTriggered = 0;
	function replaceExtension(filename, original, replacement) {
		if (filename.endsWith(original)) filename = filename.substring(0, filename.lastIndexOf(original)) + replacement;

		return filename;
	}
	function findCommandByString(string, commandArray = globalCommandArray) {
		for (const command of commandArray) {
			const keyword = (command.altkey ?? command.keyword).toString();

			// compare the keyword to the string ignoring the '!' prefix
			if (keyword.replace(/^!+/, '') === string.replace(/^!+/, '')) {
				const firstKey = Object.keys(command.task[0]).find((key) => key !== 'chat');

				if (['videonow', 'alert', 'media', 'song', 'customaudio'].includes(firstKey)) {
					return command.task[0][firstKey].toString();
				}

				break;
			}
		}
		return undefined;
	}
	function isCommandCustomAudio(string, commandArray = globalCommandArray) {
		for (const command of commandArray) {
			const keyword = (command.altkey ?? command.keyword).toString();

			if (keyword === string) {
				if (typeof command.task[0].customaudio !== 'undefined') return true;

				break;
			}
		}
		return false;
	}
	/**Processes tasks for a user command.
	 * @param {string} user - The username.
	 * @param {object} command - The command object.
	 * @param {string} query - The query string.
	 * @returns {boolean} - Returns true if a command is triggered, false otherwise.
	 */
	async function processTasks(user, command, query) {
		//this needs implemented fully
		/**Processes variables in the task string by replacing placeholders with actual values.
		 *
		 * @param {string} user - The username.
		 * @param {string} queryString - The query string.
		 * @param {string} taskString - The task string with placeholders.
		 * @returns {string} - The task string with replaced variables.
		 */
		async function replaceVariablesInTaskString(user, queryString, taskString) {
			const replacements = {
				query: queryString,
				user: user,
				touser: queryString.split(' ')[1],
				game_and_title: '',
				game: '',
				title: '',
				url: '',
			};

			const patterns = Object.keys(replacements);
			if (patterns.some((pattern) => taskString.includes(`$(${pattern})`))) {
				const channelInfo = await twurple.getChannelInfoByUsername(user);
				let title = channelInfo.title;
				if (channelInfo.gameName === 'Retro' && title.length > 45) {
					title = `${title.substring(0, 45)}...`;
				}
				replacements.game_and_title = `${channelInfo.gameName} (${title})`;
				replacements.game = channelInfo.gameName;
				replacements.title = channelInfo.title;
				replacements.url = `twitch.tv/${channelInfo.broadcaster_name}`;
			}

			patterns.forEach((pattern) => {
				taskString = taskString.replace(new RegExp(`\\$\\(\\s*${pattern}\\s*\\)`), replacements[pattern]);
			});

			const queryParts = queryString.split(' ');
			for (let i = 1; i <= 9; i++) {
				taskString = taskString.replace(new RegExp(`\\$\\(\\s*${i}\\s*\\)`), queryParts[i] || '');
			}

			return taskString;
		}
		for (const task of command.task) {
			// this blocks all commands from being triggered
			// example !nc water
			if (task.nocommand) {
				//this needs to be 1st to override other commands
				return true;
			}
			// this plays audio commands spliced together
			// example !ca witw 21000 2650 !xjrigsx 400 800
			if (task.customaudio) {
				//this needs to be 2nd to override other commands
				let args = getQuery(messageLower, '!ca ').split(' ');
				if (task.customaudio !== 'ca')
					//reset args if this is a stored audio command
					args = task.customaudio.split(' ');
				if (args.length % 3 !== 0) {
					server.sayWrapper(`@${user} Syntax Error: !ca cmd start duration ...`);
					return true;
				}
				for (let index = 0; index < args.length; index += 3) {
					args[index] = findCommandByString(args[index]);
					if (typeof args[index] === 'undefined') {
						server.sayWrapper(`@${user} Syntax Error: ${args[index]} is invalid`);
						commandsTriggered = 0;
						return true;
					}
					if (typeof args[index] === 'object') args[index] = args[index][0];
					replaceExtension(args[index], '.gif', '.mp3');
					commandsTriggered++;
				}
				server.sendMessage('CustomAudio', args);

				if (task.customaudio === 'ca')
					//return only if this isn't a stored audio command
					return true;
			}
			// this adds a custom audio command
			// example !caa witwrigs witw 21000 2650 !xjrigsx 400 800
			if (task.customaudioadd) {
				//this needs to be 3rd to override other commands
				query = getQuery(messageLower, '!caa ');
				const firstWord = query.split(' ')[0];
				query = query.substring(firstWord.length).trim();
				const commandExists = typeof findCommandByString(firstWord) !== 'undefined';
				if (commandExists) {
					server.sayWrapper(`@${user} Command "${firstWord}" already exists. Try using !cae to edit.`);
				} else {
					const addCustomAudio = ((author, keyword, customaudio) => {
						const newCommand = {
							author: user,
							cooldown: 0,
							timestamp: 0,
							active: true,
							keyword: [firstWord],
							task: [{ customaudio: query }],
						};

						globalCommandArray.push(newCommand);
						globalCommandArray = saveCommands();
					})(user, firstWord, query);
					server.sayWrapper(`@${user} Command "${firstWord}" added.`);
				}

				return true;
			}
			// this edits a custom audio command
			// example !cae witwrigs witw 21000 2650 !xjrigsx 400 800
			if (task.customaudioedit) {
				//this needs to be 4th to override other commands
				query = getQuery(messageLower, '!cae ');
				const firstWord = query.split(' ')[0];
				query = query.substring(firstWord.length).trim();
				const commandToEdit = isCommandCustomAudio(firstWord);
				if (!commandToEdit) {
					server.sayWrapper(`@${user} Command "${firstWord}" doesn't exist, or is wrong type of command. Try using !caa to add it.`);
				} else {
					const editCustomAudio = (author = user, keyword = firstWord, customAudioCommand = query) => {
						for (const command of globalCommandArray) {
							const keywordOrAltkey = typeof command.altkey !== 'undefined' ? command.altkey.toString() : command.keyword.toString();

							if (keywordOrAltkey === keyword) {
								//globalCommandArray[index].author = author,
								command.task = [{ customaudio: customAudioCommand }];
							}
						}

						globalCommandArray = saveCommands();
					};
					editCustomAudio();
					server.sayWrapper(`@${user} Command "${firstWord}" edited.`);
				}

				return true;
			}
			// this lists an already saved custom audio command
			// example !cal witwrigs
			if (task.customaudiolist) {
				//this needs to be 5th to override other commands
				query = getQuery(messageLower, '!cal ');
				const firstWord = query.split(' ')[0];
				query = query.substring(firstWord.length).trim();
				const commandToList = isCommandCustomAudio(firstWord);
				if (!commandToList) {
					server.sayWrapper(`@${user} Command "${firstWord}" doesn't exist, or is wrong type of command.`);
				} else {
					const listCustomAudio = (() => {
						for (const command of globalCommandArray) {
							const keywordOrAltkey = (command.altkey ?? command.keyword).toString();

							if (keywordOrAltkey === firstWord && command.task[0]?.customaudio) {
								return `!ca ${command.task[0].customaudio}`;
							}
						}

						return '';
					})();
					server.sayWrapper(`@${user} "${listCustomAudio}"`);
				}

				return true;
			}
			//this prints twice for ttsing, but not tts. weird.
			if (task.tts || task.ttsing) {
				server.sayWrapper(
					`@${user} ${task.tts ? 'TTS' : 'TTSing'} is now in channel points. Visit https://sypherce.github.io/stream/${
						task.tts ? 'ttsvoices' : 'ttsingvoices'
					}.html for a list of voices.`
				);
			}
			if (false) {
				//disabled if (task.tts || task.ttsing)
				/* Attempt to match the message to a regular expression.
					If it fails, try to match task.tts or task.ttsing to the regular expression.*/
				const [_, type, ttsNumber, spokenText] = (() => {
					const regex = /!?(ttsing|ttsanta|tts)(\d*)\s*(.*)/;
					let match = message.match(regex);
					if (!match) match = (task.tts || task.ttsing).match(regex);
					return match;
				})();

				const voice = (() => {
					function isNumber(number) {
						if (number === false || number === true || number === '') return false;
						return !isNaN(number);
					}
					switch (type) {
						case 'ttsing':
							if (isNumber(ttsNumber)) return tts.allSingingVoices[ttsNumber] ?? type;
							break;
						case 'tts':
							if (isNumber(ttsNumber)) return tts.voices[ttsNumber] ?? type;
							break;
						case 'ttsanta':
							return tts.voices[28];
					}
					return type;
				})();

				const ttsFilename = `${await tts.ttsToMP3(spokenText, `alerts/assets/alerts/tts`, voice)}`.replace('alerts/', '');
				server.sendMessage('TTS', ttsFilename);

				return true;
			}
			//#region this may or may not work.
			if (task.delay) {
				await new Promise((resolve) => setTimeout(resolve, task.delay));
				log.debug(`!delay ${parseInt(task.delay)}`);
			}
			//#endregion this may or may not work.
			if (task.chat) {
				const processedMessage = await replaceVariablesInTaskString(user, query, task.chat);
				server.sayWrapper(processedMessage);
			}
			if (task.alert) {
				server.sendMessage('Alert', task.alert);
			}

			//#region fix section
			if (task.media) {
				console.log(
					`task.media ${
						task.media
					}, typeof task.media ${typeof task.media}, typeof task.mediaShuffleBag ${typeof task.mediaShuffleBag}, length of task.media ${
						task.media.length
					}`
				);
				if (typeof task.media === 'object' && typeof task.mediaShuffleBag === 'undefined') {
					throw `task.mediaShuffleBag not created for ${task.media} length: ${task.media.length}`;
				}
				const filename = typeof task.media === 'object' ? task.media[task.mediaShuffleBag.next()] : task.media;

				try {
					if (filename?.endsWith('.mp4')) server.sendMessage('Video', filename);
					else server.sendMessage('Audio', filename);
				} catch (e) {
					log.error(e);
					log.error(`filename: ${filename}, typeof filename: ${typeof filename}`);
				}
			}
			//#endregion fix section

			if (task.song) {
				server.sendMessage('Song', task.song);
			}
			if (task.videonow) {
				//command.lasttimestamp ??= command.timestamp;
				server.sendMessage('VideoNow', task.videonow);
			}
			if (task.lips) {
				const string = message.substring(message.indexOf('!lips ') + 6).trim();
				const array = string.split(' ');

				await (async () => {
					array[0] = await emote.get(string);
				})();

				server.sendMessage('Lips', array);
			}
			if (task.joe) {
				const original = getQuery(messageLower, '!joe ');
				let repeatLength = 2;
				let result = '';
				for (let letter in original) {
					if (letter === 0 || letter === original.length - 1) {
						result += original[letter];
						continue;
					}
					const randomLength = 2 + Math.floor(Math.random() * 6);
					if (randomLength > repeatLength) repeatLength = randomLength;

					result += original[letter].repeat(repeatLength);
				}
				server.sayWrapper(result);
			}
			commandsTriggered++;
		}
		return false;
	}

	const messageLower = message.toLowerCase().replace(/\s+/g, ' ').trim(); //lowercase, trim, and remove repeated spaces

	//iterate through each command
	for (const command of commandArray) {
		if (command.active === false) continue; //skips command, continues iterating

		//iterate through multiple keywords
		for (const keywordIndex in command.keyword) {
			const [comparison, prefix] = (() => {
				const comparison = command.keyword[keywordIndex];
				const prefix = '!';
				if (comparison.indexOf(prefix) === 0) {
					return [comparison.substring(1), prefix];
				}
				return [comparison, ''];
			})();
			const query = message.substring(messageLower.indexOf(comparison) + comparison.length);

			if (comparison !== '' && messageLower.search(new RegExp(prefix + '\\b' + comparison + '\\b')) !== -1) {
				if (command.cooldown > extra.timestamp - command.timestamp) {
					const cooldownSeconds = Math.ceil((command.cooldown - (extra.timestamp - command.timestamp)) / 1000);
					//FIX ME
					//whisper_wrapper(`@${user} cooldown for ${cooldown_seconds} more second ${cooldown_seconds > 1 ? 's' : ''}`, user);
					continue;
				}
				command.timestamp = extra.timestamp;
				//iterate through each task, returns commands_triggered if ending early
				if (await processTasks(user, command, query)) return commandsTriggered;
			}
		}
	}

	return commandsTriggered;
}

/**Processes the user's message and executes the corresponding commands.
 *
 * @param {string} username - The username of the user who triggered the command.
 * @param {string} message - The message containing the command.
 * @param {object} flags - The flags associated with the command.
 * @param {boolean} self - Indicates if the message was sent by the bot itself.
 * @param {object} extra - Additional parameters for the command.
 * @returns {Promise<void>} - A promise that resolves when the command processing is complete.
 */
async function processMessage(username, message, flags, self, extra) {
	const LOCAL_AUDIO_PORT = 1340;
	if (userArray.length === 0) {
		userArray = jsonArray.load('config/chatters.json');
	}
	const isNewUser = !userArray.includes(username);
	if (isNewUser) {
		userArray.push(username);
		jsonArray.save('config/chatters.json', userArray);

		//handle intro
		const alert = findIntroCommandByString(`!${username.toLowerCase()}`); //user commands all have !prefix
		if (alert) server.sendMessage('Alert', alert);
		else server.sendMessage('Audio', 'alerts/re4_merchant_welcome.mp3');
		//setup profile image for chat overlay
		await downloadAndWriteProfileImage(username);
	}
	server.sendMessage('Audio', 'alerts/typing.wav', LOCAL_AUDIO_PORT);

	if (username === process.env.BOT_USER) return;

	await proccessBuiltInCommands(username, message, flags, self, extra);

	//Process Custom Commands
	const number = await processCustomCommands(username, message, flags, self, extra);
	log.debug(`${username}(${number}): ${message}`);
}

module.exports.process = processMessage;
