# 🎵 Spotify BPM Playlist Generator

A simple web application that creates Spotify playlists based on your desired BPM (beats per minute). Perfect for runners, workouts, or just finding music at the right tempo!

## Features

- 🎯 Search for songs within a specific BPM range
- 🎨 Clean, modern, and responsive UI
- 🔐 Secure Spotify OAuth authentication
- ⚡ Fast playlist creation
- 📱 Mobile-friendly design

## Prerequisites

- Node.js (v14 or higher)
- A Spotify account
- Spotify Developer credentials (Client ID and Secret)

## Getting Started

### 1. Get Spotify API Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the app name and description
5. After creating, you'll see your **Client ID** and **Client Secret**
6. Click "Edit Settings"
7. Add `http://localhost:3000/callback` to the Redirect URIs
8. Save the settings

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your credentials:
```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:3000/callback
PORT=3000
```

### 4. Run the Application

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The app will be available at `http://localhost:3000`

## How to Use

1. **Connect with Spotify**: Click the "Connect with Spotify" button and authorize the app
2. **Choose BPM Range**: Enter your desired minimum and maximum BPM
   - Walking/Slow: 60-90 BPM
   - Running/Moderate: 120-140 BPM
   - High Energy: 140-180 BPM
3. **Find Songs**: Click "Find Songs" to search for tracks in your range
4. **Create Playlist**: Enter a playlist name and click "Create Playlist"
5. **Enjoy**: Your new playlist is now in your Spotify account!

## Deployment

### Deploy to Render (Recommended for beginners)

1. Create a [Render](https://render.com) account
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: spotify-bpm-generator
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables in the Render dashboard:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `REDIRECT_URI` (update with your Render URL + /callback)
   - `PORT` (use 3000)
6. Deploy!

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts
4. Add environment variables in Vercel dashboard
5. Update Spotify app settings with your Vercel URL

### Deploy to Heroku

1. Install Heroku CLI
2. Run:
```bash
heroku create your-app-name
heroku config:set SPOTIFY_CLIENT_ID=your_client_id
heroku config:set SPOTIFY_CLIENT_SECRET=your_client_secret
heroku config:set REDIRECT_URI=https://your-app-name.herokuapp.com/callback
git push heroku main
```

### Important: Update Redirect URI

After deploying, update your Spotify app settings:
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click "Edit Settings"
4. Add your production URL + `/callback` to Redirect URIs
   - Example: `https://your-domain.com/callback`
5. Save

## Custom Domain Setup

### After purchasing a domain:

1. **For Render**:
   - Go to your service settings
   - Click "Custom Domain"
   - Add your domain and follow DNS instructions

2. **For Vercel**:
   - Go to your project settings
   - Click "Domains"
   - Add your domain and configure DNS

3. **Update Spotify Settings**:
   - Add `https://yourdomain.com/callback` to Redirect URIs
   - Update `.env` or environment variables with new REDIRECT_URI

## Project Structure

```
spotify-bpm-playlist-generator/
├── server/
│   └── index.js          # Express server & API routes
├── public/
│   ├── index.html        # Main HTML file
│   ├── style.css         # Styles
│   └── app.js            # Frontend JavaScript
├── package.json          # Dependencies
├── .env                  # Environment variables (not in git)
├── .env.example          # Environment variables template
└── README.md            # This file
```

## API Endpoints

- `GET /login` - Initiate Spotify OAuth flow
- `GET /callback` - Handle Spotify OAuth callback
- `POST /api/search-by-bpm` - Search for tracks by BPM range
- `POST /api/create-playlist` - Create a new playlist

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **API**: Spotify Web API
- **Authentication**: OAuth 2.0

## Troubleshooting

### "Invalid Client" Error
- Check that your Client ID and Secret are correct in `.env`
- Ensure Redirect URI matches exactly in both `.env` and Spotify Dashboard

### "No tracks found"
- Try a wider BPM range
- The app uses your top tracks as seeds, so results depend on your listening history

### "Access token required"
- Log out and log back in to refresh your token
- Check browser console for errors

## Future Enhancements

- Save BPM preferences
- Multiple seed options (genres, artists)
- Advanced filtering (energy, danceability)
- Share playlists directly
- Playlist preview before creation

## Contributing

Feel free to submit issues and pull requests!

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Made with ♥ for music lovers
