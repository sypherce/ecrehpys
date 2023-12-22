/*global document, XMLHttpRequest  */
'use strict';

import * as beefweb from './lib/beefweb.js';

function setFilterDisplay(entry, index) {
	entry.style.filter = 'grayscale(0%)';
	entry.style.display = '';

	//0 is playing, 1-3 are up for voting, 4-7 are coming up
	if (index > 0) entry.style.filter = `grayscale(${100 - (7 - index) * 10}%)`;
	if (index > 6) entry.style.display = 'none';
}

export async function addEntry(album = 'Invalid', title = 'Invalid', filename = 'Invalid', index = undefined) {
	//probably should check for this elsewhere
	function urlExists(url) {
		const http = new XMLHttpRequest();

		http.open('HEAD', url, false);
		http.send();

		return http.status !== 404;
	}
	if (!urlExists(filename)) return;

	//if entry exists, return
	const entry_exists = document.querySelector(`div[data-filename="${filename}"]`);
	if (entry_exists !== null) {
		return;
	}

	//start building the entry
	const base_classes = 'base-entry';
	const container = document.querySelector('#container');
	const id = typeof index === 'undefined' ? container.childNodes.length : index;
	const entry = document.createElement('div');
	entry.setAttribute('data-filename', filename);
	entry.className = `${base_classes} fade-in`;

	setFilterDisplay(entry, id);

	let show_album_text = `<div class="ticker-item">${album}</div><br>`;

	let img_src = await beefweb.getCoverartURL(id + (await beefweb.getActiveItemIndex()));

	entry.innerHTML = `
		<div class="progress-bar"></div>
		<img src="${img_src}?album=${album}">

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
	`;

	function temp_name_anim_end(e) {
		const children = this.parentNode.children;
		//if we want to keep queue full, uncomment below
		//if(child_count <= 2) {
		//	sendMessage('Message', 'Request Queue');
		//}
		const this_index = Array.from(children).indexOf(this);
		if (e.animationName === 'fade-in') {
			this.classList.remove(e.animationName);
		}
		if (e.animationName === 'scroll-left-fade-out') {
			for (let i = this_index; i < children.length; i++) {
				setFilterDisplay(children[i], i);
			}
			this.parentNode.removeChild(this);
		}
	}
	entry.addEventListener('animationend', temp_name_anim_end);

	if (typeof index === 'undefined') {
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
}

function lowerEntry(index = 0) {
	let parent = document.getElementById('container');
	if (parent.children.length < index) {
		console.log("Entry doesn't  exist");
		return;
	}
	if (parent.children.length === index) {
		console.log('Entry is at the bottom');
		return;
	}

	for (let i = index + 1; i < parent.children.length; i++) {
		parent.children[i].classList.add('scroll-left');
	}

	parent.children[index].classList.add('scroll-left-fade-out');
}

export function rmEntry(index = 0) {
	let parent = document.getElementById('container');
	if (parent.children.length <= index) {
		console.log("Entry doesn't  exist");
		return;
	}

	//lowerEntry is disabled for now: this needs reworked. the animation is way too complicated.
	parent.removeChild(parent.children[index]);
	//lowerEntry(index);
}

async function updateEntries() {
	let count = 10;
	let index = await beefweb.getActiveItemIndex();
	let playlist = await beefweb.getActivePlaylistIndex();
	let entries = '';
	if (index !== -1) {
		entries = await beefweb.getItems(playlist, `${index}:${count}`);
	}

	const container = document.querySelector('#container');
	let playback_state = await beefweb.getPlaybackState();
	if ((playback_state && playback_state === 'stopped') || typeof entries.playlistItems === 'undefined') {
		for (let i = 0; i < container.children.length; i++) {
			rmEntry(i);
		}
		if (typeof entries.playlistItems === 'undefined') {
			return;
		}
	}

	count = entries.playlistItems.items.length;

	for (let i = 0; i < count; i++) {
		let filename = entries.playlistItems.items[i].columns.path;
		filename = filename.replace(/G:/g, '/mnt/g');
		filename = filename.replace(/\\/g, '/');

		//this next block is broken
		const entry_exists = document.querySelector(`div[data-filename="${filename}"]`);
		if (entry_exists) {
			for (let y = 0; y < entry_exists.childNodes.length; y++) {
				if (entry_exists.childNodes[y].className === 'progress-bar') {
					let pos = 0;
					if (i === 0) pos = await beefweb.getPositionRelative();

					entry_exists.childNodes[y].style.width = `calc(var(--image_width) * ${pos})`;
					break;
				}
			}
			let this_index = Array.from(entry_exists.parentNode.children).indexOf(entry_exists);
			while (this_index > i) {
				rmEntry(this_index - 1);
				//
				//console.log(0, entry_exists.parentNode);
				//entry_exists.parentNode.removeChild(entry_exists);
				//console.log(1, entry_exists.parentNode);
				//
				this_index = Array.from(entry_exists.parentNode.children).indexOf(entry_exists);
			}
		} else {
			addEntry(
				entries.playlistItems.items[i].columns.album,
				entries.playlistItems.items[i].columns.title,
				filename,
				i
			);
		}
	}
	for (let i = container.children.length - 1; i >= 0; i--) {
		if (i >= count) {
			rmEntry(i);
		} else {
			setFilterDisplay(container.children[i], i);
		}
	}

	//if(entry_exists !== null) {
	//	const this_index = Array.from(entry_exists.parentNode.children).indexOf(entry_exists);
	//
	//	return;
	//}
}

function init() {
	setInterval(updateEntries, 1000);
}
init();
