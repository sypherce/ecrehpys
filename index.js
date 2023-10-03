'use strict';
require('dotenv').config();
const server = require('./server.js');
const mp3Library = require('./mp3Library.js');
const log = require('esm')(module)('./alerts/log.js').log;
const enable_livesplit = false;//needs enabled
const livesplit_main = (enable_livesplit)
	? require('./livesplit_main.js') :
	'';

async function processLivesplit() {
	let splitIndex = livesplit_main.getSplitIndex();
	if(typeof processLivesplit.last_splitindex === 'undefined' |
		splitIndex !== processLivesplit.last_splitindex) {
		processLivesplit.last_splitindex = splitIndex;

		server.sendMessage('SplitSong', `livesplit/${livesplit_main.getTrack(splitIndex)}`);
		log('debug', splitIndex);
	}
	setTimeout(processLivesplit, 500);
}

const myArgs = process.argv.slice(2);
let force_refresh = false;
switch (myArgs[0]) {
case '-refresh':
	force_refresh = true;
	break;
}

(async () => {
	await mp3Library.init('alerts/assets/music', force_refresh);
	if(enable_livesplit) {
		await livesplit_main.run('derrick-desktop.local:16834');
		setTimeout(processLivesplit, 500);
	}
	await server.init();

	console.log('http://derrick-desktop.local/nodejs/main/alerts/');
	if(enable_livesplit)
		console.log('Don\'t forget to actually start the livesplit server NotLikeThis');
})();
