require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Generate random string for state
const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// Route: Login with Spotify
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = 'playlist-modify-public playlist-modify-private user-top-read';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: scope,
    redirect_uri: REDIRECT_URI,
    state: state
  });

  res.redirect('https://accounts.spotify.com/authorize?' + params.toString());
});

// Route: Callback from Spotify
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;

  if (state === null) {
    res.redirect('/#error=state_mismatch');
    return;
  }

  try {
    const authOptions = {
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: new URLSearchParams({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }),
      headers: {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const response = await axios(authOptions);
    const { access_token, refresh_token } = response.data;

    // Redirect to frontend with token
    res.redirect('/#access_token=' + access_token + '&refresh_token=' + refresh_token);
  } catch (error) {
    console.error('Error getting token:', error.response?.data || error.message);
    res.redirect('/#error=invalid_token');
  }
});

// Route: Search for tracks by BPM
app.post('/api/search-by-bpm', async (req, res) => {
  const { minBpm, maxBpm, limit = 50, accessToken } = req.body;

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Get user's top tracks as seed
    const topTracksResponse = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      params: { limit: 5, time_range: 'medium_term' }
    });

    const seedTracks = topTracksResponse.data.items.slice(0, 5);
    const seedTrackIds = seedTracks.map(track => track.id);

    // Get recommendations based on BPM
    const recommendationsResponse = await axios.get('https://api.spotify.com/v1/recommendations', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      params: {
        seed_tracks: seedTrackIds.join(','),
        target_tempo: (parseFloat(minBpm) + parseFloat(maxBpm)) / 2,
        min_tempo: minBpm,
        max_tempo: maxBpm,
        limit: limit
      }
    });

    const tracks = recommendationsResponse.data.tracks;

    // Get audio features to verify BPM
    const trackIds = tracks.map(t => t.id).join(',');
    const audioFeaturesResponse = await axios.get('https://api.spotify.com/v1/audio-features', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      params: { ids: trackIds }
    });

    // Combine track info with audio features
    const tracksWithBpm = tracks.map((track, index) => {
      const features = audioFeaturesResponse.data.audio_features[index];
      return {
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        uri: track.uri,
        bpm: features ? Math.round(features.tempo) : null,
        image: track.album.images[0]?.url
      };
    }).filter(track => track.bpm && track.bpm >= minBpm && track.bpm <= maxBpm);

    res.json({ tracks: tracksWithBpm });
  } catch (error) {
    console.error('Error searching tracks:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to search tracks' });
  }
});

// Route: Create playlist
app.post('/api/create-playlist', async (req, res) => {
  const { name, trackUris, accessToken } = req.body;

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Get user ID
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    const userId = userResponse.data.id;

    // Create playlist
    const playlistResponse = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        name: name,
        description: 'Created with BPM Playlist Generator',
        public: true
      },
      {
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    const playlistId = playlistResponse.data.id;

    // Add tracks to playlist
    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        uris: trackUris
      },
      {
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      playlist: {
        id: playlistId,
        name: playlistResponse.data.name,
        url: playlistResponse.data.external_urls.spotify
      }
    });
  } catch (error) {
    console.error('Error creating playlist:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
