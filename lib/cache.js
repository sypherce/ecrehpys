'use strict';

/**The cached data array.
 * @type {Array}
 */
let cachedData = {};

/**The size of the storage.
 * @type {number}
 */
let storageSize = {};

/**Initializes the cache with the provided key, count, and array.
 * @param {string} key - The key for the cached data.
 * @param {number} [count=5] - The maximum number of items to store in the cache.
 * @param {Array} [array=[]] - The initial array of data to be stored in the cache.
 */
function init(key, count = 5, array = []) {
	cachedData[key] = array;
	storageSize[key] = count;
}

/**Checks if the specified key is initialized in the cache.
 * @param {string} key - The key to check.
 * @returns {boolean} - True if the key is initialized, false otherwise.
 */
function isInit(key) {
	return cachedData[key];
}

/**Removes the cached data associated with the given key.
 *
 * @param {string} key - The key of the data to be removed from the cache.
 */
function deInit(key) {
	delete cachedData[key];
}

/**Retrieves the cached output for a given input.
 * @param {string} key - The key for the cached data.
 * @param {*} input - The input value.
 * @returns {*} The cached output if found within the storage length, otherwise undefined.
 */
function get(key, input) {
	const matchingCachedResponse = cachedData[key].find((cachedResponse) => cachedResponse.input === input);
	if (matchingCachedResponse) {
		return matchingCachedResponse.output;
	}

	return undefined;
}

/**Stores the output for a given input in the cache.
 * @param {string} key - The key for the cached data.
 * @param {*} input - The input value.
 * @param {*} output - The output value to be cached.
 */
function put(key, input, output) {
	const timeNow = Number(new Date());
	const cachedResponseData = { input: input, output: output };

	// Remove any existing cached response for this input
	cachedData[key] = cachedData[key].filter((cachedResponse) => {
		return cachedResponse.input !== input;
	});

	// Add the new cached response
	cachedData[key].push(cachedResponseData);
	while (cachedData[key].length > storageSize[key]) {
		cachedData[key].shift();
	}
}
function getAll(key) {
	return cachedData[key];
}

module.exports.init = init;
module.exports.isInit = isInit;
module.exports.deInit = deInit;
module.exports.get = get;
module.exports.put = put;
module.exports.getAll = getAll;
