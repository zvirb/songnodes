#!/usr/bin/env python3
"""
Batch Scraper for All Discovered MixesDB Playlists
Processes all 20 playlists discovered in Phase 1
"""
import subprocess
import time
from datetime import datetime

# All 20 discovered MixesDB playlist URLs
PLAYLIST_URLS = [
    "https://www.mixesdb.com/w/2013-12-30_-_Eddie_Halliwell_-_Fire_It_Up_(FIUR_235)_(Best_Of_2013)",
    "https://www.mixesdb.com/w/2013-10-02_-_Martin_Solveig_@_1Live_-_Zweiter.Zehnter,_Nachtresidenz,_D%C3%BCsseldorf",
    "https://www.mixesdb.com/w/2023-12-08_-_DJ_Percy_-_Energy_Bremen_Mastermix",
    "https://www.mixesdb.com/w/2020-11-14_-_Steve_Smart,_Justin_Wilkes_-_Saturday_Night_KISSTORY",
    "https://www.mixesdb.com/w/2014-03-28_-_Ti%C3%ABsto_@_Ultra_Music_Festival,_WMC",
    "https://www.mixesdb.com/w/2014-03-29_-_Martin_Garrix_@_Ultra_Music_Festival,_WMC",
    "https://www.mixesdb.com/w/2013-07-21_-_Moguai,_Afrojack,_Monoloc_-_1Live_Rocker",
    "https://www.mixesdb.com/w/2019-04-20_-_Steve_Norton,_Claptone,_David_Guetta,_Joris_Voorn_-_Big_City_Beats,_KroneHit",
    "https://www.mixesdb.com/w/2013-12-27_-_Fedde_Le_Grand_-_Dark_Light_Session_074_(Yearmix)",
    "https://www.mixesdb.com/w/2013_-_tyDi_@_Beta_Nightclub,_Denver_(Global_Soundsystem_204)",
    "https://www.mixesdb.com/w/2023-05-19_-_Keanu_Silva_-_Energy_Bremen_Mastermix",
    "https://www.mixesdb.com/w/2023-07-21_-_Keanu_Silva_-_Energy_Bremen_Mastermix",
    "https://www.mixesdb.com/w/2022-12-09_-_DJ_Percy_-_Energy_Bremen_Mastermix",
    "https://www.mixesdb.com/w/2015-03-28_-_Martin_Garrix_@_Ultra_Music_Festival,_Bayfront_Park,_WMC",
    "https://www.mixesdb.com/w/2020-04-28_-_Dom_Dolla,_Solardo,_Ryan_Marciano,_Laidback_Luke_@_Tomorrowland_-_United_Through_Music_Week_5",
    "https://www.mixesdb.com/w/2013-08-17_-_Coone_@_Decibel_Outdoor",
    "https://www.mixesdb.com/w/2015-03-08_-_Moguai,_Galantis,_Adam_Port_-_1Live_Rocker",
    "https://www.mixesdb.com/w/2024-01-13_-_DJ_Percy_-_Energy_Bremen_Mastermix",
    "https://www.mixesdb.com/w/2015-12-12_-_Gigi_D%27Agostino_@_Disco_Play,_Kreams,_Austria",
    "https://www.mixesdb.com/w/2015-12-25_-_Gigi_D%27Agostino_@_Supersonic_Music_Arena,_San_Biagio_di_Callalta,_Italy"
]

def run_batch_scrape():
    """Execute batch scraping for all playlists"""
    print(f"{'='*80}")
    print(f"BATCH SCRAPING: All 20 MixesDB Playlists")
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")

    # Join all URLs with commas for the start_urls parameter
    urls_string = ','.join(PLAYLIST_URLS)

    print(f"📋 Processing {len(PLAYLIST_URLS)} playlists...")
    print(f"⏱️  Estimated time: ~{len(PLAYLIST_URLS) * 1} minutes (with 15s rate limiting)\n")

    # Build the scrapy command
    cmd = [
        'scrapy', 'crawl', 'mixesdb',
        '-a', f'start_urls={urls_string}'
    ]

    print(f"🚀 Launching spider...\n")
    print(f"Command: {' '.join(cmd[:4])} -a start_urls=<{len(PLAYLIST_URLS)} URLs>\n")

    start_time = time.time()

    # Execute the scraping job
    try:
        result = subprocess.run(
            cmd,
            capture_output=False,  # Let output stream to console
            text=True,
            check=True
        )

        duration = time.time() - start_time

        print(f"\n{'='*80}")
        print(f"✅ BATCH SCRAPING COMPLETE")
        print(f"Duration: {duration:.1f} seconds ({duration/60:.1f} minutes)")
        print(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*80}")

        return True

    except subprocess.CalledProcessError as e:
        print(f"\n❌ BATCH SCRAPING FAILED")
        print(f"Error: {e}")
        return False

if __name__ == '__main__':
    success = run_batch_scrape()
    exit(0 if success else 1)
