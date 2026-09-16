import os
import threading
import webbrowser
import time
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, sessionmaker

from DB import engine
from models import Material, ComplianceRecord, CAPA, FMDRecord, TRMRecord, XRFRecord
from login import router as login_router

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI(title="Apple Product Safety API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(login_router)

# Mount static files
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")), name="static")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- API ROUTES ---
@app.get("/api/materials")
def get_materials(db: Session = Depends(get_db)):
    return db.query(Material).all()

@app.get("/api/materials/{material_id}")
def get_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if material is None:
        raise HTTPException(status_code=404, detail="Material not found")
    return material

@app.get("/api/materials/{material_id}/compliance")
def get_material_compliance(material_id: int, db: Session = Depends(get_db)):
    return db.query(ComplianceRecord).filter(ComplianceRecord.material_id == material_id).all()

@app.get("/api/capas")
def get_capas(db: Session = Depends(get_db)):
    return db.query(CAPA).all()

@app.get("/api/fmd")
def get_fmd(db: Session = Depends(get_db)):
    return db.query(FMDRecord).all()

@app.get("/api/trm")
def get_trm(db: Session = Depends(get_db)):
    return db.query(TRMRecord).all()

@app.get("/api/xrf")
def get_xrf(db: Session = Depends(get_db)):
    return db.query(XRFRecord).all()

# --- FRONTEND SERVING ---
template_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "index.html")
login_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "login.html")

@app.get("/")
def serve_frontend():
    if os.path.exists(template_path):
        return FileResponse(template_path)
    return {"message": "Frontend template not found at " + template_path}

@app.get("/login")
def serve_login():
    if os.path.exists(login_path):
        return FileResponse(login_path)
    return {"message": "Login template not found"}

def open_browser():
    time.sleep(1.5)
    webbrowser.open("http://localhost:8888/login")

if __name__ == "__main__":
    threading.Thread(target=open_browser, daemon=True).start()
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8888, reload=False)
