# MixesDB Scraper Documentation

## Overview

The enhanced MixesDB scraper is designed to collect comprehensive DJ mix information from MixesDB.com while respecting the website's robots.txt and implementing polite crawling practices.

## Features

### Data Extraction
- **DJ Mix Information**: Artist names, event details, venue information
- **Tracklist Data**: Complete track listings with timing information
- **Genre Classification**: Music styles and genre categorization
- **Metadata**: Release dates, labels, mix duration, descriptions
- **Relationship Mapping**: Artist-track relationships, featured artists, remixers

### Crawling Features
- **Robots.txt Compliance**: Respects 4-second crawl delay and disallowed paths
- **Pagination Support**: Automatically discovers and crawls category pages
- **Error Handling**: Comprehensive retry logic with exponential backoff
- **Rate Limiting**: Built-in throttling to prevent overwhelming the server
- **User Agent Rotation**: Polite identification with occasional rotation

### Output Formats
- **CSV Files**: Structured data export for easy analysis
- **Normalized Data**: Clean, consistent formatting
- **Relationship Tables**: Separate files for complex relationships

## Usage

### Basic Usage

```bash
# Scrape specific example URLs (default mode)
scrapy crawl mixesdb

# Browse and discover mixes from category pages
scrapy crawl mixesdb -a start_mode=browse

# Limit output for testing
scrapy crawl mixesdb -s CLOSESPIDER_ITEMCOUNT=10
```

### Advanced Options

```bash
# Enable debug logging
scrapy crawl mixesdb -s LOG_LEVEL=DEBUG

# Custom output directory
scrapy crawl mixesdb -s FEEDS='{"output/custom_mixesdb.json": {"format": "json"}}'

# Increase politeness (slower but safer)
scrapy crawl mixesdb -s DOWNLOAD_DELAY=8
```

## Configuration

### Respecting Robots.txt

The scraper automatically:
- Fetches and respects robots.txt rules
- Implements required 4-second crawl delay
- Avoids disallowed paths (`/db/`, `/tools/`, etc.)
- Uses appropriate user agent identification

### Polite Crawling Settings

```python
# Key settings for polite crawling
DOWNLOAD_DELAY = 4                    # Respect robots.txt requirement
CONCURRENT_REQUESTS = 1               # Single thread
RANDOMIZE_DOWNLOAD_DELAY = 0.5        # Add randomization
AUTOTHROTTLE_ENABLED = True           # Dynamic throttling
```

## Output Files

### setlists.csv
Contains main mix information:
- `setlist_name`: Name of the DJ set/mix
- `dj_artist_name`: Primary DJ/artist
- `event_name`: Event or show name
- `venue_name`: Performance venue
- `set_date`: Date of the performance
- `genre`: Music genre/style
- `label`: Record label
- `duration`: Mix duration (HH:MM:SS)
- `mix_type`: Type (DJ Mix, Radio Show, Podcast, etc.)
- `description`: Mix description
- `source_url`: Original MixesDB URL

### tracks.csv
Individual track information:
- `track_name`: Name of the track
- `is_remix`: Boolean indicating if it's a remix
- `is_mashup`: Boolean indicating if it's a mashup
- `mashup_components`: JSON array of mashup components
- `track_type`: Always "Setlist" for MixesDB data

### trackartists.csv
Artist-track relationships:
- `track_name`: Track identifier
- `artist_name`: Artist name
- `artist_role`: Role (primary, featured, remixer)

### setlisttracks.csv
Track order within sets:
- `setlist_name`: Set identifier
- `track_name`: Track identifier
- `track_order`: Position in the set
- `start_time`: Timestamp within the mix (if available)

## Error Handling

### Automatic Retries
- HTTP errors (5xx, 4xx)
- Network timeouts
- Rate limiting responses
- Inaccessible pages

### Graceful Degradation
- Continues scraping even if some pages fail
- Logs warnings for missing data
- Handles malformed HTML gracefully

### Logging
```bash
# View scraping progress
tail -f scrapy.log

# Check for errors
grep ERROR scrapy.log

# Monitor rate limiting
grep "rate limit" scrapy.log
```

## Testing

Run the test suite to validate functionality:

```bash
python test_mixesdb_scraper.py
```

The test suite checks:
- Robots.txt compliance
- Basic scraping functionality
- Output file generation
- Browse mode operation

## Best Practices

### Responsible Scraping
1. **Respect robots.txt**: Always check and follow the rules
2. **Use delays**: Don't overwhelm the server
3. **Monitor logs**: Watch for errors or rate limiting
4. **Limit scope**: Start with small tests before large crawls
5. **Cache results**: Avoid re-scraping the same content

### Data Quality
1. **Validate output**: Check CSV files for completeness
2. **Handle duplicates**: Use set tracking to avoid re-processing
3. **Clean data**: Normalize artist names and track titles
4. **Preserve relationships**: Maintain artist-track-set connections

### Performance Optimization
1. **Use filters**: Focus on specific genres or time periods
2. **Implement caching**: Store successfully scraped URLs
3. **Monitor memory**: Large crawls can consume significant RAM
4. **Regular checkpoints**: Save progress periodically

## Troubleshooting

### Common Issues

**403 Forbidden errors**
- Check user agent string
- Verify robots.txt compliance
- Increase delay between requests

**Empty output files**
- Check CSS selectors against current page structure
- Verify start URLs are accessible
- Review error logs for parsing issues

**Rate limiting**
- Increase DOWNLOAD_DELAY setting
- Reduce CONCURRENT_REQUESTS
- Add random delays

**Memory issues**
- Limit CLOSESPIDER_ITEMCOUNT
- Process in smaller batches
- Clear caches regularly

### Debug Mode

```bash
# Run with maximum verbosity
scrapy crawl mixesdb -s LOG_LEVEL=DEBUG -L DEBUG

# Save responses for inspection
scrapy crawl mixesdb -s HTTPCACHE_ENABLED=True
```

## Legal and Ethical Considerations

1. **Terms of Service**: Review MixesDB's terms before large-scale scraping
2. **Rate Limiting**: Always respect server resources
3. **Data Usage**: Use scraped data responsibly and legally
4. **Attribution**: Credit MixesDB as the data source
5. **Fair Use**: Follow fair use guidelines for data collection

## Contributing

To improve the scraper:
1. Test thoroughly before submitting changes
2. Update documentation for new features
3. Maintain robots.txt compliance
4. Add unit tests for new functionality
5. Follow existing code style and patterns

## Support

For issues or questions:
1. Check the logs for error messages
2. Run the test suite to identify problems
3. Review this documentation
4. Check MixesDB's robots.txt for any changes
5. Consult Scrapy documentation for framework issues