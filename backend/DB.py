import os
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Xác định thư mục gốc để tìm file .env
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("Không tìm thấy DATABASE_URL trong file .env")

engine = create_engine(DATABASE_URL)
