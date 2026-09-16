import os
import sys
from docx import Document
from backend.DB import engine
from backend.store import Record, SessionLocal, AppBase
from sqlalchemy import delete

AppBase.metadata.create_all(engine)

doc_path = r"D:\Linh\LProductSafety\NTV-QA02-P005 V03 Product Safety Management V03.docx"
try:
    doc = Document(doc_path)
except Exception as e:
    print(f"Error opening document: {e}")
    sys.exit(1)

table_indices = [4, 8, 10, 11, 12]
rss_data = []

for idx in table_indices:
    table = doc.tables[idx]
    
    # Skip header
    for i, row in enumerate(table.rows):
        if i == 0:
            continue
            
        cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
        if len(cells) < 4:
            continue
            
        chemical_group = cells[0]
        cas_no = cells[1]
        limit = cells[2]
        scope = cells[3] if len(cells) > 3 else ""
        example = cells[4] if len(cells) > 4 else ""
        
        # Avoid empty rows or repeated headers
        if not chemical_group or "Chemical or Chemical Group" in chemical_group:
            continue
            
        rss_data.append({
            "chemical_group": chemical_group,
            "cas_no": cas_no,
            "limit": limit,
            "scope": scope,
            "example": example
        })

print(f"Extracted {len(rss_data)} substances.")

# Store in DB
with SessionLocal() as db:
    # Delete old RSS data
    db.execute(delete(Record).where(Record.module == 'RSS'))
    
    for i, item in enumerate(rss_data):
        # Create unique key
        key = f"RSS_{i}_{item['chemical_group'][:20]}_{item['cas_no'][:20]}".replace(' ', '_')
        record = Record(
            module='RSS',
            source_key=key,
            data=item
        )
        db.add(record)
    
    db.commit()
    print("Successfully updated database.")
