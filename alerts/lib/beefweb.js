/*global  */

'use strict';

import { log } from './log.js';

//lin http://derrick-server.local/home/user/root/mnt/g/media/music/Stream/0%20-%20Other/Tunak%20Tunak.mp4
const isLinux = false; //win http://derrick-server.local/mnt/g/media/music/Stream/0%20-%20Other/Tunak%20Tunak.mp4
const baseUrl = `http://${isLinux ? 'desktop-linux.local' : 'derrick-desktop'}:8880/api`;
//curl -X GET "http://localhost:8880/api/playlists" -H "accept: application/json"

const musicPath = `${isLinux ? '/home/user/root/mnt/g/' : 'G:/'}media/music/Stream`;

async function getJSON(url) {
	try {
		const response = await fetch(`${baseUrl}/${url}`, {
			method: 'GET',
			headers: {
				accept: 'application/json',
			},
		});
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

		return await response.json();
	} catch (err) {
		log.error(err);
		return '';
	}
}
async function postJSON(url, data) {
	try {
		const response = await fetch(`${baseUrl}/${url}`, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'Content-Type': 'application/json',
			},
			//JSON.stringify(data)
			body: JSON.stringify(data),
		});

		//not sure if this should just return false. throw new error is a mystery to me
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	} catch (err) {
		log.error(err);
		return false;
	}

	return true;
}
async function postSimple(url) {
	try {
		const response = await fetch(`${baseUrl}/${url}`, {
			method: 'POST',
		});

		//not sure if this should just return false. throw new error is a mystery to me
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	} catch (err) {
		log.error(err);
		return false;
	}

	return true;
}

//curl -X POST "http://derrick-desktop.local:8880/api/player?position=30" -H "accept: application/json"
async function setPosition(position, absolute = false) {
	let command = '';
	if (absolute) {
		command = `player?position=${position}`;
	} else {
		command = `player?relativePosition=${position}`;
	}
	return postSimple(command);
}

async function isPlaying() {
	const json = await getJSON('player');
	const thisState = json.player.playbackState;

	return thisState === 'playing';
}
async function getPlaybackState() {
	getPlaybackState.state = getPlaybackState.state ?? 'stopped';

	const json = await getJSON('player');
	const thisState = json.player.playbackState;

	if (getPlaybackState.state === thisState) return false;

	getPlaybackState.state = thisState;
	return getPlaybackState.state;
}
async function getActiveItemIndex() {
	const json = await getJSON('player');
	return json.player.activeItem.index;
}
async function getPosition() {
	const json = await getJSON('player');
	return json.player.activeItem.position;
}
async function getPositionRelative() {
	const json = await getJSON('player');
	return json.player.activeItem.position / json.player.activeItem.duration;
}
async function getCoverartURL(index) {
	const playlist = await getActivePlaylistIndex();
	return `${baseUrl}/artwork/${playlist}/${index}`;
}
async function getActiveItemFilename() {
	const json = await getJSON('player?columns=%filename%');
	return json.player.activeItem.columns[0];
}
async function getActiveItemPath() {
	const json = await getJSON('player?columns=%path%');
	return json.player.activeItem.columns[0];
}
async function getPlaylists() {
	const json = await getJSON('playlists');
	return json.playlists;
}

//currently broken if no playlists available
async function getCurrentPlaylist() {
	const playlists = await getPlaylists();
	return playlists.filter((element) => element.isCurrent === true)[0];
}

