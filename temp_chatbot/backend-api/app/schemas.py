from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
import datetime

# Chat Schemas
class ChatRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None
    visitor_email: Optional[EmailStr] = None
    page_url: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    sender: str
    content: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: str
    visitor_email: Optional[str] = None
    status: str
    created_at: datetime.datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True

# API Key Schemas
class APIKeyCreate(BaseModel):
    name: str = Field(..., max_length=100)

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class APIKeyReveal(APIKeyResponse):
    key: str # Clean representation only shown once upon creation

# Settings Schemas
class WidgetSettingsUpdate(BaseModel):
    brand_color: Optional[str] = Field(None, max_length=7, pattern="^#[0-9a-fA-F]{6}$")
    avatar_url: Optional[str] = None
    welcome_message: Optional[str] = Field(None, max_length=500)
    position: Optional[str] = Field(None, pattern="^(bottom-right|bottom-left)$")
    escalation_email: Optional[EmailStr] = None
    escalation_subject_prefix: Optional[str] = Field(None, max_length=255)
    reply_to_email: Optional[EmailStr] = None
    email_capture_required: Optional[bool] = None
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)

class WidgetSettingsResponse(BaseModel):
    brand_color: str
    avatar_url: Optional[str]
    welcome_message: str
    position: str
    escalation_email: str
    escalation_subject_prefix: str
    reply_to_email: Optional[str]
    email_capture_required: bool
    confidence_threshold: float

    class Config:
        from_attributes = True

# Knowledge Base Schemas
class URLIngestRequest(BaseModel):
    url: str

class KBDocResponse(BaseModel):
    id: str
    filename: str
    content_type: str
    url: Optional[str]
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Onboarding Schemas
class OnboardingAnswersSubmit(BaseModel):
    answers: Dict[str, str] # Map: "question_text" -> "owner_answer"
