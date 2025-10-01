# Parser Configurations for Generic Archive Spider

## Overview

The **Generic Archive Spider** is a pluggable parsing layer that enables rapid onboarding of Tier 2 artist-specific archives and setlist sources. Instead of writing custom spiders for each source, you can create a simple YAML configuration file that defines how to extract data from the site.

**Time savings**: Add new sources in **minutes** instead of **hours**.

## Quick Start

### 1. Create a YAML Configuration

Create a new YAML file in `scrapers/parser_configs/` following the schema defined in `SCHEMA.yaml`.

**Example**: `my_band_archive.yaml`

```yaml
source_name: "My Band Archive"
source_type: "artist_archive"
base_url: "https://mybandarchive.com"

selectors:
  tracklist_container:
    - "css:div.setlist"
  track_row:
    - "css:li.song"
  track_title:
    - "css:span.title::text"
  artist_name:
    - "css:span.artist::text"
  venue:
    - "css:h2.venue::text"
  date:
    - "css:time.date::text"

data_mapping:
  default_artist: "My Band"
  default_genre: "Rock"
  source_identifier: "my_band_archive"
```

### 2. Run the Spider

```bash
# Basic usage
scrapy crawl generic_archive -a config=my_band_archive -a start_url=https://mybandarchive.com/shows/2024-01-15

# With custom settings
scrapy crawl generic_archive \
  -a config=my_band_archive \
  -a start_url=https://mybandarchive.com/shows/2024-01-15 \
  -s DOWNLOAD_DELAY=3.0
```

### 3. Test and Iterate

The spider will:
- Extract tracks using your configured selectors
- Fall back to NLP extraction if selectors fail
- Validate extracted data
- Yield Scrapy items for database storage

## Configuration Schema

See `SCHEMA.yaml` for complete schema documentation. Key sections:

### Required Fields

- **source_name**: Human-readable name for the archive
- **source_type**: Type of archive (`artist_archive`, `venue_archive`, `festival_archive`, `dj_archive`)
- **base_url**: Base URL for resolving relative links
- **selectors**: CSS/XPath selectors for data extraction

### Selectors

Selectors are tried in order until one succeeds. Both CSS and XPath formats are supported.

**CSS Selector Format**:
```yaml
selectors:
  track_title:
    - "css:span.track-title::text"
    - "css:div.song-name::text"
```

**XPath Selector Format**:
```yaml
selectors:
  track_title:
    - "xpath://span[@class='track-title']/text()"
```

**Available Selectors**:
- `tracklist_container`: Container holding all tracks
- `track_row`: Individual track elements
- `track_title`: Track/song title
- `artist_name`: Artist name (per-track or page-level)
- `timestamp`: Track timestamp/position
- `venue`: Venue name (page-level)
- `date`: Event/show date (page-level)
- `setlist_name`: Setlist/show name (page-level)
- `notes`: Additional notes/description

### Regex Patterns

Clean and normalize extracted text using regex patterns:

```yaml
regex_patterns:
  clean_track_title:
    - pattern: "\\[.*?\\]"  # Remove bracketed content
      replace: ""
    - pattern: "^\\d+\\.\\s*"  # Remove track numbers
      replace: ""

  extract_timestamp:
    - pattern: "\\[?(\\d{1,2}:\\d{2}(?::\\d{2})?)\\]?"
      group: 1  # Extract capture group
```

**Available Pattern Types**:
- `clean_track_title`: Cleanup track title text
- `clean_artist_name`: Cleanup artist name text
- `extract_timestamp`: Extract timestamp from text
- `extract_date`: Extract date from text

### Data Mapping

Default values and transformations:

```yaml
data_mapping:
  default_artist: "Artist Name"  # Used when artist not found per-track
  default_genre: "Rock"  # Applied to all tracks
  source_identifier: "my_source"  # Database source tracking
  date_format: "%Y-%m-%d"  # Python strftime format
  extract_timestamps: true  # Attempt timestamp extraction
  enable_nlp_fallback: true  # Use NLP if selectors fail
```

### Pagination

Enable multi-page scraping:

```yaml
pagination:
  enabled: true
  next_page:
    - "css:a.next-page::attr(href)"
  max_pages: 10  # Safety limit
```

### Validation

Ensure data quality:

```yaml
validation:
  min_tracks: 5  # Minimum tracks required
  max_tracks: 200  # Maximum tracks allowed
  require_venue: true  # Venue required
  require_date: true  # Date required
```

### Rate Limiting

Respectful scraping:

```yaml
rate_limiting:
  download_delay: 2.0  # Seconds between requests
  randomize_delay: 0.3  # Randomization factor
  concurrent_requests: 1  # Max concurrent requests
```

## Example Configurations

