"""Application-owned tables. Existing material tables are never cleared or altered."""
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, DateTime, JSON, Boolean, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from backend.DB import engine


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AppBase(DeclarativeBase):
    pass


class Account(AppBase):
    __tablename__ = 'ps_accounts'
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    employee_id: Mapped[str] = mapped_column(String(80), default='')
    department: Mapped[str] = mapped_column(String(120), default='QA')
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(80), default='Viewer')
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class LoginSession(AppBase):
    __tablename__ = 'ps_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('ps_accounts.id'))
    csrf: Mapped[str] = mapped_column(String(128))
    expires: Mapped[datetime] = mapped_column(DateTime)


class Record(AppBase):
    __tablename__ = 'ps_records'
    id: Mapped[int] = mapped_column(primary_key=True)
    module: Mapped[str] = mapped_column(String(80), index=True)
    source_key: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Evidence(AppBase):
    __tablename__ = 'ps_evidence'
    id: Mapped[int] = mapped_column(primary_key=True)
    record_id: Mapped[int] = mapped_column(ForeignKey('ps_records.id'), index=True)
    name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(80))
    mime: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(Integer)
    checksum: Mapped[str] = mapped_column(String(64))
    uploader: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Audit(AppBase):
    __tablename__ = 'ps_audit'
    id: Mapped[int] = mapped_column(primary_key=True)
    record_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    actor: Mapped[str] = mapped_column(String(254))
    action: Mapped[str] = mapped_column(String(160))
    before: Mapped[dict] = mapped_column(JSON, default=dict)
    after: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ImportLog(AppBase):
    __tablename__ = 'ps_imports'
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), unique=True)
    checksum: Mapped[str] = mapped_column(String(64))
    summary: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Setting(AppBase):
    __tablename__ = 'ps_settings'
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        yield db


def log(db, actor, action, record_id=None, before=None, after=None):
    db.add(Audit(actor=actor, action=action, record_id=record_id, before=before or {}, after=after or {}))
