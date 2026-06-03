import os
from pydantic_settings import BaseSettings

# Resolve paths relative to the project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class Settings(BaseSettings):
    PROJECT_NAME: str = "MCQ Finder API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'mcq_finder.db')}")
    DATA_DIR: str = os.getenv("DATA_DIR", os.path.join(BASE_DIR, "data"))
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # Fuzzy match weights (must sum up to 1.0)
    WEIGHT_TOKEN_SET_RATIO: float = 0.4
    WEIGHT_PARTIAL_RATIO: float = 0.4
    WEIGHT_TOKEN_SORT_RATIO: float = 0.2
    
    # Minimum score threshold for matching logic
    CONFIDENCE_THRESHOLD: float = 85.0

    class Config:
        case_sensitive = True

settings = Settings()
print(f"DATABASE_URL resolved to: {settings.DATABASE_URL}")
print(f"DATA_DIR resolved to: {settings.DATA_DIR}")
