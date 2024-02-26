'use strict';
require('dotenv').config();

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const jsonArray = require('./jsonArray.js');
const cache = require('./cache.js');
const responseHistoryArray = {};

/**Generates a response for a chat bot in a Twitch.tv chat room.
 * The response is generated using the OpenAI GPT-3.5 Turbo model.
 *
 * @param {string} user - The username of the user making the request.
 * @param {string} userInput - The input message from the user.
 * @param {string} [header=DEFAULT_HEADER] - The header to be included in the message.
 * @returns {Promise<string>} - The generated response from the chat bot.
 */
async function generateResponse(user, userInput, header, trackHistory, cacheInput) {
	function updateResponseHistory(username, input, output) {
		if (!trackHistory) return;

		// Check if responseHistoryArray[username] exists
		if (!responseHistoryArray[user]) responseHistoryArray[user] = [];
		// Push response to responseHistoryArray[user]
		responseHistoryArray[user].push({ role: 'user', content: userInput }, { role: 'assistant', content: response });
		// use while instead of if because we can multiple entries at a time
		while (responseHistoryArray[user].length > trackHistory) responseHistoryArray[user].shift();
	}
	const strippedInput = userInput.toLowerCase().replace(/[^a-z0-9.,!]/g, '');

	// Check the cache first
	let response = (() => {
		let thisResponse = false;
		if (cacheInput?.key) {
			if (!cache.isInit(cacheInput.key)) {
				let loadedCachedResponses = jsonArray.load(`config/cachedResponses.${cacheInput.key}.json`);
				cache.init(cacheInput.key, cacheInput.count, loadedCachedResponses);
			}
			thisResponse = cache.get(cacheInput.key, strippedInput);
		}
		return thisResponse;
	})();

	// Push response to responseHistoryArray[user]
	if (response) {
		updateResponseHistory(user, userInput, response);

		return response;
	}

	// If the response is not in the cache, generate a new one
	const messageArray = [...header, ...(responseHistoryArray[user] || []), { role: 'user', content: `${userInput}` }];
	const completion = await openai.chat.completions.create({
		model: 'gpt-3.5-turbo',
		messages: messageArray,
	});
	response = completion.choices[0]?.message?.content.replace(/\n/g, ' ');

	// Update the response history
	updateResponseHistory(user, userInput, response);

	if (cacheInput?.key) {
		// Return if the cache isn't initialized
		if (!cache.isInit(cacheInput.key)) return;

		// Save the response to the cache
		cache.put(cacheInput.key, strippedInput, response);

		// Save the cache to disk
		jsonArray.save(`config/cachedResponses.${cacheInput.key}.json`, cache.getAll(cacheInput.key));
	}

	// Return the response
	return response;
}

module.exports.generateResponse = generateResponse;
