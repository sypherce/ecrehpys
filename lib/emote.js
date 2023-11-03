'use strict';
require('dotenv').config();


let nextEmote = -1;

const tmi = require('tmi.js');
const client = new tmi.Client({
  options: { debug: true, messagesLogLevel: "info" },
  connection: {
    reconnect: true,
    secure: true
	},
  identity: {
    username: 'sypherce',
    password: `oauth:${process.env.STREAMER_OAUTH}`
  },
  channels: [ 'sypherce' ]
});
client.connect().catch(console.error);
client.on('message', (channel, tags, message, self) => {
  if(self) return;
  if(message.toLowerCase().indexOf('!lipsX ') !== -1) {
    //client.say(channel, `@${tags.username}, heya!`);
	Object.entries(tags.emotes).forEach(([id, positions]) => {
		nextEmote = `https://static-cdn.jtvnw.net/emoticons/v1/${id}/3.0`;
	});
}





});
async function getEmote() {
	await new Promise(r => setTimeout(r, 1000));
	let returnValue = nextEmote;
	nextEmote = -1;
	return returnValue;
}
    // https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0
//getEmote(process.argv[2]);

module.exports.get = getEmote;
