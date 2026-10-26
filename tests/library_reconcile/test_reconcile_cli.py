import pytest
import os
import csv
from unittest.mock import AsyncMock, patch, mock_open

from library.reconcile.cli import run_cli
from library.reconcile.match import Candidate

@pytest.mark.asyncio
async def test_run_cli():
    mock_conn = AsyncMock()

    lib_rows = [{"id": "lib-1", "artist_name": "Lib Artist", "track_title": "Lib Title", "isrc": "ISRC1", "musicbrainz_id": None}]
    sil_rows = [{"id": "sil-1", "artist_name": "Sil Artist", "track_title": "Sil Title", "isrc": "ISRC1", "musicbrainz_id": None}]

    # We patch the fetch function instead of conn.fetch directly, although mocking conn.fetch is better.
    # The instructions: "Test the CLI end to end with a fake conn whose fetch returns those rows".
    # Ok, let's mock conn.fetch to return the rows directly and NOT patch the query functions.
    mock_conn.fetch.side_effect = [lib_rows, sil_rows]

    with patch("builtins.open", mock_open()) as mock_file:

        await run_cli(mock_conn, "out.csv")

        # Verify conn.execute was never called
        mock_conn.execute.assert_not_called()

        # Verify it wrote to the file
        mock_file.assert_called_once_with("out.csv", "w", newline="", encoding="utf-8")
        handle = mock_file()

        # It should have written the header and one row
        handle.write.assert_any_call("library_id,silver_id,library_artist,library_title,silver_artist,silver_title,evidence\r\n")
        handle.write.assert_any_call("lib-1,sil-1,Lib Artist,Lib Title,Sil Artist,Sil Title,isrc_equality:ISRC1\r\n")
