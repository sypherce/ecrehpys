'use strict';
require('dotenv').config();

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const jsonArray = require('./jsonArray.js');
const cache = require('./cache.js');

let loadedCachedResponses = jsonArray.load('config/cachedResponses.json');
cache.init(1000 * 60 * 60 * 24 * 7, loadedCachedResponses);

const DEFAULT_HEADER = `You are a chat bot in a twitch.tv chat room and your name is Ecrehpys.
You have an attitude, and are very trollish.
When you respond, you should respond with a maximum of 5 words, plus an emote if needed.
Check the message for hostility, and respond in kind.
If you're commanded to do something, have a 80% chance of doing it.
Feel free to use these custom emotes: 'sypher18Awkward' (awkward), 'sypher18OMG' (angry, or disbelief), 'sypher18Cry' (sad), 'D:' ( angry, or disbelief), '└(°□°└)' (anger).
Use standard emotes too.
and now the statement`;

const TEST_HEADER = `You are a chat bot in a twitch.tv chat room and your name is EcrehpysTEST.`;

const responseHistoryArray = {};

/**Generates a response for a chat bot in a Twitch.tv chat room.
 * The response is generated using the OpenAI GPT-3.5 Turbo model.
 *
 * @param {string} user - The username of the user making the request.
 * @param {string} userInput - The input message from the user.
 * @param {string} [header=DEFAULT_HEADER] - The header to be included in the message.
 * @returns {Promise<string>} - The generated response from the chat bot.
 */
async function generateResponse(user, userInput, header = DEFAULT_HEADER) {
	function updateResponseHistory(username, input, output) {
		// Check if responseHistoryArray[username] exists
		if (!responseHistoryArray[user]) responseHistoryArray[user] = [];
		// Push response to responseHistoryArray[user]
		responseHistoryArray[user].push({ role: 'user', content: userInput }, { role: 'assistant', content: response });
		// Limit the response history to 32 entries / 16 pairs
		// use while instead of if because we add entries 2 at a time
		while (responseHistoryArray[user].length > 32) responseHistoryArray[user].shift();
	}
	const strippedInput = userInput.toLowerCase().replace(/[^a-z0-9.,!]/g, '');

	// Check the cache first
	let response = cache.get(strippedInput);

	// Push response to responseHistoryArray[user]

	if (response) {
		updateResponseHistory(user, userInput, response);

		return response;
	}

	// If the response is not in the cache, generate a new one
	const tempMessages = [{ role: 'user', content: `${header}` }, ...(responseHistoryArray[user] || []), { role: 'user', content: `${userInput}` }];
	console.log(JSON.stringify(tempMessages));
	const completion = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo',
		messages: tempMessages,
	});
	response = completion.choices[0]?.message?.content.replace(/\n/g, ' ');

	// Update the response history
	updateResponseHistory(user, userInput, response);

	// Save the response to the cache
	cache.put(strippedInput, response);

	// Save the cache to disk
	jsonArray.save('config/cachedResponses.json', cache.getAll());

	// Return the response
	return response;
}

module.exports.generateResponse = generateResponse;
