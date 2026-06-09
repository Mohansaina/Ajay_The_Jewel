import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "AI Chatbot Widget Backend"
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = "supersecretdevelopmentkeychangeinproduction"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Databases
    DATABASE_URL: str = "sqlite:///./chatbot_operational.db"
    QDRANT_PATH: str = ":memory:"  # In-memory Qdrant client for crash-free local reload
    QDRANT_HOST: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None
    
    # LLM Settings
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: str = "meta-llama/llama-3-8b-instruct:free"
    LLM_PROVIDER: str = "openai"  # openai, gemini, openrouter
    
    # Email / Resend Settings
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "onboarding@resend.dev"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
