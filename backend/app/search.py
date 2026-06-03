from sqlalchemy.orm import Session
from rapidfuzz import fuzz, process
from app.models import MCQ, SearchLog
from app.importer import normalize_text
from app.config import settings

def search_mcqs(db: Session, subject_id: int, query: str):
    # Normalize query
    query_normalized = normalize_text(query)
    if not query_normalized:
        return []
        
    # Step 1: Fetch all MCQ IDs and normalized questions for this subject (lightweight fetch)
    mcq_rows = db.query(MCQ.id, MCQ.normalized_question).filter(MCQ.subject_id == subject_id).all()
    if not mcq_rows:
        return []
        
    # Convert to dictionary mapping mcq_id -> normalized_question
    choices = {row.id: row.normalized_question for row in mcq_rows}
    
    # Step 2: Use RapidFuzz process.extract to quickly find the top candidates.
    # If the set is small, extract all. If the set is large, extract top 500.
    limit_candidates = min(500, len(choices))
    
    # RapidFuzz process.extract returns list of tuples: (normalized_question, score, mcq_id)
    raw_matches = process.extract(
        query_normalized,
        choices,
        scorer=fuzz.token_set_ratio,
        limit=limit_candidates
    )
    
    if not raw_matches:
        return []
        
    # Step 3: Fetch full database objects for only the candidate MCQ IDs
    candidate_ids = [match[2] for match in raw_matches]
    mcq_objects = db.query(MCQ).filter(MCQ.id.in_(candidate_ids)).all()
    mcq_map = {m.id: m for m in mcq_objects}
    
    # Step 4: Compute full weighted score for each candidate
    scored_results = []
    for match in raw_matches:
        mcq_id = match[2]
        mcq = mcq_map.get(mcq_id)
        if not mcq:
            continue
            
        # Calculate individual ratios
        ts_ratio = fuzz.token_set_ratio(query_normalized, mcq.normalized_question)
        p_ratio = fuzz.partial_ratio(query_normalized, mcq.normalized_question)
        tso_ratio = fuzz.token_sort_ratio(query_normalized, mcq.normalized_question)
        
        # Weighted score: 0.4 * token_set_ratio + 0.4 * partial_ratio + 0.2 * token_sort_ratio
        weighted_score = (
            settings.WEIGHT_TOKEN_SET_RATIO * ts_ratio +
            settings.WEIGHT_PARTIAL_RATIO * p_ratio +
            settings.WEIGHT_TOKEN_SORT_RATIO * tso_ratio
        )
        
        scored_results.append({
            "mcq": mcq,
            "score": round(weighted_score, 2)
        })
        
    # Sort results by score in descending order
    scored_results.sort(key=lambda x: x["score"], reverse=True)
    
    # Step 5: Apply results logic
    # If top score >= 85: return best match (list of 1 item)
    # If top score < 85: return top 3 matches
    if not scored_results:
        return []
        
    top_score = scored_results[0]["score"]
    
    if top_score >= settings.CONFIDENCE_THRESHOLD:
        final_results = scored_results[:1]
    else:
        final_results = scored_results[:3]
        
    # Step 6: Log search query (only log if there is a match)
    if final_results:
        best_match = final_results[0]
        log = SearchLog(
            query=query,
            matched_mcq_id=best_match["mcq"].id,
            similarity_score=best_match["score"]
        )
        db.add(log)
        db.commit()
        
    # Format and return items
    output = []
    for item in final_results:
        mcq = item["mcq"]
        output.append({
            "id": mcq.id,
            "subject_id": mcq.subject_id,
            "question": mcq.question,
            "option_a": mcq.option_a,
            "option_b": mcq.option_b,
            "option_c": mcq.option_c,
            "option_d": mcq.option_d,
            "correct_answer": mcq.correct_answer,
            "category": mcq.category,
            "topic": mcq.topic,
            "difficulty": mcq.difficulty,
            "score": item["score"]
        })
        
    return output
