# Tidal Integration for SongNodes

This guide explains how to test and use the Tidal integration functionality in SongNodes.

## Overview

The Tidal integration provides:
- User authentication with Tidal accounts
- Track availability checking against Tidal's catalog
- Playlist creation and management
- Setlist export to Tidal playlists

## Architecture

```
Frontend (React/TypeScript)
├── TidalPlaylistManager.tsx - UI for playlist management
├── SettingsPanel.tsx - Credential management
└── Store (Zustand) - State management

Backend (Python/FastAPI)
├── tidal_service_api.py - REST API endpoints
├── tidal_api_client.py - Tidal API wrapper
└── database_pipeline.py - Database operations
```

## Setup Instructions

### 1. Install Dependencies

Make sure you have the required dependencies:

```bash
cd scrapers
pip install -r requirements.txt
```

### 2. Start the Tidal Service

Start the backend API service:

```bash
cd scrapers
python start_tidal_service.py
```

The service will be available at:
- API: http://localhost:8085
- Docs: http://localhost:8085/docs
- Health: http://localhost:8085/health

### 3. Configure Frontend

Start the frontend development server:

```bash
cd frontend
npm install
npm run dev
```

## Usage Instructions

### 1. Authenticate with Tidal

1. Open the SongNodes DJ interface
2. Switch to "📚 Librarian" mode
3. Click the "🎵 Tidal Playlists" tab in the right panel
4. Click "Connect to Tidal" button
5. A browser will open - complete OAuth authentication there
6. Return to SongNodes - it will detect the completed authentication

### 2. Access Tidal Features

1. Switch to "📚 Librarian" mode
2. Click the "🎵 Tidal Playlists" tab in the right panel
3. You'll see:
   - Authentication status
   - Current setlist track availability on Tidal
   - Playlist creation tools
   - Your existing Tidal playlists

### 3. Create Playlists

**From Current Setlist:**
1. Create a setlist in SongNodes
2. Navigate to Tidal Playlists tab
3. Enter a playlist name
4. Click "Create from Setlist"

**Empty Playlist:**
1. Enter playlist name and description
2. Click "Create Empty Playlist"

### 4. Track Availability

The integration automatically checks track availability by:
- Artist and track name matching
- ISRC code matching (when available)
- Fuzzy matching for close results

Availability is shown with:
- Green indicator: Available on Tidal
- Red indicator: Not available
- Progress bar showing percentage available

## API Endpoints

### Authentication
- `POST /auth/login` - Authenticate with Tidal
- `POST /auth/test` - Test credentials without storing
- `GET /auth/status` - Check authentication status

### Track Operations
- `POST /tracks/search` - Search for tracks
- `POST /tracks/check-availability` - Check single track availability
- `POST /tracks/bulk-availability-check` - Bulk availability checking

### Playlist Operations
- `POST /playlists/create` - Create empty playlist
- `GET /playlists/list` - List user playlists
- `POST /playlists/from-setlist` - Create playlist from setlist
- `POST /playlists/{id}/add-tracks` - Add tracks to playlist

### Statistics
- `GET /stats/availability` - Get availability statistics

## Configuration

### Environment Variables

You can configure the database connection:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=songnodes
export DB_USER=postgres
export DB_PASSWORD=password
```

### Frontend API Base URL

The frontend connects to the Tidal service at:
```javascript
const TIDAL_API_BASE = 'http://localhost:8085';
```

## Troubleshooting

### Authentication Issues
- Verify your Tidal credentials are correct
- Check that Tidal service is running on port 8085
- Look at browser console for connection errors

### Database Issues
- Ensure PostgreSQL is running and accessible
- Check database credentials in environment variables
- Verify database schema includes required tables

### Connection Issues
- Check that backend service is running
- Verify no firewall blocking port 8085
- Ensure frontend can reach backend API

## Development Notes

### Adding New Features

To extend the Tidal integration:

1. **Backend**: Add new endpoints in `tidal_service_api.py`
2. **Client**: Add new methods in `tidal_api_client.py`
3. **Frontend**: Update `TidalPlaylistManager.tsx`
4. **Types**: Update interfaces in `types/index.ts`

### Testing

Test the integration:

1. Start services: `python start_tidal_service.py`
2. Open frontend and configure Tidal credentials
3. Create a setlist with some tracks
4. Check track availability in Tidal tab
5. Create a playlist from the setlist
6. Verify playlist appears in your Tidal account

### Security Considerations

- Credentials are stored in localStorage with base64 encoding
- Consider implementing stronger encryption for production
- Add rate limiting for API endpoints
- Validate all user inputs

## Future Enhancements

Potential improvements:
- Real-time playlist sync
- Collaborative playlist editing
- Advanced search filters
- Playlist analytics
- Integration with other music services