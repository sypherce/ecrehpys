const crypto = require('crypto');

function generateMD5(data) {
	if (typeof data !== 'string') {
		throw new TypeError('Expected a string');
	}

	return crypto.createHash('md5').update(data).digest('hex');
}

module.exports.generateMD5 = generateMD5;
