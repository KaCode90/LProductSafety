import sqlite3; db=sqlite3.connect('backend/data.sqlite'); print(db.execute('SELECT name FROM sqlite_master').fetchall())
