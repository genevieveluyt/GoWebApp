/*
Background Music Reference: https://youtu.be/G_h17RhIzbc
							https://youtu.be/P_xFh7XFC_w
							https://youtu.be/DfTsofeTkwg
Code Reference: Development Technology Training Center: https://www.developphp.com/video/JavaScript/Audio-Seek-and-Volume-Range-Slider-Tutorial
*/

var audio, playbtn, mutebtn, volumeslider, seeking=false, seekto;
var lastValue;
var musicList = ["assets/Love Yourself.mp3", "assets/River Flow in You.mp3", "assets/Thinking Out Loud.mp3"];
var backgroundMusicInit = function(){

	audio = new Audio();
	var musicFileName = musicList[Math.floor(Math.random() * 1024 % musicList.length)];
	audio.src = musicFileName;
	audio.loop = true;
	audio.play();

	playbtn = document.getElementById("playButton");
	mutebtn = document.getElementById("muteButton");
	volumeslider = document.getElementById("volumeslider");
	musicTitleTextBox = document.getElementById("musicTitle");

	musicTitleTextBox.innerHTML = musicFileName.split('/')[1].split('.')[0];

	lastValue = volumeslider.value;

	mutebtn.onclick = function() {
		audio.muted = !audio.muted;
		mutebtn.src = !audio.muted?'assets/volume.png':'assets/volume_mute.png';
		volumeslider.value = audio.muted?0:lastValue;
	}

	playbtn.onclick = function(){
		audio.paused?audio.play():audio.pause();
		playbtn.src = audio.paused?'assets/player.png':'assets/pause.png';
	}

	volumeslider.onchange = function(){
	    audio.volume = volumeslider.value / 100;
	    lastValue = volumeslider.value;
	};
}

var changeColor = function(color){
	document.body.style.background = color;
	document.getElementById("barColor").style.background = color;
}

