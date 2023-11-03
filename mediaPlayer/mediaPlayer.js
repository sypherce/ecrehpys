'use strict';
const server = require('../modules/server.js');

const prettyStringify = require("@aitodotai/json-stringify-pretty-compact")

const isLinux = false;
let music_path = `${isLinux ? '/home/deck/root/mnt/g/' : 'G:/'}media/music/Stream`;

const playlists = [];
let player = {
	info: {
		name: 'ecrehpys.media',
		title: 'ecrehpys.media',
		version: '1.0',
		pluginVersion: '1.0'
	},
	activeItem: {
		playlistId: 'p69',
		playlistIndex: 0,
		index: 0,
		position: 0,
		duration: 420,
		columns: [
			'album', 'title', 'http://192.168.1.20/nodejs/main/alerts/assets/alerts/0.mp3'
		],
		all_columns: [{
			album: 'running with scissors',
			title: 'living in the fridge',
			filename: 'http://192.168.1.20/nodejs/main/alerts/assets/alerts/0.mp3',
		}],
	},
	playbackState: 'playing',
	volume: {
		type: "db",
		min: -100,
		max: 0,
		value: 0,
		isMuted: false
	}
};

setInterval(() => {
		player.activeItem.position++;
	}, '1000');

/*
	find playlist
	make new playlist at last position if not found
	add items to playlist at itemIndex or end of items
	###todo implement play
*/
function addItems(playlistIndex, itemIndex, play, items) {
	let thisPlaylist = playlists.findIndex(({ index }) => index === playlistIndex);
	if(thisPlaylist === -1) {
		playlists.push({
			index: playlistIndex,
			title: 'this title',
			isCurrent: false,
			itemCount: 0,
			items: []
		});
		thisPlaylist = playlists.length - 1;
	}

	items.forEach((element) => {
		playlists[thisPlaylist].items.splice(itemIndex, 0, {columns: ['album', 'title', JSON.stringify(element)]});
		if(play === true) {
			element = `../music/${element.replace(/G\:\/media\/music\/Stream\//gi, '')}`;
			server.sendMessage('Audio', element);
			console.log(element);
			console.log(JSON.stringify(element));
			player.activeItem.position = 0;
		}
	});

	return true;
}

function getItems(playlist, range) {
	range = `${range}`.split(":");
	const start = parseInt(range[0]);
	if(Number.isNaN(start))
		throw new Error('Start is not a number');
	const count = parseInt(range[1]) ? parseInt(range[1]) : 1;

	const playlistIndex = playlists.findIndex(({ index }) => index === playlist);
	if(playlistIndex === -1)
		throw new Error('Index not found');
	if(playlistIndex.length < start + count)
		throw new Error('Range is invalid');

	return JSON.stringify(playlists[playlistIndex].items.slice(start, start+count));
}
/*
const foobarPlayerObject = {
    "getJSON": {
        "player": {
            "activeItem": {
                "columns": [],
                "duration": 72.05984126984127,
                "index": 0,
                "playlistId": "p35",
                "playlistIndex": 0,
                "position": 24.943119366666664
            },
            "info": {
                "name": "foobar2000",
                "pluginVersion": "0.8",
                "title": "foobar2000",
                "version": "2.1 preview 2023-10-13"
            },
            "options": [
                {
                    "enumNames": [
                        "Default",
                        "Repeat (playlist)",
                        "Repeat (track)",
                        "Random",
                        "Shuffle (tracks)",
                        "Shuffle (albums)",
                        "Shuffle (folders)"
                    ],
                    "id": "playbackOrder",
                    "name": "Playback order",
                    "type": "enum",
                    "value": 0
                },
                {
                    "id": "stopAfterCurrentTrack",
                    "name": "Stop after current track",
                    "type": "bool",
                    "value": false
                }
            ],
            "playbackMode": 0,
            "playbackModes": [
                "Default",
                "Repeat (playlist)",
                "Repeat (track)",
                "Random",
                "Shuffle (tracks)",
                "Shuffle (albums)",
                "Shuffle (folders)"
            ],
            "playbackState": "playing",
            "volume": {
                "isMuted": false,
                "max": 0,
                "min": -100,
                "type": "db",
                "value": 0
            }
        }
    }
};
const foobarPlaylistsObject =
[
    {
        "id": "p35",
        "index": 0,
        "isCurrent": true,
        "itemCount": 12,
        "title": "New Playlist",
        "totalTime": 0
    },
    {
        "id": "p36",
        "index": 1,
        "isCurrent": false,
        "itemCount": 0,
        "title": "New Playlist (2)",
        "totalTime": 0
    },
    {
        "id": "p37",
        "index": 2,
        "isCurrent": false,
        "itemCount": 0,
        "title": "New Playlist (3)",
        "totalTime": 0
    }
];

const foobarGetItemsObject = {
    "getItems": {
        "playlistItems": {
            "items": [
                {
                    "columns": [
                        "MrWeebl",
                        "Crabs",
                        "G:\\media\\music\\Stream\\0 - Other\\Crabs- MrWeebl.mp3"
                    ]
                },
                {
                    "columns": [
                        "MrWeebl",
                        "Crabs",
                        "G:\\media\\music\\Stream\\0 - Other\\Crabs- MrWeebl.mp3"
                    ]
                },
                {
                    "columns": [
                        "MrWeebl",
                        "Crabs",
                        "G:\\media\\music\\Stream\\0 - Other\\Crabs- MrWeebl.mp3"
                    ]
                },
                {
                    "columns": [
                        "MrWeebl",
                        "Crabs",
                        "G:\\media\\music\\Stream\\0 - Other\\Crabs- MrWeebl.mp3"
                    ]
                },
                {
                    "columns": [
                        "MrWeebl",
                        "Crabs",
                        "G:\\media\\music\\Stream\\0 - Other\\Crabs- MrWeebl.mp3"
                    ]
                },
                {
                    "columns": [
                        "MrWeebl",
                        "Crabs",
                        "G:\\media\\music\\Stream\\0 - Other\\Crabs- MrWeebl.mp3"
                    ]
                },
                {
                    "columns": [
                        "MrWeebl",
                        "Crabs",
                        "G:\\media\\music\\Stream\\0 - Other\\Crabs- MrWeebl.mp3"
                    ]
                },
                {
                    "columns": [
                        "MrWeebl",
                        "Crabs",
                        "G:\\media\\music\\Stream\\0 - Other\\Crabs- MrWeebl.mp3"
                    ]
                },
                {
                    "columns": [
                        "?",
                        "Tunak Tunak",
                        "G:\\media\\music\\Stream\\0 - Other\\Tunak Tunak.mp4"
                    ]
                },
                {
                    "columns": [
                        "Chrono Cross",
                        "Chrono Cross ~ Scars Left by Time",
                        "G:\\media\\music\\Stream\\PS1\\Chrono Cross\\Chrono Cross ~ Scars Left by Time.mp3"
                    ]
                }
            ],
            "offset": 0,
            "totalCount": 14
        }
    }
};
*/

