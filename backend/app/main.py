import asyncio
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.config import settings
from app.database import get_db, engine
from app.models import Base, Subject, MCQ
from app.importer import scan_data_directory
from app.search import search_mcqs

# Create FastAPI app
app = FastAPI(title=settings.PROJECT_NAME)

# Setup CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Background watcher loop
async def watcher_loop():
    while True:
        try:
            scan_data_directory()
        except Exception as e:
            print(f"Error in watcher loop: {e}")
        await asyncio.sleep(5)

@app.on_event("startup")
async def startup_event():
    # Initialize SQLite database and tables
    Base.metadata.create_all(bind=engine)
    
    # Run scanner immediately
    scan_data_directory()
    
    # Start periodic watcher task
    asyncio.create_task(watcher_loop())

# Pydantic Schemas
class SearchRequest(BaseModel):
    subject_id: int
    query: str

class MCQResponse(BaseModel):
    id: int
    subject_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    category: Optional[str]
    topic: Optional[str]
    difficulty: Optional[str]
    score: float

class SubjectResponse(BaseModel):
    id: int
    name: str
    file_name: str
    question_count: int
    created_at: datetime

    class Config:
        from_attributes = True

# API Endpoints
@app.get("/")
def read_root():
    return {"message": "Welcome to premium MCQ Finder API", "version": "1.0.0"}

@app.get("/api/subjects", response_model=List[SubjectResponse])
def get_subjects(db: Session = Depends(get_db)):
    subjects = db.query(Subject).all()
    results = []
    for sub in subjects:
        # count questions
        count = db.query(MCQ).filter(MCQ.subject_id == sub.id).count()
        results.append(SubjectResponse(
            id=sub.id,
            name=sub.name,
            file_name=sub.file_name,
            question_count=count,
            created_at=sub.created_at
        ))
    return results

@app.post("/api/search", response_model=List[MCQResponse])
def search(request: SearchRequest, db: Session = Depends(get_db)):
    # Check if subject exists
    subject = db.query(Subject).filter(Subject.id == request.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    if not request.query.strip():
        return []
        
    try:
        results = search_mcqs(db, request.subject_id, request.query)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/api/status")
def get_status(db: Session = Depends(get_db)):
    subject_count = db.query(Subject).count()
    mcq_count = db.query(MCQ).count()
    return {
        "status": "healthy",
        "total_subjects": subject_count,
        "total_mcqs": mcq_count,
        "data_directory": settings.DATA_DIR
    }
