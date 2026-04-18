const tracks = [
    { title: "Трек 1 (Без авторских прав)", src: "music/track1.mp3" },
    { title: "Трек 2 (Лицензионный)", src: "music/track2.mp3" }
];

const audioPlayer = document.getElementById('audio-player');
const trackList = document.getElementById('track-list');

function loadTracks() {
    tracks.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = 'track-item';
        li.textContent = track.title;
        li.onclick = () => playTrack(index);
        trackList.appendChild(li);
    });
}

function playTrack(index) {
    if (index >= 0 && index < tracks.length) {
        audioPlayer.src = tracks[index].src;
        audioPlayer.play();
    } else {
        console.error("Неверный индекс трека");
    }
}

loadTracks();
