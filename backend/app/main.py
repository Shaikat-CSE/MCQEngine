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
        await asyncio.sleep(60)

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

class MCQDetailResponse(BaseModel):
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
    created_at: datetime

    class Config:
        from_attributes = True

class PaginatedMCQResponse(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int
    results: List[MCQDetailResponse]
    categories: List[str]
    topics: List[str]

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
    return {"message": "Welcome to premium Codemy MCQ Bank API", "version": "1.0.0"}

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

@app.get("/api/subjects/{subject_id}", response_model=SubjectResponse)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    sub = db.query(Subject).filter(Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    count = db.query(MCQ).filter(MCQ.subject_id == sub.id).count()
    return SubjectResponse(
        id=sub.id,
        name=sub.name,
        file_name=sub.file_name,
        question_count=count,
        created_at=sub.created_at
    )

@app.get("/api/subjects/{subject_id}/mcqs", response_model=PaginatedMCQResponse)
def get_subject_mcqs(
    subject_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    query = db.query(MCQ).filter(MCQ.subject_id == subject_id)

    if category:
        query = query.filter(MCQ.category == category)
    if topic:
        query = query.filter(MCQ.topic == topic)
    if difficulty:
        query = query.filter(MCQ.difficulty == difficulty)
    if search:
        query = query.filter(MCQ.question.ilike(f"%{search}%"))

    total = query.count()
    results = query.offset((page - 1) * page_size).limit(page_size).all()

    # Get distinct categories and topics for this subject (for filtering)
    categories = [c[0] for c in db.query(MCQ.category).filter(MCQ.subject_id == subject_id).distinct().all() if c[0]]
    topics = [t[0] for t in db.query(MCQ.topic).filter(MCQ.subject_id == subject_id).distinct().all() if t[0]]

    categories.sort()
    topics.sort()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "results": results,
        "categories": categories,
        "topics": topics
    }

