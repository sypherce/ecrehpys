const ESC = (number) => `\x1b[${number}m`;
const FG = {
	BLACK: ESC(30),
	RED: ESC(31),
	GREEN: ESC(32),
	YELLOW: ESC(33),
	BLUE: ESC(34),
	MAGENTA: ESC(35),
	CYAN: ESC(36),
	WHITE: ESC(37),
};
const BG = {
	BLACK: ESC(40),
	RED: ESC(41),
	GREEN: ESC(42),
	YELLOW: ESC(43),
	BLUE: ESC(44),
	MAGENTA: ESC(45),
	CYAN: ESC(46),
	WHITE: ESC(47),
};
const RESET = ESC(0);
const log = {
	debug: console.debug.bind(console, `${BG.BLUE}${FG.BLACK}D:${RESET}%s`),
	info: console.info.bind(console, `%s`),
	warning: console.warn.bind(console, `${BG.YELLOW}${FG.BLACK}W:${RESET}%s`),
	temp: console.debug.bind(console, `${BG.WHITE}${FG.BLACK}T:${RESET}%s`),
	error: console.error.bind(console, `${BG.RED}${FG.BLACK}E:${RESET}%s`),
};

export { log };
