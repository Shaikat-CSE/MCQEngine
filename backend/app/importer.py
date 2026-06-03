import os
import re
import pandas as pd
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.config import settings
from app.database import SessionLocal
from app.models import Subject, MCQ

def clean_subject_name(filename: str) -> str:
    # Remove extension
    name = filename.rsplit('.', 1)[0]
    # Replace separators with spaces
    name = name.replace('_', ' ').replace('-', ' ')
    # Remove digits/numbers (e.g. 300)
    name = re.sub(r'\b\d+\b', '', name)
    # Remove keywords like MCQ, MCQs, Question Bank case-insensitively
    name = re.sub(r'\bmcqs?\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\bquestion\s*banks?\b', '', name, flags=re.IGNORECASE)
    # Clean multiple spaces and trim
    name = ' '.join(name.split())
    return name.title()

def normalize_text(text: str) -> str:
    if not text or pd.isna(text):
        return ""
    # Convert to string and lowercase
    text = str(text).lower()
    # Replace newlines/tabs with space
    text = re.sub(r'[\r\n\t]+', ' ', text)
    # Remove non-alphanumeric characters (keep letters, numbers, spaces)
    text = re.sub(r'[^a-z0-9 ]', '', text)
    # Collapse multiple spaces and trim
    text = ' '.join(text.split())
    return text

def map_excel_columns(df_columns):
    mapping = {}
    cols_lower = [str(c).lower().strip() for c in df_columns]
    
    def find_col(possible_names):
        # Exact matching
        for name in possible_names:
            for idx, col in enumerate(cols_lower):
                if col == name or col.replace('_', ' ') == name or col.replace(' ', '_') == name:
                    return df_columns[idx]
        # Partial matching
        for name in possible_names:
            for idx, col in enumerate(cols_lower):
                if name in col:
                    return df_columns[idx]
        return None

    mapping['question'] = find_col(['question', 'q', 'ques', 'question text'])
    mapping['option_a'] = find_col(['option a', 'option_a', 'opt a', 'a', 'op a'])
    mapping['option_b'] = find_col(['option b', 'option_b', 'opt b', 'b', 'op b'])
    mapping['option_c'] = find_col(['option c', 'option_c', 'opt c', 'c', 'op c'])
    mapping['option_d'] = find_col(['option d', 'option_d', 'opt d', 'd', 'op d'])
    mapping['correct_answer'] = find_col(['correct answer', 'correct_answer', 'answer', 'correct', 'correct option', 'ans'])
    
    # Optional columns
    mapping['category'] = find_col(['category', 'cat'])
    mapping['topic'] = find_col(['topic'])
    mapping['difficulty'] = find_col(['difficulty', 'diff', 'level'])
    
    return mapping

def import_excel_file(db: Session, filepath: str, filename: str) -> Subject:
    # Read Excel file
    df = pd.read_excel(filepath)
    
    # Map columns
    mapping = map_excel_columns(df.columns)
    
    # Ensure required columns are mapped
    required_fields = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']
    missing_fields = [f for f in required_fields if mapping.get(f) is None]
    if missing_fields:
        raise ValueError(f"Required Excel columns are missing in {filename}: {missing_fields}")
        
    subject_name = clean_subject_name(filename)
    mtime = os.path.getmtime(filepath)
    
    # Create or update Subject
    subject = db.query(Subject).filter(Subject.file_name == filename).first()
    if subject:
        # Delete existing MCQs and Subject to reload
        db.delete(subject)
        db.commit()
        
    subject = Subject(
        name=subject_name,
        file_name=filename,
        last_modified_at=mtime
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    
    mcq_objects = []
    for _, row in df.iterrows():
        q_text = row.get(mapping['question'])
        opt_a = row.get(mapping['option_a'])
        opt_b = row.get(mapping['option_b'])
        opt_c = row.get(mapping['option_c'])
        opt_d = row.get(mapping['option_d'])
        ans = row.get(mapping['correct_answer'])
        
        # Skip row if question or answers are null/empty
        if pd.isna(q_text) or str(q_text).strip() == "":
            continue
            
        cat = str(row.get(mapping['category'])) if mapping.get('category') and not pd.isna(row.get(mapping['category'])) else None
        top = str(row.get(mapping['topic'])) if mapping.get('topic') and not pd.isna(row.get(mapping['topic'])) else None
        diff = str(row.get(mapping['difficulty'])) if mapping.get('difficulty') and not pd.isna(row.get(mapping['difficulty'])) else None
        
        normalized_q = normalize_text(str(q_text))
        
        mcq = MCQ(
            subject_id=subject.id,
            question=str(q_text).strip(),
            option_a=str(opt_a).strip() if not pd.isna(opt_a) else "",
            option_b=str(opt_b).strip() if not pd.isna(opt_b) else "",
            option_c=str(opt_c).strip() if not pd.isna(opt_c) else "",
            option_d=str(opt_d).strip() if not pd.isna(opt_d) else "",
            correct_answer=str(ans).strip() if not pd.isna(ans) else "",
            category=cat,
            topic=top,
            difficulty=diff,
            normalized_question=normalized_q
        )
        mcq_objects.append(mcq)
        
    db.bulk_save_objects(mcq_objects)
    db.commit()
    return subject

def scan_data_directory():
    if not os.path.exists(settings.DATA_DIR):
        os.makedirs(settings.DATA_DIR)
        print(f"Created data directory at: {settings.DATA_DIR}")
        return
        
    db = SessionLocal()
    try:
        files = [f for f in os.listdir(settings.DATA_DIR) if f.endswith('.xlsx') and not f.startswith('~$')]
        imported_subjects = []
        
        for file in files:
            filepath = os.path.join(settings.DATA_DIR, file)
            mtime = os.path.getmtime(filepath)
            
            # Check if database has it
            subject = db.query(Subject).filter(Subject.file_name == file).first()
            if subject and subject.last_modified_at == mtime:
                # Already up to date
                continue
                
            print(f"Importing/Re-importing: {file}...")
            try:
                sub = import_excel_file(db, filepath, file)
                print(f"Successfully imported '{sub.name}' from {file} with {len(sub.mcqs)} MCQs.")
                imported_subjects.append(sub.name)
            except Exception as e:
                db.rollback()
                print(f"Error importing {file}: {str(e)}")
                
        # Clean up database subjects whose Excel files were deleted
        db_subjects = db.query(Subject).all()
        for sub in db_subjects:
            if sub.file_name not in files:
                print(f"Deleting subject '{sub.name}' as file {sub.file_name} was removed.")
                db.delete(sub)
                db.commit()
                
    finally:
        db.close()
