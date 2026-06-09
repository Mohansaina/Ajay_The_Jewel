import pytest
import os
import tempfile
from app.services.rag_service import RAGService, uuid_from_parts
from app.main import strip_reply_headers
from app.schemas import ChatRequest, WidgetSettingsUpdate

def test_text_chunking():
    rag = RAGService()
    # Test simple word-based splitting
    sample_text = "word1 " * 1000
    chunks = rag.chunk_text(sample_text, chunk_size=600, overlap=100)
    
    assert len(chunks) > 1
    # Check overlap behavior
    assert "word1" in chunks[0]
    assert len(chunks[0].split()) == 600

def test_extract_text_from_file_txt():
    rag = RAGService()
    content = b"Hello, this is a plain text file."
    extracted = rag.extract_text_from_file(content, "test.txt")
    assert extracted == "Hello, this is a plain text file."

def test_strip_reply_headers():
    # Test basic inbound email reply parser
    email_with_history = (
        "This is the actual reply message.\n"
        "On May 23, 2026 at 9:00 AM, owner@example.com wrote:\n"
        "> Hello, this is the original question thread?\n"
        "> Let me know if you can assist."
    )
    clean = strip_reply_headers(email_with_history)
    assert clean == "This is the actual reply message."

def test_strip_reply_headers_alternative():
    email_with_history = (
        "I am looking into this problem right now.\n"
        "From: admin@example.com\n"
        "Sent: Saturday, May 23, 2026\n"
        "To: client@example.com"
    )
    clean = strip_reply_headers(email_with_history)
    assert clean == "I am looking into this problem right now."

def test_uuid_generation_determinism():
    base_id = "e2d3b2a2-4d06-4f89-ab6a-1daabc8cfdb5"
    uuid1 = uuid_from_parts(base_id, 0)
    uuid2 = uuid_from_parts(base_id, 0)
    uuid3 = uuid_from_parts(base_id, 1)
    
    assert uuid1 == uuid2
    assert uuid1 != uuid3

def test_chat_request_schema():
    payload = {
        "query": "Hello AI",
        "conversation_id": "conv-123",
        "visitor_email": "visitor@example.com",
        "page_url": "https://example.com/pricing"
    }
    obj = ChatRequest(**payload)
    assert obj.query == "Hello AI"
    assert obj.visitor_email == "visitor@example.com"

def test_widget_settings_validation():
    # Valid parameters
    valid_settings = {
        "brand_color": "#2563EB",
        "position": "bottom-right",
        "confidence_threshold": 0.85
    }
    obj = WidgetSettingsUpdate(**valid_settings)
    assert obj.brand_color == "#2563EB"
    assert obj.confidence_threshold == 0.85
    
    # Invalid parameters (should trigger validation error)
    with pytest.raises(ValueError):
        WidgetSettingsUpdate(brand_color="invalid-color")
        
    with pytest.raises(ValueError):
        WidgetSettingsUpdate(position="top-right")

    with pytest.raises(ValueError):
        WidgetSettingsUpdate(confidence_threshold=1.5)
