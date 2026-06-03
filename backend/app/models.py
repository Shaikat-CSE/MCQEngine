from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    file_name = Column(String, nullable=False, unique=True)
    last_modified_at = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    mcqs = relationship("MCQ", back_populates="subject", cascade="all, delete-orphan")

class MCQ(Base):
    __tablename__ = "mcqs"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    category = Column(String, nullable=True)
    topic = Column(String, nullable=True)
    difficulty = Column(String, nullable=True)
    normalized_question = Column(Text, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    subject = relationship("Subject", back_populates="mcqs")
    search_logs = relationship("SearchLog", back_populates="matched_mcq", cascade="all, delete-orphan")

    # Composite index for subject_id + normalized_question to optimize fetching
    __table_args__ = (
        Index("idx_subject_normalized_question", "subject_id", "normalized_question"),
    )

class SearchLog(Base):
    __tablename__ = "search_logs"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(Text, nullable=False)
    matched_mcq_id = Column(Integer, ForeignKey("mcqs.id", ondelete="CASCADE"), nullable=False)
    similarity_score = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    matched_mcq = relationship("MCQ", back_populates="search_logs")
