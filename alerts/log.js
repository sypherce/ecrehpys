'use strict';
export let debug = true;
let temp = debug;
export function log(type, ...message) {
	let prefix;
	let bg;
	if(type === 'debug' && debug) {
		prefix = '%c::D::%c';
		bg = 'brown';
	}
	else if(type === 'temp' && temp) {
		prefix = '%c::T::%c';
		bg = 'yellow';
	}
	else
		return;

	console.log(`${prefix} ${message}`, `color: white; background:${bg};`, 'color:initial;background:initial;');
}
