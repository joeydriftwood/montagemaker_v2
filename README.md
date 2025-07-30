# Montage Maker Backend

Backend server for the Montage Maker video processing application. This server handles video downloading, montage generation, and reaction video creation using yt-dlp and FFmpeg.

## Features

- Video downloading from YouTube, Dropbox, Google Drive, and direct URLs
- Montage generation with customizable intervals and layouts
- Reaction video splitting with configurable intervals
- Queue-based processing using Bull and Redis
- RESTful API endpoints
- Job status tracking and progress monitoring

## Prerequisites

- Node.js 18 or higher
- FFmpeg installed on the system
- Redis server (for queue management)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd montagemaker-backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp env.example .env
```

4. Configure environment variables in `.env`:
```bash
# Server Configuration
PORT=3000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Optional: Custom paths
# YTDLP_PATH=/usr/local/bin/yt-dlp
# FFMPEG_PATH=/usr/local/bin/ffmpeg
```

5. Install FFmpeg (if not already installed):
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg
```

6. Start Redis server:
```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis-server

# Or run locally
redis-server
```

## Development

Start the development server:
```bash
npm run dev
```

The server will be available at `http://localhost:3000`

## Production

Start the production server:
```bash
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Montage Generation
- `POST /api/generate-montage` - Start montage generation
- `GET /api/job-status/:jobId` - Get job status
- `GET /api/download/:jobId` - Download completed montage

### Reaction Video Generation
- `POST /api/generate-reaction` - Start reaction video generation
- `GET /api/job-status/:jobId` - Get job status
- `GET /api/download/:jobId` - Download completed reaction video

## Request Examples

### Generate Montage
```json
POST /api/generate-montage
{
  "videoUrls": ["https://youtube.com/watch?v=example"],
  "montageType": "fixed-interval",
  "layoutType": "cut",
  "interval": 1,
  "montageLength": 30,
  "startCutAt": 0,
  "endCutAt": 60,
  "resolution": "1280x720",
  "variations": 1
}
```

### Generate Reaction Video
```json
POST /api/generate-reaction
{
  "videoUrl": "https://youtube.com/watch?v=example",
  "splitInterval": 10
}
```

## Deployment

### Render.com

1. Create a new Web Service on Render
2. Connect to your GitHub repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables:
   - `PORT`: 10000 (Render's default)
   - `REDIS_HOST`: Your Redis instance host
   - `REDIS_PORT`: Your Redis instance port
   - `REDIS_PASSWORD`: Your Redis instance password

### Environment Variables for Production

- `PORT`: Server port (Render uses 10000)
- `REDIS_HOST`: Redis server hostname
- `REDIS_PORT`: Redis server port
- `REDIS_PASSWORD`: Redis server password
- `YTDLP_PATH`: Custom yt-dlp binary path (optional)
- `FFMPEG_PATH`: Custom FFmpeg binary path (optional)

## Architecture

- **Express.js** - Web framework
- **Bull** - Queue management
- **Redis** - Queue storage and caching
- **yt-dlp-exec** - Video downloading
- **fluent-ffmpeg** - Video processing
- **UUID** - Job ID generation

## Queue System

The application uses Bull queues for background processing:

- `montage-generation` - Handles montage creation
- `reaction-generation` - Handles reaction video creation

Jobs are processed asynchronously with progress tracking and status updates.

## Error Handling

- Comprehensive error handling for video downloads
- Queue job failure handling
- API error responses with meaningful messages
- Logging for debugging and monitoring

## Security

- CORS enabled for cross-origin requests
- Input validation for all API endpoints
- File size limits for uploads
- Temporary file cleanup
# Updated Wed Jul 30 18:50:29 CEST 2025
