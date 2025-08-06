# Cloud-Based Montage Processing

The Montage Maker now supports both local script generation and cloud-based processing.

## Features

### Local Script Generation (Original)
- Generates bash scripts that users download and run locally
- No server-side video processing
- Users need FFmpeg and yt-dlp installed locally
- Privacy-focused - all processing happens on user's machine

### Cloud Processing (New)
- Processes videos directly on the server
- No local dependencies required
- Real-time progress tracking
- Direct download of finished montage
- Uses Vercel Blob storage for file hosting

## How to Use

1. **Toggle Processing Mode**: Use the switch in the UI to choose between:
   - "Local Script Generation" (default)
   - "Cloud Processing"

2. **Cloud Processing Workflow**:
   - Enter video URLs (YouTube or direct links)
   - Configure montage settings
   - Click "Generate Montage"
   - Watch real-time progress
   - Download finished montage when complete

3. **Local Script Workflow**:
   - Enter video URLs
   - Configure montage settings
   - Click "Generate Montage"
   - Download and run the generated script locally

## Technical Implementation

### Cloud Processing Components

1. **API Endpoint**: `/api/generate-montage-cloud`
   - Creates background jobs for processing
   - Returns job ID for status tracking

2. **Job Management**: `/api/job-status`
   - Tracks processing progress
   - Returns download URL when complete

3. **Video Processing**:
   - Downloads videos using yt-dlp-exec
   - Extracts clips using FFmpeg
   - Creates montage with text overlays
   - Uploads to Vercel Blob storage

4. **Dependencies**:
   - `yt-dlp-exec`: YouTube video downloading
   - `@vercel/blob`: File storage
   - FFmpeg: Video processing (downloaded dynamically)

### Environment Setup

For cloud processing to work, ensure:

1. **Vercel Blob Storage**: Configure environment variables
   ```env
   BLOB_READ_WRITE_TOKEN=your_token_here
   ```

2. **FFmpeg**: The system will automatically download FFmpeg binary

3. **yt-dlp**: Automatically handled by yt-dlp-exec package

## Benefits

### Cloud Processing
- ✅ No local setup required
- ✅ Real-time progress tracking
- ✅ Cross-platform compatibility
- ✅ Faster processing (server hardware)
- ❌ Requires internet connection
- ❌ Server processing costs
- ❌ Privacy concerns (videos processed on server)

### Local Script Generation
- ✅ Complete privacy
- ✅ No server costs
- ✅ Works offline (after script download)
- ✅ No processing timeouts
- ❌ Requires local setup
- ❌ Platform-specific dependencies
- ❌ User must manage their own processing

## Error Handling

The cloud processing includes comprehensive error handling:

- Video download failures
- FFmpeg processing errors
- Storage upload issues
- Timeout protection (10 minutes)
- Progress tracking with fallbacks

## Future Enhancements

- Multiple output formats
- Advanced video effects
- Batch processing
- Custom audio tracks
- Template-based montages
