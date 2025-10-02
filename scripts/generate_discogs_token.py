#!/usr/bin/env python3
"""
Discogs OAuth 1.0a Token Generator

This script helps you obtain a personal access token for the Discogs API.
It uses the OAuth 1.0a flow which requires manual browser authorization.
"""

import sys
import os
from requests_oauthlib import OAuth1Session

# Get Discogs OAuth credentials from environment variables
CONSUMER_KEY = os.getenv('DISCOGS_CONSUMER_KEY')
CONSUMER_SECRET = os.getenv('DISCOGS_CONSUMER_SECRET')

if not CONSUMER_KEY or not CONSUMER_SECRET:
    print("❌ ERROR: Discogs OAuth credentials not set")
    print("Please set the following environment variables in your .env file:")
    print("  DISCOGS_CONSUMER_KEY=your_consumer_key")
    print("  DISCOGS_CONSUMER_SECRET=your_consumer_secret")
    sys.exit(1)

# Discogs OAuth endpoints
REQUEST_TOKEN_URL = 'https://api.discogs.com/oauth/request_token'
AUTHORIZE_URL = 'https://www.discogs.com/oauth/authorize'
ACCESS_TOKEN_URL = 'https://api.discogs.com/oauth/access_token'


def main():
    print("=" * 70)
    print("Discogs OAuth 1.0a Personal Access Token Generator")
    print("=" * 70)
    print()

    # Step 1: Obtain request token
    print("Step 1: Obtaining request token...")
    oauth = OAuth1Session(CONSUMER_KEY, client_secret=CONSUMER_SECRET)

    try:
        fetch_response = oauth.fetch_request_token(REQUEST_TOKEN_URL)
    except Exception as e:
        print(f"❌ Error obtaining request token: {e}")
        sys.exit(1)

    resource_owner_key = fetch_response.get('oauth_token')
    resource_owner_secret = fetch_response.get('oauth_token_secret')

    print(f"✓ Request token obtained: {resource_owner_key[:20]}...")
    print()

    # Step 2: Get user authorization
    print("Step 2: User Authorization Required")
    print("-" * 70)
    authorization_url = f"{AUTHORIZE_URL}?oauth_token={resource_owner_key}"
    print(f"Please visit this URL in your browser to authorize the application:")
    print()
    print(f"  {authorization_url}")
    print()
    print("After authorizing, you'll be shown a verification code.")
    print("-" * 70)

    oauth_verifier = input("Enter the verification code here: ").strip()
    print()

    # Step 3: Exchange for access token
    print("Step 3: Exchanging for access token...")
    oauth = OAuth1Session(
        CONSUMER_KEY,
        client_secret=CONSUMER_SECRET,
        resource_owner_key=resource_owner_key,
        resource_owner_secret=resource_owner_secret,
        verifier=oauth_verifier
    )

    try:
        oauth_tokens = oauth.fetch_access_token(ACCESS_TOKEN_URL)
    except Exception as e:
        print(f"❌ Error obtaining access token: {e}")
        sys.exit(1)

    access_token = oauth_tokens.get('oauth_token')
    access_token_secret = oauth_tokens.get('oauth_token_secret')

    print("✓ Access token obtained successfully!")
    print()
    print("=" * 70)
    print("YOUR DISCOGS ACCESS CREDENTIALS")
    print("=" * 70)
    print(f"Access Token:        {access_token}")
    print(f"Access Token Secret: {access_token_secret}")
    print()
    print("Add these to your .env file:")
    print("-" * 70)
    print(f"DISCOGS_ACCESS_TOKEN={access_token}")
    print(f"DISCOGS_ACCESS_TOKEN_SECRET={access_token_secret}")
    print("=" * 70)
    print()
    print("⚠️  Keep these credentials secure - treat them like passwords!")


if __name__ == "__main__":
    main()