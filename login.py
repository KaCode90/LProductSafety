"""Registration, password verification, server-side sessions and authorization."""
import hashlib
import hmac
import os
import secrets
from datetime import timedelta
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, text, func, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from backend.store import Account, LoginSession, get_db, now, log

router = APIRouter()
ROLES = ['Admin', 'QA Manager', 'Product Safety Engineer', 'IQC', 'OQC', 'Supplier Quality', 'Auditor', 'Viewer']
COOKIE = 'ps_session'


def password_hash(password):
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f'scrypt${salt}${digest}'


def verify_password(password, encoded):
    try:
        _, salt, expected = encoded.split('$')
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def check_origin(request):
    origin = request.headers.get('origin')
    if origin and origin != str(request.base_url).rstrip('/'):
        raise HTTPException(403, 'Yêu cầu không cùng nguồn.')
    if request.headers.get('sec-fetch-site') == 'cross-site':
        raise HTTPException(403, 'Yêu cầu không cùng nguồn.')


def current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE, '')
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest()) if token else None
    user = db.get(Account, session.user_id) if session and session.expires > now() else None
    if not user or not user.active:
        raise HTTPException(401, 'Vui lòng đăng nhập.')
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        check_origin(request)
        if not hmac.compare_digest(request.headers.get('x-csrf-token', ''), session.csrf):
            raise HTTPException(403, 'Phiên không hợp lệ. Hãy tải lại trang.')
    request.state.session = session
    return user


def admin_user(user: Account = Depends(current_user)):
    if user.role != 'Admin':
        raise HTTPException(403, 'Cần quyền Admin.')
    return user


def profile(user):
    return {k: getattr(user, k) for k in ('id', 'email', 'name', 'employee_id', 'department', 'role', 'active')}


class Credentials(BaseModel):
    email: str = Field(min_length=5, max_length=254, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(min_length=10, max_length=128)


class Registration(Credentials):
    name: str = Field(min_length=2, max_length=120)
    employee_id: str = Field(min_length=1, max_length=80)
    department: str = Field(min_length=1, max_length=120)


@router.get('/login', include_in_schema=False)
def login_page():
    return FileResponse(Path(__file__).resolve().parent / 'login.html')


@router.post('/api/auth/register', status_code=201)
def register(body: Registration, request: Request, db: Session = Depends(get_db)):
    check_origin(request)
    # Serialize first-admin assignment across concurrent registrations.
    if db.bind.dialect.name == 'postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(73912061)'))
    first = db.scalar(select(func.count()).select_from(Account)) == 0
    user = Account(email=body.email.strip().lower(), name=body.name.strip(), employee_id=body.employee_id.strip(),
                   department=body.department.strip(), password_hash=password_hash(body.password), role='Admin' if first else 'Viewer', active=first)
    db.add(user)
    log(db, user.email, 'Đăng ký tài khoản', after={'role': user.role, 'active': user.active})
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Email đã được đăng ký.')
    return {'message': 'Tài khoản Admin đầu tiên đã được tạo. Bạn có thể đăng nhập.' if first else 'Đăng ký thành công. Chờ Admin kích hoạt tài khoản.', 'active': first}


@router.post('/api/auth/login')
def sign_in(body: Credentials, request: Request, response: Response, db: Session = Depends(get_db)):
    check_origin(request)
    user = db.scalar(select(Account).where(Account.email == body.email.strip().lower()).with_for_update())
    if user and user.locked_until and user.locked_until > now():
        raise HTTPException(429, 'Tài khoản tạm khóa 15 phút do đăng nhập sai nhiều lần.')
    valid = verify_password(body.password, user.password_hash) if user else verify_password(body.password, DUMMY_HASH)
    if not user or not valid:
        if user:
            user.failed += 1
            if user.failed >= 5:
                user.locked_until = now() + timedelta(minutes=15)
            db.commit()
        raise HTTPException(401, 'Email hoặc mật khẩu không đúng.')
    if not user.active:
        raise HTTPException(403, 'Tài khoản đang chờ Admin kích hoạt hoặc đã bị vô hiệu hóa.')
    user.failed = 0
    user.locked_until = None
    token = secrets.token_urlsafe(48)
    session = LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id, csrf=secrets.token_urlsafe(32), expires=now() + timedelta(hours=8))
    db.execute(delete(LoginSession).where(LoginSession.expires < now()))
    db.add(session)
    log(db, user.email, 'Đăng nhập')
    db.commit()
    response.set_cookie(COOKIE, token, httponly=True, secure=request.url.scheme == 'https' or os.getenv('PS_COOKIE_SECURE') == '1', samesite='strict', max_age=28800, path='/')
    return {'user': profile(user), 'csrf': session.csrf}


@router.get('/api/auth/me')
def me(request: Request, user: Account = Depends(current_user)):
    login_at = request.state.session.expires - timedelta(hours=8)
    return {'user': profile(user), 'csrf': request.state.session.csrf, 'login_at': login_at.isoformat() + 'Z'}


@router.post('/api/auth/logout')
def logout(request: Request, response: Response, user: Account = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(LoginSession).where(LoginSession.token_hash == request.state.session.token_hash))
    log(db, user.email, 'Đăng xuất')
    db.commit()
    response.delete_cookie(COOKIE, path='/')
    return {'ok': True}


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


@router.post('/api/auth/password')
def change_password(body: PasswordChange, user: Account = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(400, 'Mật khẩu hiện tại không đúng.')
    user.password_hash = password_hash(body.new_password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    log(db, user.email, 'Đổi mật khẩu; thu hồi các phiên đăng nhập')
    db.commit()
    return {'ok': True}


DUMMY_HASH = password_hash(secrets.token_urlsafe(24))
