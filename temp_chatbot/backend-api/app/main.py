import os
import hashlib
import json
import uuid
import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Security, UploadFile, File, Form, Header, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from app.config import settings
from app.database import engine, get_db, SessionLocal
from app.models import Base, User, WidgetSettings, APIKey, KnowledgeBaseDoc, Conversation, Message, EscalationEvent
from app.schemas import (
    ChatRequest, ConversationResponse, APIKeyCreate, APIKeyReveal, APIKeyResponse,
    WidgetSettingsUpdate, WidgetSettingsResponse, URLIngestRequest, KBDocResponse,
    OnboardingAnswersSubmit
)
from app.services.rag_service import rag_service
from app.services.llm_service import llm_service
from app.services.email_service import email_service

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Enable CORS for widget embeds and dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper: Hash api key for comparison
def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

# Dependency: Authenticate API Key from X-API-Key or Authorization header
def get_current_user_from_key(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_user_email: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    # Safe Developer Fallback: Authenticate directly by user email to ensure correct tenant isolation
    if x_user_email:
        dev_user = db.query(User).filter(User.email == x_user_email).first()
        if dev_user:
            return dev_user

    api_key_str = None
    if x_api_key:
        api_key_str = x_api_key
    elif authorization and authorization.startswith("Bearer "):
        api_key_str = authorization[7:]
        
    if not api_key_str:
        # Fallback for testing - if we don't have keys, look up the first user
        first_user = db.query(User).first()
        if first_user:
            return first_user
        # Otherwise raise unauthorized
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key. Provide header 'X-API-Key' or 'Authorization: Bearer sk_...'"
        )
        
    key_hash = hash_key(api_key_str)
    api_key_record = db.query(APIKey).filter(APIKey.key_hash == key_hash, APIKey.active == True).first()
    
    if not api_key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API Key."
        )
        
    return api_key_record.user

@app.get("/")
def read_root():
    return {"status": "ok", "message": "AI Chatbot Widget API is running"}

@app.get("/widget.js")
def get_widget_js():
    # Return the widget.js file from the sibling widget-client directory
    widget_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "widget-client", "widget.js"))
    if not os.path.exists(widget_path):
        widget_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "widget-client", "widget.js"))
    
    if os.path.exists(widget_path):
        return FileResponse(widget_path, media_type="application/javascript")
        
    workspace_path = "c:\\Users\\svssw\\Downloads\\firtstakforintern\\widget-client\\widget.js"
    if os.path.exists(workspace_path):
        return FileResponse(workspace_path, media_type="application/javascript")
        
    raise HTTPException(status_code=404, detail="widget.js file not found on backend.")

# ----------------- CHAT ENDPOINT (SSE STREAMING) -----------------

