require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

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

// Route: Parse user prompt with Claude AI
app.post('/api/parse-prompt', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Anthropic API key not configured' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a music playlist assistant. Parse the following user request for a playlist and extract the key parameters.

User request: "${prompt}"

Return a JSON object with these fields:
- bpm: number or object with min/max (e.g., 160 or {min: 140, max: 160})
- genres: array of genre strings (e.g., ["pop", "rock"])
- energy: "low", "medium", or "high"
- mood: string describing mood (e.g., "happy", "chill", "energetic")
- suggestedName: a creative playlist name based on the request

Only return the JSON object, nothing else.`
      }]
    });

    const responseText = message.content[0].text.trim();
    console.log('Claude response:', responseText);

    // Parse the JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const parsedData = JSON.parse(jsonMatch[0]);

    // Normalize BPM to min/max format
    let bpmMin, bpmMax;
    if (typeof parsedData.bpm === 'number') {
      bpmMin = Math.max(60, parsedData.bpm - 10);
      bpmMax = Math.min(200, parsedData.bpm + 10);
    } else if (parsedData.bpm && parsedData.bpm.min && parsedData.bpm.max) {
      bpmMin = parsedData.bpm.min;
      bpmMax = parsedData.bpm.max;
    } else {
      // Default BPM range if not specified
      bpmMin = 100;
      bpmMax = 140;
    }

    res.json({
      criteria: {
        bpmMin,
        bpmMax,
        genres: parsedData.genres || [],
        energy: parsedData.energy || 'medium',
        mood: parsedData.mood || null
      },
      suggestedName: parsedData.suggestedName || 'My Playlist'
    });
  } catch (error) {
    console.error('Error parsing prompt:', error);
    res.status(500).json({ error: 'Failed to parse prompt: ' + error.message });
  }
});

// Route: Search for tracks by AI-parsed criteria
app.post('/api/search-by-criteria', async (req, res) => {
  const { criteria, limit = 10, accessToken } = req.body;

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const { bpmMin, bpmMax, genres, energy } = criteria;

    // Convert energy to Spotify's energy parameter (0-1)
    let targetEnergy = 0.5;
    if (energy === 'low') targetEnergy = 0.3;
    else if (energy === 'high') targetEnergy = 0.8;

    // Get user's top tracks as seed
    const topTracksResponse = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      params: { limit: 5, time_range: 'medium_term' }
    });

    const seedTracks = topTracksResponse.data.items.slice(0, 5);
    const seedTrackIds = seedTracks.map(track => track.id);

    // Build recommendation parameters
    const recParams = {
      seed_tracks: seedTrackIds.join(','),
      target_tempo: (bpmMin + bpmMax) / 2,
      min_tempo: bpmMin,
      max_tempo: bpmMax,
      target_energy: targetEnergy,
      limit: limit * 3  // Get more tracks to filter down
    };

    // Add genres if specified
    if (genres && genres.length > 0) {
      // Spotify allows up to 5 seeds total, and we're using 5 track seeds
      // So we'll use genre as a target instead
      const spotifyGenre = genres[0].toLowerCase();
      recParams.seed_genres = spotifyGenre;
      // Reduce track seeds to make room for genre seed
      recParams.seed_tracks = seedTrackIds.slice(0, 3).join(',');
    }

    // Get recommendations based on criteria
    const recommendationsResponse = await axios.get('https://api.spotify.com/v1/recommendations', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
      params: recParams
    });

    const tracks = recommendationsResponse.data.tracks;

    if (tracks.length === 0) {
      return res.json({ tracks: [] });
    }

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
    }).filter(track => track.bpm && track.bpm >= bpmMin && track.bpm <= bpmMax)
      .slice(0, limit);  // Limit to requested number

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
        description: 'Created with BeMyPace.space - AI-powered playlist generator',
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
  console.log(`Anthropic API configured: ${ANTHROPIC_API_KEY ? 'Yes' : 'No'}`);
});