async function init() {
	var cors = require('cors')
	const express = require('express')
	const app = express()
	app.use(cors())
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));

	app.get('/api/player', (request, response) => {
		const query = new URLSearchParams(request._parsedUrl.query);
		response.json({player: player});
	})
	app.post('/api/player', (request, response) => {
		const req = request;//remove me
		const res = response;//remove me
		const query = new URLSearchParams(request._parsedUrl.query);
		console.log(query);
		if(query.has('columns')) {
			console.log(`columns: ${query.get('columns')}`);
			response.json({player: player});
		}
		else {
			response.json({player: player});
		}
	})
	app.get('/api/playlists', (request, response) => {
		const query = new URLSearchParams(request._parsedUrl.query);
		console.log(playlists);
		response.json({playlists: playlists});
	})
	app.post('/api/playlists/:id/items/add', (request, response) => {
		const req = request;//remove me
		const res = response;//remove me

console.log('1234567890');
console.log(request.body);
//which playlist? probably current, 0 for now
addItems(0, request.body.index, request.body.play, request.body.items);
	});
	app.get(`\/api\/playlists\/:id\/items\/\d{0,6}:\d{0,6}`, (request, response) => {
		const query = new URLSearchParams(request._parsedUrl.query);
		const playlistID = Number(request.params.id);
		if(query.has('columns')) {
			let columns = query.get('columns');
			let [start, count] = request._parsedUrl.pathname.split('/').pop().split(':');
			console.log(`start: ${start}, count:${count}`);
			console.log(playlists[playlistID].items);
			if(playlists[playlistID].items.length < start + count)
				count = start - playlists[playlistID].items.length;
			if(count < 0)
				count = 0;
			for(let position = start; position < start + count; position++) {
				console.log(playlists[playlistID].items[position]);
			}
			//columns = columns.replaceAll('%album%', playlists[request.params.id])
			//console.log(p.replace('dog', 'monkey'));
			console.log(`columns: ${query.get('columns')}`);
		}
		response.json(playlists[playlistID]);

		/*({
			"playlistItems": {
				"offset": 0,
				"totalCount": 0,
				"items": [{
					"columns": [
						"album", "title", "http://192.168.1.20/nodejs/main/alerts/assets/alerts/0.mp3"
					]
				}]
			}
		});*/

		console.log('request.query: ',request.query)
	});


    app.get(new RegExp('/.*'), function(request, response) {
        console.log(response.req.url);
        response.sendFile(`/var/www/html/nodejs/main/mediaPlayer${response.req.url}`);
         // response.sendFile('/var/www/html/nodejs/main/mediaPlayer/index.html');
    });
	app.listen(8880)

	let line = 0;
	addItems(0, 0, false, [
		{columns: [
			"ducktales_splits", "3", "C:\\wave.mp3'"
		]},
		{columns: [
			"ducktales_splits", "4", "C:\\media.mp3'"
		]}
	]);
	addItems(0, 0, false, [
		{columns: [
			"ducktales_splits", "5", "C:\\media.mp3'"
		]},
		{columns: [
			"ducktales_splits", "6", "C:\\media.mp3'"
		]},
		{columns: [
			"ducktales_splits", "7", "C:\\media.mp3'"
		]}
	]);
	console.log(JSON.stringify(playlists));
	console.log(`${line++}: ${getItems(0, "0:2")}`)
	console.log(`${line++}: ${prettyStringify(playlists, {indent: '\t', maxLength: 1000, maxNesting: 2})}`);
};

module.exports.init = init;
//export {setPosition, getActiveItemIndex, getPosition, getPositionRelative, getCoverartURL, getActiveItemFilename, getPlaybackState, isPlaying, getActivePlaylistIndex, addItems, getItems, music_path};
