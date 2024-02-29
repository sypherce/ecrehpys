const log = {
	debug: console.debug.bind(console, '\x1b[34mD:\x1b[0m%s'),
	info: console.info.bind(console, '%s'),
	warning: console.warn.bind(console, '\x1b[33mW:\x1b[0m%s'),
	temp: console.debug.bind(console, '\x1b[95mT:\x1b[0m%s'),
	error: console.error.bind(console, '\x1b[91mE:\x1b[0m%s'),
};

export { log };
