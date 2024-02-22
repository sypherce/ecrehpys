'use strict';

/**The cached data array.
 * @type {Array}
 */
let cachedData = [];

/**The storage length in milliseconds.
 * @type {number}
 */
let storageLength = 1000 * 60 * 60 * 24 * 7;

/**Initializes the cache with optional length and array.
 * @param {number} [length=1000 * 60 * 60 * 24 * 7] - The storage length in milliseconds.
 * @param {Array} [array=[]] - The initial cached data array.
 */
function init(length = 1000 * 60 * 60 * 24 * 7, array = []) {
	cachedData = array;
	storageLength = length;
}

/**Retrieves the cached output for a given input.
 * @param {*} input - The input value.
 * @returns {*} The cached output if found within the storage length, otherwise undefined.
 */
function get(input) {
	const matchingCachedResponse = cachedData.find((cachedResponse) => cachedResponse.input === input);
	if (matchingCachedResponse) {
		const timeNow = Number(new Date());
		if (matchingCachedResponse.age > timeNow - storageLength) {
			// If the cached response is less than ${storageLength}, return it
			return matchingCachedResponse.output;
		} else {
			// Otherwise, remove the cached response
			cachedData = cachedData.filter((cachedResponse) => {
				return cachedResponse.input !== input;
			});
		}
	}

	return undefined;
}

/**Stores the output for a given input in the cache.
 * @param {*} input - The input value.
 * @param {*} output - The output value to be cached.
 */
function put(input, output) {
	const timeNow = Number(new Date());
	const cachedResponseData = { input: input, output: output, age: timeNow };

	// Remove any existing cached response for this input
	cachedData = cachedData.filter((cachedResponse) => {
		return cachedResponse.input !== input;
	});

	// Add the new cached response
	cachedData.push(cachedResponseData);
}
function getAll() {
	return cachedData;
}

module.exports.init = init;
module.exports.get = get;
module.exports.put = put;
module.exports.getAll = getAll;
