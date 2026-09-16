from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False) # In real app, this should be hashed
    role = Column(String(50), default='user')
    avatar_url = Column(String(255), default='/static/default_avatar.svg')

class Material(Base):
    __tablename__ = 'materials'
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    supplier = Column(String(255))
    manufacturer = Column(String(255))
    material_type = Column(String(100))
    project = Column(String(255))
    category = Column(String(100))
    cts_category = Column(String(100))
    status = Column(String(50), default='pending')
    expiry_date = Column(Date)
    dri = Column(String(100))
    last_update = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    compliance_records = relationship("ComplianceRecord", back_populates="material", cascade="all, delete")

class ComplianceRecord(Base):
    __tablename__ = 'compliance_records'
    id = Column(Integer, primary_key=True, autoincrement=True)
    material_id = Column(Integer, ForeignKey('materials.id'), nullable=False)
    report_type = Column(String(100))
    report_id = Column(String(100))
    lab = Column(String(255))
    issue_date = Column(Date)
    expiry_date = Column(Date)
    status = Column(String(50))
    file_url = Column(String(500))
    uploader = Column(String(100))
    material = relationship("Material", back_populates="compliance_records")

class FMDRecord(Base):
    __tablename__ = 'fmd_records'
    id = Column(Integer, primary_key=True, autoincrement=True)
    material_code = Column(String(50))
    cas_no = Column(String(50))
    substance_name = Column(String(255))
    composition_percent = Column(String(50))
    test_report = Column(String(255))
    status = Column(String(50))

class TRMRecord(Base):
    __tablename__ = 'trm_records'
    id = Column(Integer, primary_key=True, autoincrement=True)
    material_code = Column(String(50))
    kind_of_test = Column(String(100))
    certification_code = Column(String(100))
    test_method = Column(String(100))
    status = Column(String(50))

class XRFRecord(Base):
    __tablename__ = 'xrf_records'
    id = Column(Integer, primary_key=True, autoincrement=True)
    part_code = Column(String(50))
    lot_no = Column(String(50))
    br = Column(String(20))
    cl = Column(String(20))
    cd = Column(String(20))
    pb = Column(String(20))
    cr = Column(String(20))
    hg = Column(String(20))
    status = Column(String(50))

class CAPA(Base):
    __tablename__ = 'capas'
    id = Column(String(50), primary_key=True)
    ncr_rel = Column(String(50))
    issue = Column(Text)
    root_cause = Column(Text)
    action = Column(Text)
    dri = Column(String(100))
    target_date = Column(Date)
    status = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
