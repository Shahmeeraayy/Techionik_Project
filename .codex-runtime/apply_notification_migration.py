from pathlib import Path
import sys
from sqlalchemy import create_engine, text

sys.path.append(str(Path('c:/Users/Tech/Desktop/NexusOps/app/backend').resolve()))
from app.core.config import DATABASE_URL

engine = create_engine(DATABASE_URL)
sql = Path('c:/Users/Tech/Desktop/NexusOps/app/backend/migrations/021_notifications_v1.sql').read_text(encoding='utf-8')
with engine.begin() as conn:
    conn.execute(text('CREATE EXTENSION IF NOT EXISTS pgcrypto;'))
    conn.execute(text(sql))
print('migration applied')
