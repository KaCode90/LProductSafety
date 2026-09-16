from DB import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text("UPDATE ps_records SET module='cts-1' WHERE module='RSS'"))
    conn.commit()