async function getActivePlaylistIndex() {
	const json = await getJSON('player');
	const index = json.player.activeItem.playlistIndex;
	if (index === -1) return (await getCurrentPlaylist()).index;

	return index;
}
async function addItems(playlistId, index, play, items) {
	return postJSON(`playlists/${playlistId}/items/add`, {
		index: index,
		async: false,
		replace: false,
		play: play,
		items: items,
	});

	/* working vvvvv
		fetch('http://derrick-desktop.local:8880/api/playlists/p1/items/add', {
			method: 'POST',
			headers: {
				'accept': 'application/json',
				'Content-Type': 'application/json'
			},
			// body: '{ "index": 0, "async": false, "replace": false, "play": true, "items": [ "G:/media/music/Stream/Charlie - Candy Mountain.mp3" ]}',
			body: JSON.stringify({
				'index': 0,
				'async': false,
				'replace': false,
				'play': true,
				'items': [
					'G:/media/music/Stream/Charlie - Candy Mountain.mp3'
				]
			})
		});
	*/
}
async function moveItems(playlistId, items) {
	console.log(`moving items: ${items} in playlist: ${playlistId}`);
	return postJSON(`playlists/${playlistId}/items/move`, {
		items: items,
	});
}
async function next(string) {
	return postJSON(`player/next`, {
		by: string,
	});
}
//curl -X GET "http://derrick-desktop.local:8880/api/playlists/p1/items/0:10?columns=%album%,%title%" -H "accept: application/json"
async function getItems(playlist, range) {
	const json = await getJSON(`playlists/${playlist}/items/${range}?columns=%album%,%title%,%path%`);
	log.info('JSON response:', json);
	json.playlistItems.items.forEach((element) => {
		let temporary = element.columns;
		element.columns = {
			album: temporary[0],
			title: temporary[1],
			path: temporary[2],
		};
	});
	return json;
}

async function itemIsInPlaylist(playlist, item) {
	//get active item index
	//get items in playlist after active item
	//search for item in items
	//return index if found
	//return -1 if not found
	const activeItem = await getActiveItemIndex();
	const items = await getItems(playlist, `${activeItem}:10000`);
	const found = items.playlistItems.items.findIndex((element) => {
		return element.columns.path === item;
	});
	return found;
}

async function _test() {
	console.group('%cfoobar2000 test', 'color: white; background: blue;');
	console.trace();
	const activePlaylist = await getActivePlaylistIndex();
	console.log({ activePlaylist: activePlaylist });
	console.log({ getJSON: await getJSON('player') });
	console.log({ postSimple: [await postSimple('player?position=15'), await getPosition()] });
	console.log({ setPosition: [await setPosition(25, true), await getPosition()] });
	console.log({ getPlaybackState: await getPlaybackState() });
	console.log({ isPlaying: await isPlaying() });

	const activeItemIndex = await getActiveItemIndex();
	console.log({ itemIsInPlaylist: await itemIsInPlaylist(activePlaylist, await getActiveItemPath()) });
	console.log({ activeItemIndex: activeItemIndex });
	console.log({ getPosition: await getPosition() });
	console.log({ getPositionRelative: await getPositionRelative() });
	console.log({ getCoverartURL: await getCoverartURL(activeItemIndex) });
	console.log({ getActiveItemFilename: await getActiveItemFilename() });
	console.log({ getActiveItemPath: await getActiveItemPath() });
	console.log({ getPlaylists: await getPlaylists() });
	console.log({ getActivePlaylistIndex: await getActivePlaylistIndex() });
	const items = await getItems(activePlaylist, '0:10');
	console.log(items);
	items.playlistItems.items.forEach((element) => {
		console.log(element.columns);
	});

	await new Promise((r) => setTimeout(r, 1000));
	const testMp3Filename = musicPath + '/0 - Other/Crabs- MrWeebl.mp3';
	console.log({
		postJSON: await postJSON(`playlists/${activePlaylist}/items/add`, {
			index: 0,
			async: false,
			replace: false,
			play: true,
			items: [testMp3Filename],
		}),
	});
	console.log(`${activePlaylist} -- ${testMp3Filename}`);

	console.groupEnd();
}
//_test();

export {
	setPosition,
	getActiveItemIndex,
	getPosition,
	getPositionRelative,
	getCoverartURL,
	getActiveItemFilename,
	getActiveItemPath,
	getPlaybackState,
	isPlaying,
	getActivePlaylistIndex,
	addItems,
	moveItems,
	next,
	getItems,
	itemIsInPlaylist,
	musicPath,
};
