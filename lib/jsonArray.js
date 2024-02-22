const fs = require('fs');
const prettyStringify = require('@aitodotai/json-stringify-pretty-compact');

/**Loads a JSON array from a file.
 *
 * @param {string} jsonFile - The path to the JSON file.
 * @returns {Array} - The parsed JSON array, or an empty array if an error occurs.
 */
function loadJsonArray(jsonFile) {
	try {
		return JSON.parse(fs.readFileSync(jsonFile));
	} catch (e) {
		console.error(e); // error in the above string (in this case, yes)!
		return [];
	}
}
/**Saves a JSON array to a file.
 *
 * @param {string} jsonFile - The path of the JSON file to save.
 * @param {Array} array - The JSON array to save.
 * @returns {void}
 */
function saveJsonArray(jsonFile, array) {
	fs.writeFileSync(jsonFile, prettyStringify(array, { indent: '\t', maxLength: 1000, maxNesting: 2 }));
}

function clearJsonArray(jsonFile) {
	fs.writeFileSync(jsonFile, '[]');
	return [];
}

module.exports.load = loadJsonArray;
module.exports.save = saveJsonArray;
module.exports.clear = clearJsonArray;
