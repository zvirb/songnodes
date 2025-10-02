#!/usr/bin/env python3
"""
Playwright inspector to identify CSS selectors for tracklist extraction
"""
import asyncio
from playwright.async_api import async_playwright

async def inspect_mixesdb():
    """Inspect MixesDB tracklist page to find track selectors"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        # Navigate to a known Fred again.. tracklist
        url = "https://www.mixesdb.com/w/2023-04-23_-_Four_Tet_b2b_Fred_Again.._b2b_Skrillex_@_Coachella_Festival,_Indio,_California"
        print(f"Loading: {url}")
        await page.goto(url, wait_until='networkidle')

        # Wait for user to inspect
        print("\n=== MixesDB Page Loaded ===")
        print("Open DevTools (F12) and inspect the tracklist structure")
        print("Look for:")
        print("  1. Container element holding all tracks")
        print("  2. Individual track elements")
        print("  3. Artist name selector")
        print("  4. Track title selector")
        print("  5. Track position/number selector")
        print("\nPress Enter when done inspecting...")

        # Try to find tracklist container automatically
        # Common patterns: table, ul, ol, div with class containing 'track', 'list', 'tracklist'
        containers = await page.query_selector_all("table, ul, ol, div[class*='track'], div[class*='list']")
        print(f"\nFound {len(containers)} potential tracklist containers")

        for i, container in enumerate(containers[:5]):  # Check first 5
            html = await container.inner_html()
            if len(html) > 200:  # Likely contains content
                tag = await container.evaluate("el => el.tagName")
                classes = await container.evaluate("el => el.className")
                print(f"\nContainer {i+1}: <{tag.lower()} class='{classes}'>")
                print(f"  HTML length: {len(html)} chars")

        input()
        await browser.close()

async def inspect_1001tracklists():
    """Inspect 1001tracklists page to find track selectors"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        # Navigate to a known tracklist
        url = "https://www.1001tracklists.com/tracklist/2kdxrv91/fisher-ultra-music-festival-miami-united-states-2024-03-23.html"
        print(f"Loading: {url}")
        await page.goto(url, wait_until='networkidle')

        print("\n=== 1001tracklists Page Loaded ===")
        print("Open DevTools (F12) and inspect the tracklist structure")
        print("Look for:")
        print("  1. Container element holding all tracks")
        print("  2. Individual track elements")
        print("  3. Artist name selector")
        print("  4. Track title selector")
        print("  5. Track metadata (label, time, etc.)")
        print("\nPress Enter when done inspecting...")

        # Try to find tracklist container
        containers = await page.query_selector_all("table, ul, ol, div[class*='track'], div[class*='list'], div[id*='track']")
        print(f"\nFound {len(containers)} potential tracklist containers")

        for i, container in enumerate(containers[:5]):
            html = await container.inner_html()
            if len(html) > 200:
                tag = await container.evaluate("el => el.tagName")
                classes = await container.evaluate("el => el.className")
                elem_id = await container.evaluate("el => el.id")
                print(f"\nContainer {i+1}: <{tag.lower()} id='{elem_id}' class='{classes}'>")
                print(f"  HTML length: {len(html)} chars")

        input()
        await browser.close()

async def main():
    print("=== Tracklist CSS Selector Inspector ===\n")
    print("1. Inspect MixesDB")
    print("2. Inspect 1001tracklists")
    print("3. Both (sequential)")
    choice = input("\nChoice (1-3): ").strip()

    if choice == '1':
        await inspect_mixesdb()
    elif choice == '2':
        await inspect_1001tracklists()
    elif choice == '3':
        await inspect_mixesdb()
        await inspect_1001tracklists()
    else:
        print("Invalid choice")

if __name__ == "__main__":
    asyncio.run(main())
