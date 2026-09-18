import os
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Xác định thư mục gốc để tìm file .env
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
DB_CONNECT_TIMEOUT = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))

if not DATABASE_URL:
    raise ValueError("Không tìm thấy DATABASE_URL trong file .env")

connect_args = {}
if DATABASE_URL.startswith("postgresql"):
    connect_args["connect_timeout"] = DB_CONNECT_TIMEOUT

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
