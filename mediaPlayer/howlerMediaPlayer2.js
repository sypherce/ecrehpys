
let current_song, next_song, song_index = 0;
window.isPlaying = function() {
	return current_song.playing();
}
window.playPause = function() {
	if(current_song.playing())
		current_song.pause();
	else
		current_song.play();
}
window.stop = function() {
	if(current_song.playing())
		current_song.stop();
}
window.currentIndex = function() {
	return song_index;
}
window.seek = function(position) {
	if(typeof position === 'undefined') {
		return current_song.seek()
	}

	current_song.seek(position);
}

export function play_song(index) {
	console.log(`${index}`)
	//index = index < 0 ? 0: index;
	let path = index;
	if(!isNaN(Number(index))) {
		const playlist = document.getElementById("playlist");
		if(index < 0 || index >= playlist.childNodes.length - 1) return;
		song_index = index;
		console.log(index);
		const child = playlist.childNodes.item(song_index);
		path = child.getAttributeNode("url").value;
	}

	next_song = new Howl({
		src: [path],
		html5: true,
		onfade: function () {
			this.stop();
		},
		onend: function () {
			this.unload();
			song_index++;
			play_song(song_index);
		},
	});
	if (current_song && current_song.playing()) {
		if (current_song._src === next_song._src)
			return;
		current_song.fade(1, 0, 1000);
	}
	next_song.play();
	//console.log(`currsong${JSON.stringify(current_song)}`);
	//console.log(`nextsong${JSON.stringify(next_song)}`);
	current_song = next_song;
	current_song = next_song;
	console.log(`currsong${(current_song)}`);
} window.play_song = play_song;

//handle progressbar click
document.getElementById("progress_bar_container").addEventListener('mousedown', function (e) {
	const rect = document.getElementById("progress_bar_container").getBoundingClientRect();

	// Mouse position
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	current_song.seek((x / rect.width) * current_song._duration);

	//play song if not already
	if(!current_song.playing())
		current_song.play();

});
export function addEntry(index, path) {
	const div = document.createElement('div');
	div.className = 'playlistEntry';
	const url = document.createAttribute("url");
		url.value = path;
		div.setAttributeNode(url);
	const filename_with_extension = path.split('\\').pop().split('/').pop();;
	const filename = filename_with_extension.split('.').slice(0, -1).join('.')
	div.innerHTML = filename;

	const playlistElement = document.getElementById('playlist');
	console.log(`temp: ${playlistElement.children.length} < ${index}`)
	if(playlistElement.children.length < index)
		playlistElement.appendChild(div);
	else
		playlistElement.insertBefore(div, playlistElement.childNodes[index]);
	div.onclick = function () { play_song(index) };
	console.log();
}

addEntry(0, 'http://192.168.1.20/mnt/g/media/music/Stream/PS1/Final Fantasy VIII/Ending Theme.mp3');
addEntry(0, 'http://192.168.1.20/mnt/g/media/music/Stream/PS1/Final Fantasy VIII/Fisherman´s Horizon.mp3');
addEntry(0, 'http://192.168.1.20/mnt/g/media/music/Stream/PS1/Final Fantasy VIII/Liberi Fatali.mp3');

play_song('http://192.168.1.20/mnt/g/media/music/Stream/PS1/Final Fantasy VIII/Ending Theme.mp3');
setInterval(() => {
	// Your logic here
	const seekPercent = (current_song.seek() / current_song._duration * 100);
	const seekTime = new Date(current_song.seek() * 1000);
	const durationTime = new Date(current_song._duration * 1000);
	const seekString = `${seekTime.getMinutes()}:${("0" + seekTime.getSeconds()).slice(-2)}`
	const durationString = `${durationTime.getMinutes()}:${("0" + durationTime.getSeconds()).slice(-2)}`;
	const album = 'FF8';
	const title = current_song._src.split('\\').pop().split('/').pop().split('.').slice(0, -1).join('.');

	document.getElementById("progress_bar").innerHTML = ` &emsp; ${seekString} / ${durationString} ${album} - ${title}`;
	document.getElementById("progress_bar").style['width'] = `${seekPercent}%`;
}, 1000 / 60);