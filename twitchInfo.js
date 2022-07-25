'use strict';

const TwitchApi = require('node-twitch').default;

let thisTwitchConnection = null;
async function init(CLIENT_ID, SECRET) {
	thisTwitchConnection = new TwitchApi({
		client_id: CLIENT_ID,
		client_secret: SECRET
	});
}
async function getChannelInformation(username){
	if(thisTwitchConnection === null) throw 'Must run init(CLIENT_ID, SECRET) first!';

	const this_user = await thisTwitchConnection.getUsers(username);
	const info_list = await thisTwitchConnection.getChannelInformation({'broadcaster_id' : this_user.data[0].id});

	return info_list.data[0];
}

module.exports.init = init;
module.exports.getChannelInformation = getChannelInformation;
