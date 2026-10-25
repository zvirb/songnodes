import asyncio
import sys
import os

from common.datalayer.graph_projection import client, rebuild, reconcile
import asyncpg

def dsn() -> str:
    url = os.getenv('DATABASE_URL')
    if not url:
        user, host = os.getenv('POSTGRES_USER', 'musicdb_user'), os.getenv('POSTGRES_HOST', 'postgres')
        password = os.getenv('POSTGRES_PASSWORD') or os.getenv('DATABASE_PASSWORD') or ''
        url = f"postgresql://{user}:{password}@{host}:{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'musicdb')}"
    return url.replace('postgresql+asyncpg://', 'postgresql://', 1)

async def main():
    if len(sys.argv) < 2:
        print("Usage: python cli.py [rebuild|reconcile]")
        return

    command = sys.argv[1]

    conn = await asyncpg.connect(dsn())
    try:
        if command == "rebuild":
            print("Rebuilding graph projection...")
            res = await rebuild(conn)
            print(f"Rebuild complete. {res['rebuilt']} tracks processed.")
        elif command == "reconcile":
            repair = "--repair" in sys.argv
            print("Reconciling graph projection...")
            res = await reconcile(conn, repair=repair)
            print(f"Reconciliation result: {res}")
        else:
            print(f"Unknown command: {command}")
    finally:
        await conn.close()
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
