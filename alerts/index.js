/*global  document, window, Heat, XMLHttpRequest  */
'use strict';

import {log} from './log.js';
import {shiftVotes, vote} from './vote.js';
import {playSong, sendMessage} from './client.js';
import * as fb2000 from './foobar2000.js';
const enable_voting = false;
const enable_debug_ui = false;

function processClick(x, y, id) {
	let pixel_x = window.innerWidth * x,
		pixel_y = window.innerHeight * y;
	let element = document.elementFromPoint(pixel_x, pixel_y).closest('.base-entry');
	if(element === null) {
		return;
	}

	let index = Array.from(element.parentNode.children).indexOf(element);
	if(index > 0 && index < 8)
		vote(id, index + 1);
}

export function addEntry(album = 'Super Mario Bros. 3', title = 'temporary', userid = undefined, filename = 'cnd2_western_world.mp3', comment ='', index = undefined) {
	//probably should check for this elsewhere
	function urlExists(url){
		const http = new XMLHttpRequest();

		http.open('HEAD', url, false);
		http.send();

		return http.status !== 404;
	}
	if(!urlExists(filename))
		return;

	//if entry exists, vote for it and return
	const entry_exists = document.querySelector(`div[data-filename="${filename}"]`);
	if(entry_exists !== null) {
		const this_index = Array.from(entry_exists.parentNode.children).indexOf(entry_exists);
		if(this_index > 0)
			vote(userid, this_index + 1);

		return;
	}

	//start building the entry
	const base_classes = 'base-entry';
	const container = document.querySelector('#container');
	const id = (typeof index === 'undefined') ?
		container.childNodes.length :
		index;
	const entry = document.createElement('div');
	entry.setAttribute('data-filename', filename);
	entry.className = `${base_classes} fade-in`;

	function setFilterDisplay(entry, index) {
		entry.style.filter = 'grayscale(0%)';
		entry.style.display='';

		//0 is playing, 1-3 are up for voting, 4-7 are coming up
		if(index > 4)
			entry.style.filter = 'grayscale(100%)';
		if(index > 7)
			entry.style.display='none';
	}
	setFilterDisplay(entry, id);

	//temp
	//console is stored as a comment in the mp3s, this tells us to look for boxart
	if(typeof comment !== 'undefined' && comment.includes('console:nes')) {
		comment = 'nes/';
	} else {
		comment = '';
	}

	//we move 'The' to the end. this helps with how the boxarts are named
	const token = 'The';
	if(album.startsWith(token))
		album = `${album.substr(token.length+1)}, ${album.substr(0, token.length)}`;

	//we're using files. this probably should be a url masked by the backend
	//mount the files in the directory later
	let img_src = (`assets/${comment}${album}.png`).replace(/:/g,'');
	let show_album_text = '';
	//if there's no boxart, it loads a dummy file
	if(!urlExists(img_src)) {
		img_src = 'assets/noboxart.png';
		show_album_text = `<div class="ticker-item">${album}</div><br>`;
	}

	entry.innerHTML = `
		<img src="${img_src}">

		<div class="top_container">
			<div class="ticker-container">
				<div class="ticker-wrapper">
					<div class="ticker-transition">
						${show_album_text}
						<div class="ticker-item">${title}</div>
					</div>
				</div>
			</div>
		</div>

		<div class="votes"></div>
	`;

	function temp_name_anim_end(e) {
		const children = this.parentNode.children;
		//if we want to keep queue full, uncomment below
		//if(child_count <= 2) {
		//	sendMessage('Message', 'Request Queue');
		//}
		const this_index = Array.from(children).indexOf(this);
		if(e.animationName === 'fade-in') {
			this.classList.remove(e.animationName);
			//if(this_index === 0)
			//	playSong(this.getAttribute('data-filename'));
		}
		if(e.animationName === 'scroll-left-fade-out') {
			for(let i = this_index; i < children.length; i++) {
				setFilterDisplay(children[i], i);
			}
			shiftVotes(-1);
			this.parentNode.removeChild(this);
		}
	}
	entry.addEventListener('animationend', temp_name_anim_end);

	if(typeof index === 'undefined') {
		container.appendChild(entry);
	} else {
		container.insertBefore(entry, container.children[index]);
	}

	//if we want to fill out queue when adding a item
	//uncomment below
	//{
	//	const child_count = container.children.length;
	//	if(child_count < 2)
	//		sendMessage('Message', 'Request Queue');
	//}

	vote(userid, id);
}