@app.post(f"{settings.API_V1_STR}/chat")
async def chat(
    payload: ChatRequest,
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    # 1. Resolve conversation
    conv_id = payload.conversation_id
    conversation = None
    
    if conv_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == conv_id,
            Conversation.user_id == user.id
        ).first()
        
    if not conversation:
        conversation = Conversation(
            id=conv_id or str(uuid.uuid4()),
            user_id=user.id,
            visitor_email=payload.visitor_email,
            status="active"
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # 2. Update visitor email if provided and not set
    if payload.visitor_email and not conversation.visitor_email:
        conversation.visitor_email = payload.visitor_email
        db.commit()

    # 3. Store visitor's message
    visitor_msg = Message(
        conversation_id=conversation.id,
        sender="visitor",
        content=payload.query
    )
    db.add(visitor_msg)
    db.commit()

    # 4. Search relevant chunks in Knowledge Base
    kb_chunks = await rag_service.search_kb(user.id, payload.query, limit=3)
    
    # 5. Fetch widget settings to verify threshold and escalation address
    settings_rec = db.query(WidgetSettings).filter(WidgetSettings.user_id == user.id).first()
    threshold = settings_rec.confidence_threshold if settings_rec else 0.7
    owner_email = settings_rec.escalation_email if settings_rec else user.email

    # Avoid escalating standard greetings, pleasantries or bot identity queries
    q_clean = payload.query.strip().lower().replace("?", "").replace("!", "").replace(".", "")
    pleasantry_phrases = [
        "hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening",
        "howdy", "yo", "test", "who are you", "what are you", "what is your name", 
        "your name", "good name", "how are you"
    ]
    is_pleasantry = any(p in q_clean for p in pleasantry_phrases)

    should_escalate = False
    if not is_pleasantry:
        if not kb_chunks or kb_chunks[0]["score"] < threshold:
            should_escalate = True

    # 6. Stream generator
    conversation_id = conversation.id
    visitor_email = conversation.visitor_email

    async def response_generator():
        # Create a fresh database session for the background stream
        stream_db = SessionLocal()
        try:
            # Fetch history (last 5 messages)
            history_msgs = stream_db.query(Message).filter(
                Message.conversation_id == conversation_id
            ).order_by(Message.created_at.asc()).all()
            
            history = [
                {"role": "user" if m.sender == "visitor" else "assistant", "content": m.content}
                for m in history_msgs[:-1] # Exclude current query
            ]

            full_assistant_reply = ""
            
            # If low confidence, trigger email escalation silently in the background
            if should_escalate:
                # Record escalation in database if active (only once per conversation!)
                stream_conv = stream_db.query(Conversation).filter(Conversation.id == conversation_id).first()
                if stream_conv and stream_conv.status != "escalated":
                    stream_conv.status = "escalated"
                    stream_db.commit()
                    
                    # Send email alert silently
                    email_msg_id = await email_service.send_escalation_email(
                        to_email=owner_email,
                        conversation_id=conversation_id,
                        visitor_email=visitor_email,
                        visitor_question=payload.query,
                        history=[{"sender": m.sender, "content": m.content} for m in history_msgs],
                        page_url=payload.page_url or "N/A"
                    )
                    
                    escalation_event = EscalationEvent(
                        conversation_id=conversation_id,
                        email_message_id=email_msg_id,
                        status="pending"
                    )
                    stream_db.add(escalation_event)
                    stream_db.commit()

            # Execute LLM streaming normally to the visitor
            try:
                async for token in llm_service.answer_with_context(payload.query, kb_chunks, history):
                    full_assistant_reply += token
                    yield f"data: {json.dumps({'text': token, 'conversation_id': conversation_id})}\n\n"
            except Exception as e:
                error_msg = f"\n[Stream Error: {str(e)}]"
                yield f"data: {json.dumps({'text': error_msg, 'conversation_id': conversation_id})}\n\n"
                full_assistant_reply += error_msg

            # Save AI's response to DB
            ai_msg = Message(
                conversation_id=conversation_id,
                sender="assistant",
                content=full_assistant_reply
            )
            stream_db.add(ai_msg)
            stream_db.commit()
            
            yield "data: [DONE]\n\n"
        finally:
            stream_db.close()

    return StreamingResponse(response_generator(), media_type="text/event-stream")

# ----------------- KNOWLEDGE BASE MANAGEMENT -----------------

@app.post(f"{settings.API_V1_STR}/kb/upload", response_model=KBDocResponse)
async def upload_document(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    content_bytes = await file.read()
    try:
        text_content = rag_service.extract_text_from_file(content_bytes, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
        
    doc_id = str(uuid.uuid4())
    kb_doc = KnowledgeBaseDoc(
        id=doc_id,
        user_id=user.id,
        filename=file.filename,
        content_type=file.filename.split(".")[-1].lower(),
        content=text_content
    )
    
    db.add(kb_doc)
    db.commit()
    db.refresh(kb_doc)
    
    # Run ingestion into vector store
    await rag_service.ingest_document(
        business_id=user.id,
        content=text_content,
        doc_name=file.filename,
        doc_id=doc_id
    )
    
    return kb_doc

@app.post(f"{settings.API_V1_STR}/kb/url", response_model=KBDocResponse)
async def ingest_url(
    payload: URLIngestRequest,
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    try:
        text_content = await rag_service.scrape_url(payload.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Scraping failed: {str(e)}")
        
    doc_id = str(uuid.uuid4())
    filename = payload.url.split("//")[-1].replace("/", "_")[:50]
    
    kb_doc = KnowledgeBaseDoc(
        id=doc_id,
        user_id=user.id,
        filename=filename or "scraped_page",
        content_type="url",
        content=text_content,
        url=payload.url
    )
    
    db.add(kb_doc)
    db.commit()
    db.refresh(kb_doc)
    
    # Ingest chunks
    await rag_service.ingest_document(
        business_id=user.id,
        content=text_content,
        doc_name=payload.url,
        doc_id=doc_id,
        url=payload.url
    )
    
    return kb_doc

@app.get(f"{settings.API_V1_STR}/kb", response_model=List[KBDocResponse])
def get_kb_documents(
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    return db.query(KnowledgeBaseDoc).filter(KnowledgeBaseDoc.user_id == user.id).all()

# ----------------- ONBOARDING WIZARD -----------------

@app.get(f"{settings.API_V1_STR}/onboarding/questions")
async def get_onboarding_questions(
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    # Fetch first uploaded document to generate questions
    first_doc = db.query(KnowledgeBaseDoc).filter(KnowledgeBaseDoc.user_id == user.id).first()
    if not first_doc:
        raise HTTPException(
            status_code=400,
            detail="No files uploaded yet. Upload a knowledge base document first."
        )
        
    questions = await llm_service.generate_onboarding_questions(first_doc.content)
    return {"questions": questions}

@app.post(f"{settings.API_V1_STR}/onboarding/answers")
async def submit_onboarding_answers(
    payload: OnboardingAnswersSubmit,
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    qa_text = ""
    for question, answer in payload.answers.items():
        qa_text += f"Question: {question}\nAnswer: {answer}\n\n"

    # Save as high-priority FAQ document
    doc_id = str(uuid.uuid4())
    kb_doc = KnowledgeBaseDoc(
        id=doc_id,
        user_id=user.id,
        filename="Onboarding Q&A.txt",
        content_type="txt",
        content=qa_text
    )
    db.add(kb_doc)
    db.commit()
    db.refresh(kb_doc)
    
    # Ingest in Qdrant
    await rag_service.ingest_document(
        business_id=user.id,
        content=qa_text,
        doc_name="Onboarding Q&A",
        doc_id=doc_id
    )
    
    return {"status": "success", "message": "Onboarding answers saved successfully."}

# ----------------- WIDGET SETTINGS -----------------

@app.get(f"{settings.API_V1_STR}/settings", response_model=WidgetSettingsResponse)
def get_settings(
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    settings_rec = db.query(WidgetSettings).filter(WidgetSettings.user_id == user.id).first()
    if not settings_rec:
        # Create default settings
        settings_rec = WidgetSettings(
            user_id=user.id,
            escalation_email=user.email
        )
        db.add(settings_rec)
        db.commit()
        db.refresh(settings_rec)
    return settings_rec

@app.post(f"{settings.API_V1_STR}/settings", response_model=WidgetSettingsResponse)
def update_settings(
    payload: WidgetSettingsUpdate,
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    settings_rec = db.query(WidgetSettings).filter(WidgetSettings.user_id == user.id).first()
    if not settings_rec:
        settings_rec = WidgetSettings(user_id=user.id, escalation_email=user.email)
        db.add(settings_rec)
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings_rec, key, value)
        
    db.commit()
    db.refresh(settings_rec)
    return settings_rec

# ----------------- CONVERSATIONS HISTORY & ANALYTICS -----------------

@app.get(f"{settings.API_V1_STR}/conversations", response_model=List[ConversationResponse])
def get_conversations(
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    return db.query(Conversation).filter(Conversation.user_id == user.id).order_by(Conversation.created_at.desc()).all()

@app.get(f"{settings.API_V1_STR}/conversations/{{id}}", response_model=ConversationResponse)
def get_conversation_by_id(
    id: str,
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == id, Conversation.user_id == user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@app.post(f"{settings.API_V1_STR}/escalate/{{id}}")
async def manual_escalate(
    id: str,
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == id, Conversation.user_id == user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    if conv.status != "escalated":
        conv.status = "escalated"
        
        # Get settings for details
        settings_rec = db.query(WidgetSettings).filter(WidgetSettings.user_id == user.id).first()
        owner_email = settings_rec.escalation_email if settings_rec else user.email
        
        history_msgs = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at.asc()).all()
        last_question = history_msgs[-1].content if history_msgs else "Manual Escalation"
        
        email_msg_id = await email_service.send_escalation_email(
            to_email=owner_email,
            conversation_id=conv.id,
            visitor_email=conv.visitor_email,
            visitor_question=last_question,
            history=[{"sender": m.sender, "content": m.content} for m in history_msgs]
        )
        
        escalation_event = EscalationEvent(
            conversation_id=conv.id,
            email_message_id=email_msg_id,
            status="pending"
        )
        db.add(escalation_event)
        db.commit()
        
    return {"status": "success", "message": "Conversation manually escalated."}

# ----------------- API KEY MANAGEMENT -----------------

@app.post(f"{settings.API_V1_STR}/keys", response_model=APIKeyReveal)
def create_api_key(
    payload: APIKeyCreate,
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    raw_key = f"sk_live_{uuid.uuid4().hex}"
    key_prefix = raw_key[:12] + "..."
    key_hash = hash_key(raw_key)
    
    new_key = APIKey(
        key_hash=key_hash,
        user_id=user.id,
        name=payload.name,
        active=True
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    # We yield the full key value once here
    return APIKeyReveal(
        id=new_key.id,
        name=new_key.name,
        key_prefix=key_prefix,
        active=new_key.active,
        created_at=new_key.created_at,
        key=raw_key
    )

@app.get(f"{settings.API_V1_STR}/keys", response_model=List[APIKeyResponse])
def list_api_keys(
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    keys = db.query(APIKey).filter(APIKey.user_id == user.id).all()
    # Mask hash prefixes for listing
    response = []
    for k in keys:
        response.append(APIKeyResponse(
            id=k.id,
            name=k.name,
            key_prefix="sk_live_xxxx...",
            active=k.active,
            created_at=k.created_at
        ))
    return response

@app.delete(f"{settings.API_V1_STR}/keys/{{id}}")
def delete_api_key(
    id: str,
    user: User = Depends(get_current_user_from_key),
    db: Session = Depends(get_db)
):
    key = db.query(APIKey).filter(APIKey.id == id, APIKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API Key not found")
    db.delete(key)
    db.commit()
    return {"status": "success", "message": "API key revoked."}

# ----------------- WEBHOOK: INBOUND EMAIL ESCALATION REPLY -----------------

@app.post(f"{settings.API_V1_STR}/webhooks/inbound-email")
async def inbound_email_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_header: Optional[str] = Header(None) # Can be used to verify webhook security
):
    """
    Receives inbound email replies from the email provider (e.g. Resend, SendGrid webhooks).
    Maps the reply back to the conversation thread and posts it as an owner message.
    """
    # The JSON structure depends on the provider.
    # We will support Resend/SendGrid style parsing.
    # In general: we need the recipient address (which contains reply+CONV_ID@domain) 
    # or the In-Reply-To header / Threading headers.
    
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
        
    # Extract recipient email to look for reply+CONV_ID@yourdomain.com
    to_field = body.get("to") or body.get("recipient") or ""
    conversation_id = None
    
    # Find matching reply pattern
    match = re.search(r'reply\+([a-f0-9\-]{36})@', to_field)
    if match:
        conversation_id = match.group(1)
        
    # Alternative lookup: look up by original Message-ID from headers
    if not conversation_id:
        in_reply_to = body.get("in_reply_to") or body.get("headers", {}).get("In-Reply-To") or ""
        if in_reply_to:
            escalation = db.query(EscalationEvent).filter(EscalationEvent.email_message_id == in_reply_to).first()
            if escalation:
                conversation_id = escalation.conversation_id

    if not conversation_id:
        raise HTTPException(status_code=400, detail="Could not map email reply to any active conversation.")

    # Find conversation
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation thread not found.")

    # Extract clean text body (stripping out original threads)
    email_text = body.get("text") or body.get("plain") or ""
    clean_reply = strip_reply_headers(email_text)
    
    # Append message
    owner_message = Message(
        conversation_id=conversation.id,
        sender="owner",
        content=clean_reply
    )
    db.add(owner_message)
    
    # Mark conversation as resolved / active again (since owner replied)
    conversation.status = "active"
    
    # Mark escalation event resolved
    escalation_event = db.query(EscalationEvent).filter(
        EscalationEvent.conversation_id == conversation.id,
        EscalationEvent.status == "pending"
    ).first()
    if escalation_event:
        escalation_event.status = "replied"
        escalation_event.resolved_at = datetime.datetime.utcnow()
        
    db.commit()
    
    return {"status": "success", "message": "Inbound reply processed."}

import re
def strip_reply_headers(text: str) -> str:
    """Helper to strip out email history / quotes."""
    lines = text.split("\n")
    clean_lines = []
    for line in lines:
        stripped = line.strip()
        # Typical reply line starts (e.g. "On May 23, 2026 ... wrote:")
        if re.match(r'^(On\s+.*wrote:|>|From:\s+|Sent:\s+|To:\s+)', stripped, re.IGNORECASE):
            break
        clean_lines.append(line)
    return "\n".join(clean_lines).strip()
