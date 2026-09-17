import sys
import os
sys.path.append(os.getcwd())
from backend.dashboard import router
from backend.store import SessionLocal, Account
from sqlalchemy import select

db = SessionLocal()
user = db.scalar(select(Account).where(Account.email == 'admin@nano.com'))
if not user:
    user = db.scalar(select(Account).limit(1))

if not user:
    print('No user')
    sys.exit(0)

try:
    from backend.dashboard import overview
    res = overview(user=user, db=db)
    print('Overview returned successfully')
except Exception as e:
    import traceback
    traceback.print_exc()
