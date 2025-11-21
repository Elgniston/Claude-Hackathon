let accessToken = null;
let foundTracks = [];

// DOM Elements
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const searchBtn = document.getElementById('search-btn');
const createPlaylistBtn = document.getElementById('create-playlist-btn');
const createAnotherBtn = document.getElementById('create-another-btn');
const minBpmInput = document.getElementById('min-bpm');
const maxBpmInput = document.getElementById('max-bpm');
const playlistNameInput = document.getElementById('playlist-name');
const loadingDiv = document.getElementById('loading');
const resultsSection = document.getElementById('results-section');
const successSection = document.getElementById('success-section');
const tracksList = document.getElementById('tracks-list');
const trackCount = document.getElementById('track-count');
const playlistLink = document.getElementById('playlist-link');
const userName = document.getElementById('user-name');

// Event Listeners
loginBtn.addEventListener('click', () => {
    window.location.href = '/login';
});

logoutBtn.addEventListener('click', logout);
searchBtn.addEventListener('click', searchTracks);
createPlaylistBtn.addEventListener('click', createPlaylist);
createAnotherBtn.addEventListener('click', resetToSearch);

// Check for access token in URL hash
window.addEventListener('load', () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    if (params.get('access_token')) {
        accessToken = params.get('access_token');
        window.location.hash = '';
        showApp();
        getUserInfo();
    }
});

async function getUserInfo() {
    try {
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        const data = await response.json();
        userName.textContent = `Welcome, ${data.display_name}!`;
    } catch (error) {
        console.error('Error getting user info:', error);
    }
}

function showApp() {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
}

function logout() {
    accessToken = null;
    loginSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    successSection.classList.add('hidden');
}

async function searchTracks() {
    const minBpm = parseInt(minBpmInput.value);
    const maxBpm = parseInt(maxBpmInput.value);

    if (minBpm >= maxBpm) {
        alert('Minimum BPM must be less than Maximum BPM');
        return;
    }

    if (minBpm < 60 || maxBpm > 200) {
        alert('BPM must be between 60 and 200');
        return;
    }

    loadingDiv.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    successSection.classList.add('hidden');

    try {
        const response = await fetch('/api/search-by-bpm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                minBpm,
                maxBpm,
                limit: 50,
                accessToken
            })
        });

        const data = await response.json();
        foundTracks = data.tracks;

        loadingDiv.classList.add('hidden');

        if (foundTracks.length === 0) {
            alert('No tracks found in this BPM range. Try a different range!');
            return;
        }

        displayTracks(foundTracks);
    } catch (error) {
        console.error('Error searching tracks:', error);
        loadingDiv.classList.add('hidden');
        alert('Error searching for tracks. Please try again.');
    }
}

function displayTracks(tracks) {
    trackCount.textContent = tracks.length;
    tracksList.innerHTML = '';

    tracks.forEach(track => {
        const trackDiv = document.createElement('div');
        trackDiv.className = 'track-item';

        trackDiv.innerHTML = `
            ${track.image ? `<img src="${track.image}" alt="${track.name}">` : '<div style="width:60px;height:60px;background:#ccc;"></div>'}
            <div class="track-info">
                <div class="track-name">${track.name}</div>
                <div class="track-artist">${track.artists}</div>
            </div>
            <div class="track-bpm">${track.bpm} BPM</div>
        `;

        tracksList.appendChild(trackDiv);
    });

    resultsSection.classList.remove('hidden');
}

async function createPlaylist() {
    const playlistName = playlistNameInput.value.trim();

    if (!playlistName) {
        alert('Please enter a playlist name');
        return;
    }

    if (foundTracks.length === 0) {
        alert('No tracks to add to playlist');
        return;
    }

    loadingDiv.classList.remove('hidden');
    resultsSection.classList.add('hidden');

    try {
        const trackUris = foundTracks.map(track => track.uri);

        const response = await fetch('/api/create-playlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: playlistName,
                trackUris,
                accessToken
            })
        });

        const data = await response.json();

        loadingDiv.classList.add('hidden');

        if (data.success) {
            playlistLink.href = data.playlist.url;
            successSection.classList.remove('hidden');
        } else {
            alert('Error creating playlist. Please try again.');
        }
    } catch (error) {
        console.error('Error creating playlist:', error);
        loadingDiv.classList.add('hidden');
        alert('Error creating playlist. Please try again.');
    }
}

function resetToSearch() {
    successSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    foundTracks = [];
    playlistNameInput.value = 'My BPM Playlist';
}
