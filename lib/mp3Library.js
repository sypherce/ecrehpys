'use strict';

const NodeID3 = require('node-id3');
const path = require('path');
const fs = require('fs');
const Fuse = require('fuse.js');
const useTube = require('usetube');
const log = require('esm')(module)('../alerts/lib/log.js').log;

let mp3Array = [];

/**
 * Loads the MP3 library for the given directory, either from a cached JSON file if it exists, or by scanning all MP3 files in the directory and generating the JSON file.
 *
 * @param {string} directory - The directory containing the MP3 files.
 * @param {boolean} [force=false] - If true, forces a re-scan and regenerate of the JSON file even if it already exists.
 * @returns {Promise} A promise that resolves when the library is loaded.
 */
async function loadMp3Library(directory, force = false) {
	async function readJsonToObject(filename) {
		let jsonData = await fs.promises.readFile(filename, 'binary');

		return JSON.parse(jsonData);
	}
	async function writeObjectToJson(filename) {
		await fs.promises.writeFile(filename, JSON.stringify(mp3Array));
	}

	directory = path.normalize(`${directory}/`);
	const jsonFilename = path.normalize(`${directory}/${path.basename(directory)}.json`);
	let fileExists = fs.existsSync(jsonFilename);
	if (force && fileExists) {
		//delete file
		try {
			fs.unlinkSync(jsonFilename);
			fileExists = false;
		} catch (err) {
			log.error(err);
		}
	}

	log.debug(`${fileExists ? 'Found' : 'Missing'}`, jsonFilename);
	if (fileExists) {
		mp3Array = await readJsonToObject(jsonFilename);
	} else {
		console.time('mp3 scan');
		await scanMp3Library(directory);
		await writeObjectToJson(jsonFilename);
		console.timeEnd('mp3 scan');
	}
}
const htmlheader = `<!DOCTYPE html>
<html>
	<head>
		<title></title>
		<meta charset="UTF-8">
		<style>
			body {
				overflow-y: scroll;
			}

			details {
				border: 1px solid #aaa;
				border-radius: 4px;
				padding: .5em .5em 0;
			}

			summary {
				font-weight: bold;
				margin: -.5em -.5em 0;
				padding: .5em;
			}

			details[open] {
				padding: .5em;
			}

			details[open] summary {
				border-bottom: 1px solid #aaa;
				margin-bottom: .5em;
			}
			</style>
	</head>
	<body>
	<center>
		Use the <b>!sr</b> command to request songs in the format of:<br>
		<b>!sr game - title</b><br>

		The bot searches for the closest match to "game" and "title", example: <br>
		<b>!sr Wind Waker - treta discovered</b><br>
		<br>
		<b>Songs to choose from:</b><br>`;
let htmlcontents = '';
const htmlfooter = `
<br></center>
</body>
</html>`;

/**
 * Recursively scans an MP3 library directory, reads MP3 metadata,
 * generates an HTML file with MP3 info for the song request command,
 * and pushes changes to a Git repository.
 * @param {string} directory - The path to the MP3 library directory to scan.
 *
 * @returns {Promise} A promise that resolves when the scan is complete.
 */
async function scanMp3Library(directory) {
	// Possible options
	const nodeid3Options = {
		include: ['TALB', 'TIT2'], // only read the specified tags (default: all)
		noRaw: true, // don't generate raw object (default: false)
	};

	const topLevel = htmlcontents === '';
	if (topLevel) htmlcontents = htmlheader;
	try {
		const files = await fs.promises.readdir(directory);
		let logCounter = 0;
		htmlcontents = htmlcontents.concat(`<details ${topLevel ? 'open' : ''}>\n\t\t\t<summary>${path.parse(directory).name}</summary>`);
		for (const file of files) {
			const fullFileName = directory + file;
			if (logCounter++ > 50) {
				logCounter = 0;
				log.debug(fullFileName);
			}
			if (fs.statSync(fullFileName).isDirectory()) {
				await scanMp3Library(`${fullFileName}/`);
			} else if (path.extname(fullFileName) === '.mp3') {
				const readObj = NodeID3.read(fullFileName, nodeid3Options);
				if (readObj.album !== '') {
					readObj.filename = fullFileName.replace(/alerts\/assets\/music\//g, '');
					htmlcontents = htmlcontents.concat(`!sr ${readObj.album} - ${readObj.title}<br>\n`);
					mp3Array.push(readObj); // add at the end
				}
			}
		}
		htmlcontents = htmlcontents.concat('</details>');
	} catch (error) {
		log.error(error);
	}
	if (topLevel) {
		htmlcontents = htmlcontents.concat(htmlfooter);

		try {
			fs.writeFileSync('../stream/sr.html', htmlcontents);

			const { exec } = require('child_process');
			exec(
				'cd /var/www/html/nodejs/stream && ' + 'git commit -a -m auto && ' + 'git push https://github.com/sypherce/stream.git',
				(error, stdout, stderr) => {
					if (error) {
						log.error(`error: ${error.message}`);
						return;
					}
					if (stderr) {
						log.error(`stderr: ${stderr}`);
						return;
					}
					log.info(`stdout: ${stdout}`);
				}
			);
			// file written successfully
		} catch (err) {
			log.error(err);
		}
	}
}
function getEntry(index) {
	return mp3Array[index];
}
function entries() {
	return mp3Array.length;
}

/**
 * Uses Fuse.js to perform a fuzzy search against the mp3 library.
 * Splits the input string on '-' to search album and title separately.
 * @param {string} input - The search query string, e.g. "album - title"
 * @returns {object} The matched mp3 object, or empty string if no match
 */
async function findNew(input) {
	const results = await useTube.searchVideo(input);
	let selectedResult = 0;
	// skip videos longer than 6 minutes
	while (results.videos[selectedResult].duration > 6 * 60) selectedResult++;

	let returnResults = {};
	returnResults.album = results.videos[selectedResult].artist;
	returnResults.title = results.videos[selectedResult].title;
	returnResults.filename = `https://www.youtube.com/watch?v=${results.videos[selectedResult].id}`;
	log.debug(`
	Title: ${returnResults.title}
	Url: ${returnResults.filename}
	Duration: ${Math.floor(results.videos[selectedResult].duration / 60)}:${results.videos[selectedResult].duration % 60}`);

	return returnResults;
}
function findOld(input) {
	const fuseOptions = {
		includeScore: true,
		ignoreLocation: true,
		ignoreFieldNorm: true,
		useExtendedSearch: true,
		keys: [
			{
				name: 'title',
			},
			{
				name: 'album',
			},
		],
	};
	const fuse = new Fuse(mp3Array, fuseOptions);

	const splitIndex = input.indexOf('-');
	const inputArr = splitIndex !== -1 ? [input.substring(0, splitIndex), input.substring(splitIndex + 1)] : input;

	let match = '';
	if (typeof inputArr === 'string') {
		match = fuse.search(input, { limit: 1 });
	} else {
		match = fuse.search(
			{
				$and: [{ album: inputArr[0] }, { title: inputArr[1] }],
			},
			{ limit: 1 }
		);
	}

	if (Object.keys(match).length !== 0) {
		match = match[0].item;
	} else match = '';

	log.debug(`match:${match} ${JSON.stringify(match)}`);
	return match;
}
async function find(input) {
	return await findNew(input);
}

module.exports.init = loadMp3Library;
module.exports.find = find;
module.exports.getEntry = getEntry;
module.exports.entries = entries;
