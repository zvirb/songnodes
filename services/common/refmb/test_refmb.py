import os
import pytest
import asyncpg
from services.common.refmb.settings import RefMBSettings, check_health
import subprocess

def test_settings_parsing():
    os.environ["MB_LOCAL_ENABLED"] = "true"
    os.environ["MB_LOCAL_PASSWORD"] = "secret123"
    settings = RefMBSettings.from_env()
    assert settings.enabled is True
    assert settings.get_password() == "secret123"

    # Check that password is not in repr
    assert "secret123" not in repr(settings)

    # File override
    with open("temp_pwd.txt", "w") as f:
        f.write("file_secret\n")

    os.environ["MB_LOCAL_PASSWORD_FILE"] = "temp_pwd.txt"
    assert settings.get_password() == "file_secret"

    os.remove("temp_pwd.txt")
    del os.environ["MB_LOCAL_PASSWORD_FILE"]
    del os.environ["MB_LOCAL_ENABLED"]
    del os.environ["MB_LOCAL_PASSWORD"]

@pytest.mark.asyncio
async def test_health_check_disabled():
    settings = RefMBSettings(enabled=False)
    result = await check_health(settings)
    assert result["enabled"] is False
    assert result["reachable"] is False

@pytest.mark.asyncio
async def test_health_check_unreachable():
    settings = RefMBSettings(enabled=True, host="invalid_host", port=12345)
    result = await check_health(settings)
    assert result["enabled"] is True
    assert result["reachable"] is False

def test_ddl_matches_inventory():
    inventory_path = os.path.join(
        os.path.dirname(__file__), "../../../docs/integration/ref_mb/schema_inventory.csv"
    )
    ddl_path = os.path.join(os.path.dirname(__file__), "ddl", "create_tables.sql")

    with open(ddl_path) as f:
        ddl_content = f.read()

    import csv, re
    with open(inventory_path, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['table'] in ['musicbrainz.recording', 'musicbrainz.artist', 'musicbrainz.artist_credit', 'musicbrainz.artist_credit_name', 'musicbrainz.artist_alias', 'musicbrainz.recording_alias', 'musicbrainz.isrc', 'musicbrainz.track', 'musicbrainz.medium', 'musicbrainz.release', 'musicbrainz.release_group', 'musicbrainz.release_label', 'musicbrainz.label', 'musicbrainz.release_country', 'musicbrainz.release_unknown_country', 'musicbrainz.country_area', 'musicbrainz.iso_3166_1', 'musicbrainz.area', 'musicbrainz.artist_gid_redirect', 'musicbrainz.recording_gid_redirect', 'musicbrainz.release_gid_redirect', 'musicbrainz.release_group_gid_redirect', 'musicbrainz.label_gid_redirect']:
                table_name = row['table'].replace("musicbrainz.", "")
                cols = row['columns_in_order'].split()

                # Find the create table block
                match = re.search(rf"CREATE TABLE ref_mb\.{table_name} \((.*?)\);", ddl_content, re.DOTALL)
                assert match, f"Table {table_name} not found in DDL"

                # Extract columns from DDL block
                ddl_cols = [line.strip().split()[0] for line in match.group(1).split(',\n') if line.strip()]
                assert cols == ddl_cols, f"Columns for {table_name} mismatch. Expected {cols}, found {ddl_cols}"

def test_migration_100_noop():
    up_path = os.path.join(os.path.dirname(__file__), "../../../sql/migrations/100_ref_mb_schema_up.sql")
    down_path = os.path.join(os.path.dirname(__file__), "../../../sql/migrations/100_ref_mb_schema_down.sql")

    with open(up_path) as f:
        up = f.read()
    with open(down_path) as f:
        down = f.read()

    assert "CREATE TABLE ref_mb." not in up
    assert "DROP SCHEMA IF EXISTS ref_mb" not in down
    assert "NO-OP" in up
    assert "NO-OP" in down
    assert "DECISION.md" in up
    assert "DECISION.md" in down

def test_no_other_migrations_create_ref_mb():
    try:
        output = subprocess.check_output(
            ["grep", "-rn", "CREATE SCHEMA.*ref_mb", "sql/migrations"],
            stderr=subprocess.STDOUT
        ).decode()
        # Ensure only the NO-OP or comment files mention it, or no output
        assert False, f"Found CREATE SCHEMA ref_mb outside allowed places: {output}"
    except subprocess.CalledProcessError:
        pass # grep returns 1 if no match found, which is what we want
