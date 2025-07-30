# Montage Maker v2

A web application for creating video montages and reaction videos with server-side processing.

## Features

- **Montage Generator**: Create video montages from multiple sources
  - Support for YouTube, Dropbox, Google Drive, and direct URLs
  - Fixed interval or BPM-based clip extraction
  - Sequential or grid layouts
  - Text overlays and copyright lines
  - Multiple resolution options

- **Reaction Video Generator**: Create split-screen reaction videos
  - Top/bottom video layout
  - Independent timing and volume control
  - Vertical 9:16 format for social media

## Architecture

- **Frontend**: Next.js 15 with React 19
- **Backend**: Node.js with Bull queue system
- **Video Processing**: FFmpeg with fluent-ffmpeg
- **Queue**: Redis with Bull/BullMQ
- **Storage**: Vercel Blob for processed videos
- **Deployment**: Render.com

## Local Development

### Prerequisites

- Node.js 18+
- FFmpeg
- Redis
- yt-dlp

### Installation

1. Clone the repository:
```bash
git clone https://github.com/joeydriftwood/montagemaker.git
cd montagemaker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add the following to `.env.local`:
```
REDIS_URL=redis://localhost:6379
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

4. Start Redis (if not already running):
```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis-server
```

5. Start the development server:
```bash
npm run dev
```

6. Start the worker (in a separate terminal):
```bash
npm run worker
```

## Deployment on Render

### 1. Connect to GitHub

1. Go to [Render.com](https://render.com)
2. Connect your GitHub account
3. Select the `montagemaker` repository

### 2. Deploy Services

The `render.yaml` file will automatically create:
- **Web Service**: Next.js application
- **Worker Service**: Background video processing
- **Redis Database**: Job queue storage

### 3. Environment Variables

Set the following environment variables in Render:

- `BLOB_READ_WRITE_TOKEN`: Your Vercel Blob storage token
- `NODE_ENV`: `production`

### 4. Deploy

1. Push your changes to GitHub
2. Render will automatically deploy the services
3. The worker will start processing video jobs

## API Endpoints

### Montage Generation

**POST** `/api/generate-montage`

Request body:
```json
{
  "videoUrls": ["https://youtube.com/watch?v=..."],
  "montageType": "fixed",
  "layoutType": "cut",
  "interval": 1,
  "montageLength": 30,
  "keepAudio": true,
  "resolution": "720p",
  "textOverlay": "My Montage",
  "addCopyrightLine": false
}
```

### Reaction Video Generation

**POST** `/api/generate-reaction`

Request body:
```json
{
  "topVideo": "https://youtube.com/watch?v=...",
  "bottomVideo": "https://youtube.com/watch?v=...",
  "topStartTime": 0,
  "bottomStartTime": 0,
  "duration": 60,
  "topVolume": 0.3,
  "bottomVolume": 1.0
}
```

### Job Status

**GET** `/api/job-status?jobId=<job_id>`

Response:
```json
{
  "status": "processing",
  "progress": 50,
  "message": "Extracting clips...",
  "downloadUrl": "https://..."
}
```

## File Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── page.tsx           # Main page
│   └── layout.tsx         # App layout
├── components/            # React components
│   ├── montage-generator.tsx
│   └── reaction-split-generator.tsx
├── lib/                   # Utility libraries
│   ├── queue.ts          # Bull queue setup
│   └── video-processor.ts # FFmpeg processing
├── worker.js             # Background worker
├── render.yaml           # Render deployment config
└── Dockerfile            # Worker container
```

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Ensure FFmpeg is installed and in PATH
2. **Redis connection failed**: Check Redis URL and connection
3. **Video download failed**: Verify video URLs are accessible
4. **Queue jobs not processing**: Ensure worker is running

### Logs

- **Web Service**: Check Render logs for API errors
- **Worker Service**: Check worker logs for processing errors
- **Redis**: Monitor Redis for queue issues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details # Updated Wed Jul 30 17:25:48 CEST 2025
