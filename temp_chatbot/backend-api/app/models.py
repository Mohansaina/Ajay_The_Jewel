import datetime
import uuid
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text, Float
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = 'users'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    settings = relationship("WidgetSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("KnowledgeBaseDoc", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")


class WidgetSettings(Base):
    __tablename__ = 'widget_settings'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    brand_color = Column(String(7), default='#2563EB', nullable=False)  # Hex color e.g., #2563EB
    avatar_url = Column(String(500), nullable=True)
    welcome_message = Column(String(500), default='Hello! How can I help you today?', nullable=False)
    position = Column(String(50), default='bottom-right', nullable=False) # bottom-right, bottom-left
    escalation_email = Column(String(255), nullable=False)
    escalation_subject_prefix = Column(String(255), default='[AI Chatbot Escalation]', nullable=False)
    reply_to_email = Column(String(255), nullable=True)
    email_capture_required = Column(Boolean, default=False, nullable=False)
    confidence_threshold = Column(Float, default=0.7, nullable=False)
    
    user = relationship("User", back_populates="settings")


class APIKey(Base):
    __tablename__ = 'api_keys'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    key_hash = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(255), default='Default API Key', nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="api_keys")


class KnowledgeBaseDoc(Base):
    __tablename__ = 'knowledge_base_docs'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(50), nullable=False) # pdf, docx, txt, url
    content = Column(Text, nullable=False) # Raw text content extracted
    url = Column(String(1000), nullable=True) # If crawled from a website URL
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="documents")


class Conversation(Base):
    __tablename__ = 'conversations'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    visitor_email = Column(String(255), nullable=True)
    status = Column(String(50), default='active', nullable=False) # active, escalated, resolved
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    escalations = relationship("EscalationEvent", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = 'messages'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False, index=True)
    sender = Column(String(50), nullable=False) # visitor, assistant, owner
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    conversation = relationship("Conversation", back_populates="messages")


class EscalationEvent(Base):
    __tablename__ = 'escalation_events'
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False, index=True)
    email_message_id = Column(String(255), unique=True, nullable=False, index=True) # Message-ID sent in SMTP, used to match replies
    status = Column(String(50), default='pending', nullable=False) # pending, replied
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    
    conversation = relationship("Conversation", back_populates="escalations")
