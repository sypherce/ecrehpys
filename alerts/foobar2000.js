/*global  */
'use strict';

const base_url = 'http://192.168.1.212:8880/api/';
//curl -X GET "https://localhost:8880/api/playlists" -H "accept: application/json"

async function getJSON(url) {
	try {
		const response = await fetch(
			`${base_url}${url}`,
			{
				method: 'GET',
				headers: {
					accept: 'application/json',
				},
			}
		);
		if(!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);

		return await response.json();

	} catch (err) {
		console.log(err);
		return '';
	}
}

async function postJSON(url, data) {
	try {
		const response = await fetch(
			`${base_url}${url}`,
			{
				method: 'POST',
				headers: {
					'accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: //JSON.stringify(data)
				JSON.stringify(data)
			}
		);
		if(!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);

		return await response.json();

	} catch (err) {
		console.log(err);
		return '';
	}
}
async function postSimple(url) {
	try {
		const response = await fetch(
			`${base_url}${url}`,
			{
				method: 'POST'
			}
		);
		if(!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);

		return await response.json();

	} catch (err) {
		console.log(err);
		return '';
	}
}


async function setPosition(position, absolute = false) {
	let command = '';
	if(absolute) {
		command = `player?position=${position}`;
	} else {
		command = `player?relativePosition=${position}`;
	}
	postSimple(command);
}
//
//set position to 30
//
//curl -X POST "http://192.168.1.212:8880/api/player?position=30" -H "accept: application/json"
//

let playback_state = 'stopped';
async function getPlaybackState() {
	let this_playback_state = (await getJSON('player'));
	this_playback_state = this_playback_state.player.playbackState;

	if(playback_state === this_playback_state)
		return false;
	else {
		playback_state = this_playback_state;
		return playback_state;
	}
}
async function getActiveItemIndex() {
	let index = (await getJSON('player'));
	index = index.player.activeItem.index;
	return index;
}
async function getPosition() {
	let index = (await getJSON('player'));
	index = index.player.activeItem.position / index.player.activeItem.duration;
	return index;
}
async function getCoverartURL(index) {
	const playlist = (await getActivePlaylist());
	return `http://192.168.1.212:8880/api/artwork/${playlist}/${index}`;
}
async function getActiveItemFilename() {
	let filename = (await getJSON('player?columns=%filename%'));
	filename = filename.player.activeItem.columns[0];
	return filename;
}
async function getPlaylists() {
	return (await getJSON('playlists'));
}

async function getCurrentPlaylist() {
	let playlists = (await getPlaylists()).playlists;
	return playlists.filter(element => element.isCurrent === true)[0];
}

async function getActivePlaylist() {
	let index = (await getJSON('player'));
	index = index.player.activeItem.playlistIndex;
	return index;
}
async function addItems(playlist_id, index, play, items) {
	console.log(items);
	postJSON(`playlists/${playlist_id}/items/add`,
		{
			'index': index,
			'async': false,
			'replace': false,
			'play': play,
			'items': items
		});

/* working vvvvv
	fetch('http://192.168.1.212:8880/api/playlists/p1/items/add', {
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

//curl -X GET "http://192.168.1.212:8880/api/playlists/p1/items/0:10?columns=%album%,%title%" -H "accept: application/json"
async function getItems(playlist, range) {
	return (await getJSON(`playlists/${playlist}/items/${range}?columns=%album%,%title%,%path%`));
}

export {setPosition, getActiveItemIndex, getPosition, getCoverartURL, getActiveItemFilename, getPlaybackState, getActivePlaylist, addItems, getItems};