function lowerEntry(index = 0) {
	let parent = document.getElementById('container');
	if(parent.children.length < index) {
		console.log('Entry doesn\'t  exist');
		return;
	}
	if(parent.children.length === index) {
		console.log('Entry is at the bottom');
		return;
	}

	for(let i = index + 1; i < parent.children.length; i++) {
		parent.children[i].classList.add('scroll-left');
	}

	parent.children[index].classList.add('scroll-left-fade-out');
}

export function rmEntry(index = 0){
	let parent = document.getElementById('container');
	if(parent.children.length <= index) {
		console.log('Entry doesn\'t  exist');
		return;
	}
	lowerEntry(index);
	//parent.children[index].classList.add('scroll-left-fade-out');
}

//addEntry(album, title, userid, filename, comment, index)
//rmEntry(index)
async function updateEntries(){
	const album_column = 0;
	const title_column = 1;
	const filepath_column = 2;

	let count = 10;
	let index = await fb2000.getActiveItemIndex();
	let playlist = await fb2000.getCurrentPlaylist();
	let entries = await fb2000.getItems(playlist.id, `${index}:${count}`);
	let playback_state = await fb2000.getPlaybackState();
	if(playback_state && playback_state === 'stopped') {
		const container = document.querySelector('#container');
		for(let i = 0; i < container.children.length; i++)
			rmEntry(i);
	}

	if(typeof entries.playlistItems === 'undefined') {
		return;
	}
	count = entries.playlistItems.items.length;

	let addedEntries = 0;
	let currentEntries = 0;

	for(let i = 0; i < count; i++) {
		let filename = entries.playlistItems.items[i].columns[filepath_column];
		filename = filename.replace(/G:/g, '/mnt/g');
		filename = filename.replace(/\\/g, '/');

		const entry_exists = document.querySelector(`div[data-filename="${filename}"]`);
		if(entry_exists) {
			let this_index = Array.from(entry_exists.parentNode.children).indexOf(entry_exists);
			while(this_index > i) {
				rmEntry(this_index - 1);
				//
				shiftVotes(-1);
				entry_exists.parentNode.removeChild(entry_exists);
				//
				this_index = Array.from(entry_exists.parentNode.children).indexOf(entry_exists);
			}
		}
		else {
			addEntry(entries.playlistItems.items[i].columns[album_column],
				entries.playlistItems.items[i].columns[title_column],
				undefined,
				filename,
				undefined,
				i);
		}
	}
	const container = document.querySelector('#container');
	for(let i = count; i < container.children.length; i++)
		rmEntry(i);

	//if(entry_exists !== null) {
	//	const this_index = Array.from(entry_exists.parentNode.children).indexOf(entry_exists);
//
	//	return;
	//}
}

function init() {
	if(enable_voting === true) {
		const channel = 116718924;
		const heat = new Heat(channel);

		heat.addEventListener('click', (e) => {
			processClick(e.detail.x, e.detail.y, e.detail.id);
		});

		// local clicks
		document.addEventListener('click', (e) => {
			const x = (e.clientX * 1.0 / window.innerWidth).toPrecision(3);
			const y = (e.clientY * 1.0 / window.innerHeight).toPrecision(3);
			const id = -1;

			processClick(x, y, id);
		});
	}
	if(enable_debug_ui === true) {
		document.querySelector('#add-button').addEventListener('click', function() {
			addEntry();
		});
		document.querySelector('#rm-button0').addEventListener('click', function() {
			let index = 0;
			let parent = document.getElementById('container');
			if(parent.children.length <= index) {
				console.log('Entry doesn\'t  exist');
				return;
			}
			parent.children[index].classList.add('scroll-left-fade-out');
		});
		document.querySelector('#rm-button1').addEventListener('click', function() {
			rmEntry(1);
		});
		document.querySelector('#rm-button2').addEventListener('click', function() {
			rmEntry(2);
		});
		document.querySelector('#rm-button3').addEventListener('click', function() {
			rmEntry(3);
		});
		document.querySelector('#rm-button4').addEventListener('click', function() {
			rmEntry(4);
		});
		document.querySelector('#rm-button5').addEventListener('click', function() {
			rmEntry(5);
		});
		document.querySelector('#rm-button6').addEventListener('click', function() {
			rmEntry(6);
		});
	}

	setInterval(updateEntries, 1000);
}
init();