### Phish.net Archive

```bash
scrapy crawl generic_archive -a config=phish_net \
  -a start_url=https://phish.net/setlists/phish-december-31-1995-madison-square-garden-new-york-ny-usa.html
```

### Panic Stream Archive

```bash
scrapy crawl generic_archive -a config=panic_stream \
  -a start_url=https://www.panicstream.com/vault/10-31-1998/
```

### Archive.org etree Collection

```bash
scrapy crawl generic_archive -a config=archive_org_etree \
  -a start_url=https://archive.org/details/gd1977-05-08.sbd.miller.97187.flac16
```

## Features

### 1. Flexible Selector Matching

The spider tries each selector in order until one succeeds:

```yaml
selectors:
  track_title:
    - "css:span.title::text"  # Try first
    - "css:div.song-name::text"  # Fallback
    - "xpath://span[@class='title']/text()"  # Last resort
```

### 2. NLP Fallback

If structured selectors fail, the spider automatically falls back to NLP extraction:

```python
# Automatic NLP fallback
if not tracks_data and enable_nlp_fallback:
    tracks_data = self.extract_via_nlp_sync(response.text, response.url)
```

### 3. Regex Text Cleanup

Clean and normalize extracted text:

```yaml
regex_patterns:
  clean_track_title:
    - pattern: "\\[EDIT\\]"
      replace: ""
    - pattern: "^\\d+\\.\\s*"
      replace: ""
```

### 4. Validation

Ensure extracted data meets quality standards:

```yaml
validation:
  min_tracks: 5
  max_tracks: 200
  require_venue: true
  require_date: true
```

### 5. Database Integration

The spider yields standard Scrapy items that are automatically stored in the database via `DatabasePipeline`:

- `EnhancedTrackItem`: Track/song information
- `EnhancedSetlistItem`: Setlist/show metadata
- `EnhancedTrackArtistItem`: Track-artist relationships
- `EnhancedSetlistTrackItem`: Setlist-track relationships
- `PlaylistItem`: Playlist for database storage

## Testing New Configurations

### 1. Test Selectors

Use Scrapy shell to test selectors before adding to config:

```bash
scrapy shell "https://example.com/setlist/123"
```

```python
# Test CSS selector
response.css('div.setlist li.song span.title::text').getall()

# Test XPath selector
response.xpath('//div[@class="setlist"]//li[@class="song"]//span[@class="title"]/text()').getall()
```

### 2. Test Configuration

Run spider with verbose logging:

```bash
scrapy crawl generic_archive \
  -a config=my_config \
  -a start_url=https://example.com/setlist/123 \
  -s LOG_LEVEL=DEBUG
```

### 3. Validate Output

Check spider statistics in logs:

```
==================== GENERIC ARCHIVE SPIDER COMPLETED ====================
Configuration: my_config
Pages scraped: 1
Setlists extracted: 1
Tracks extracted: 15
Validation failures: 0
==========================================================================
```

## Troubleshooting

### No Tracks Extracted

**Problem**: Spider reports "No tracks extracted"

**Solutions**:
1. Test selectors in Scrapy shell
2. Check if site structure has changed
3. Enable NLP fallback: `enable_nlp_fallback: true`
4. Check validation rules (may be too strict)

### Validation Failures

**Problem**: Spider reports validation failures

**Solutions**:
1. Check `min_tracks` and `max_tracks` limits
2. Set `require_venue: false` if venue not available
3. Set `require_date: false` if date not available
4. Review extracted data with `LOG_LEVEL=DEBUG`

### Incorrect Data Extraction

**Problem**: Extracted data is incomplete or incorrect

**Solutions**:
1. Add more specific selectors
2. Use regex patterns to clean text
3. Adjust `default_artist` in `data_mapping`
4. Test selectors in Scrapy shell

### Rate Limiting

**Problem**: Getting blocked or rate limited

**Solutions**:
1. Increase `download_delay` in rate_limiting
2. Reduce `concurrent_requests` to 1
3. Add `randomize_delay` for more human-like behavior
4. Check site's robots.txt

## Best Practices

### 1. Start with Specific Selectors

Use specific CSS selectors when possible:

```yaml
# Good - specific
track_title:
  - "css:div.setlist li.song span.title::text"

# Bad - too generic
track_title:
  - "css:span::text"
```

### 2. Provide Multiple Fallbacks

Add fallback selectors for reliability:

```yaml
track_title:
  - "css:span.track-title::text"  # Primary
  - "css:div.song-name::text"  # Fallback 1
  - "css:a.track-link::text"  # Fallback 2
  - "xpath://span[@class='track-title']/text()"  # Fallback 3
```

### 3. Use Regex for Cleanup

Clean extracted text with regex patterns:

