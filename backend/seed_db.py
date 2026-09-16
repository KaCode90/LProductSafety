from DB import engine
from models import Base, User, Material, ComplianceRecord, CAPA, FMDRecord, TRMRecord, XRFRecord
from sqlalchemy.orm import sessionmaker
from datetime import date

# Create tables
Base.metadata.create_all(bind=engine)

Session = sessionmaker(bind=engine)
session = Session()

# Check if admin exists
admin = session.query(User).filter_by(username='admin').first()
if not admin:
    admin = User(username='admin', password='123', role='admin', avatar_url='/static/default_avatar.svg')
    session.add(admin)
    session.commit()

# Ensure we have FMD, TRM, XRF mock data
session.query(FMDRecord).delete()
session.query(TRMRecord).delete()
session.query(XRFRecord).delete()

# Seed FMD
fmd1 = FMDRecord(material_code="Y0000001981", cas_no="25068-38-6", substance_name="Bisphenol A epoxy resin", composition_percent="60%", test_report="SHAEC26004709502", status="compliant")
fmd2 = FMDRecord(material_code="NRAW-00217", cas_no="141-78-6", substance_name="Ethyl acetate", composition_percent="15%", test_report="SHAEC26004709501", status="warning")
session.add_all([fmd1, fmd2])

# Seed TRM
trm1 = TRMRecord(material_code="Y0000001981", kind_of_test="RoHS", certification_code="SHAEC26004709502", test_method="IEC 62321", status="compliant")
session.add_all([trm1])

# Seed XRF
xrf1 = XRFRecord(part_code="Y0000001981", lot_no="L240101", br="ND", cl="150", cd="ND", pb="12", cr="ND", hg="ND", status="compliant")
xrf2 = XRFRecord(part_code="NRAW-00217", lot_no="L240105", br="ND", cl="900", cd="ND", pb="ND", cr="ND", hg="ND", status="warning")
session.add_all([xrf1, xrf2])

session.commit()
print("Database migrated and seeded successfully!")
