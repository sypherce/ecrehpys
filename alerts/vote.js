/*global document */
'use strict';

import {log} from './log.js';

const vote_ids = new Map();

export function getVotes(id) {// eslint-disable-line
	let vote_elements = document.getElementsByClassName('votes');

	if(vote_elements.length <= id)
		return -1;
	else if(typeof vote_elements[id].innerHTML === 'string')
		return Number(vote_elements[id].innerHTML);

	return 0;
}
export function shiftVotes(amount) {
	vote_ids.forEach((value, key)=>{
		log('temp', 'value' + value);
		let new_value = value + amount;
		if(new_value > 0) {
			vote_ids.set(key, new_value);
			log('temp', 'value' + vote_ids.get(key));
		}
		else {
			vote_ids.delete(key);
			log('temp', `${key} removed (${new_value})`);
		}
	});
}
export function vote(id, number) {
	if(typeof id === 'undefined')
		return;

	let vote_elements = document.getElementsByClassName('votes');
	if(vote_elements.length < number) {
		log('temp', `vote: ${vote_elements.length} < ${number}`);
		return;
	}

	if(vote_ids.has(id)) {
		let old_number = vote_ids.get(id);
		if(old_number === number) {
			return;
		}
		else if(old_number > 1) {
			let new_value = +vote_elements[old_number-1].innerHTML - 1;
			vote_elements[old_number-1].innerHTML = (new_value !== 0) ? new_value : '';
		}
	}

	vote_elements[number-1].innerHTML = +vote_elements[number-1].innerHTML + 1;
	console.log('vote_ids.set(id, number);', id, number);
	vote_ids.set(id, number);
}