```yaml
regex_patterns:
  clean_track_title:
    - pattern: "^\\d+\\.\\s*"  # Remove "1. ", "2. ", etc.
      replace: ""
    - pattern: "\\s{2,}"  # Collapse multiple spaces
      replace: " "
```

### 4. Set Conservative Rate Limits

Respect site resources:

```yaml
rate_limiting:
  download_delay: 2.0  # 2 seconds minimum
  randomize_delay: 0.3  # Add randomness
  concurrent_requests: 1  # One at a time
```

### 5. Enable NLP Fallback

Always enable NLP fallback for resilience:

```yaml
data_mapping:
  enable_nlp_fallback: true
```

### 6. Test Before Production

Always test configurations before production:

```bash
# Test with single URL first
scrapy crawl generic_archive -a config=my_config -a start_url=...

# Then test pagination
scrapy crawl generic_archive -a config=my_config -a start_url=... -s CLOSESPIDER_PAGECOUNT=5
```

## Advanced Usage

### Custom Date Formats

Specify custom date parsing:

```yaml
data_mapping:
  date_format: "%B %d, %Y"  # "January 15, 2024"
```

### Extract Multiple Data Formats

Use regex groups to extract specific formats:

```yaml
regex_patterns:
  extract_timestamp:
    - pattern: "\\[?(\\d{1,2}:\\d{2}(?::\\d{2})?)\\]?"
      group: 1  # Extract only the time part
```

### Pagination Limits

Control pagination crawling:

```yaml
pagination:
  enabled: true
  max_pages: 50  # Stop after 50 pages
```

## Contributing

### Adding New Configurations

1. Create YAML file in `scrapers/parser_configs/`
2. Follow schema in `SCHEMA.yaml`
3. Test thoroughly with real URLs
4. Document example URLs in metadata section
5. Submit PR with configuration

### Improving the Spider

The `GenericArchiveSpider` class is located at:
`scrapers/spiders/generic_archive_spider.py`

Key methods to extend:
- `_extract_tracks_structured()`: Improve selector matching
- `_validate_data()`: Add validation rules
- `_apply_regex_patterns()`: Enhance regex processing
- `_parse_date()`: Add date format support

## Support

### Common Issues

See [Troubleshooting](#troubleshooting) section above.

### Getting Help

1. Check spider logs with `LOG_LEVEL=DEBUG`
2. Test selectors in Scrapy shell
3. Review `SCHEMA.yaml` documentation
4. Check example configurations
5. Open GitHub issue with configuration and logs

## Limitations

### Current Limitations

1. **Single-page focus**: Best suited for single setlist/show pages
2. **List-based structures**: Works best with HTML lists/tables
3. **Text-based extraction**: Limited support for image-based content
4. **Date parsing**: Limited to common date formats

### Edge Cases

The spider may not work well with:
- JavaScript-rendered content (use Playwright middleware)
- Image-based setlists (requires OCR)
- Complex nested structures (may need custom spider)
- Authentication-required sites (add authentication middleware)

### When to Write a Custom Spider

Write a custom spider if:
- Site requires complex authentication
- Data requires multi-step extraction
- JavaScript rendering is essential
- Site has anti-bot protection
- Data structure is too complex for selectors

## Appendix

### Available Item Types

The spider yields these Scrapy items:

- **EnhancedTrackItem**: Track/song information
- **EnhancedSetlistItem**: Setlist/show metadata
- **EnhancedTrackArtistItem**: Track-artist relationships
- **EnhancedSetlistTrackItem**: Setlist-track relationships
- **PlaylistItem**: Playlist for database storage

### Selector Reference

#### CSS Selectors

```css
div.class              /* Element with class */
div#id                 /* Element with ID */
div > span             /* Direct child */
div span               /* Descendant */
div::text              /* Text content */
div::attr(href)        /* Attribute value */
div:first-child        /* First child */
div:contains("text")   /* Contains text */
```

#### XPath Selectors

```xpath
//div[@class='name']           /* Element with class */
//div[@id='name']              /* Element with ID */
//div/span                      /* Direct child */
//div//span                     /* Descendant */
//div/text()                    /* Text content */
//div/@href                     /* Attribute value */
//div[1]                        /* First element */
//div[contains(text(), "text")] /* Contains text */
```

### Regex Patterns Reference

```yaml
# Remove text
pattern: "\\[.*?\\]"
replace: ""

# Extract group
pattern: "(\\d{1,2}:\\d{2})"
group: 1

# Case-insensitive
pattern: "remix"
flags: "IGNORECASE"

# Multi-line
pattern: "^.*$"
flags: "MULTILINE"
```

---

**Last Updated**: 2025-10-01
**Maintainer**: SongNodes Team
**License**: MIT
