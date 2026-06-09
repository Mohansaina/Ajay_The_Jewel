import httpx
from typing import List, Dict
import datetime
from app.config import settings

class EmailService:
    async def send_escalation_email(
        self,
        to_email: str,
        conversation_id: str,
        visitor_email: str,
        visitor_question: str,
        history: List[Dict[str, str]],
        page_url: str = "N/A"
    ) -> str:
        """
        Sends an email escalation to the business owner.
        Includes visitor question, last 5 conversation messages, timestamp, and page URL.
        Sets Reply-To to handle webhook inbound email replies.
        """
        timestamp = datetime.datetime.utcnow().isoformat()
        
        # Build chat history formatting
        history_text = ""
        for msg in history[-5:]:
            history_text += f"- {msg['sender'].capitalize()}: {msg['content']}\n"
            
        subject = f"{settings.EMAIL_FROM} [Escalation Thread ID: {conversation_id}]"
        
        html_content = f"""
        <h2>AI Chatbot Escalation Alert</h2>
        <p>A visitor query required human intervention.</p>
        <hr/>
        <p><strong>Visitor Email:</strong> {visitor_email or 'Anonymous'}</p>
        <p><strong>Visitor Question:</strong> {visitor_question}</p>
        <p><strong>Page URL:</strong> {page_url}</p>
        <p><strong>Timestamp (UTC):</strong> {timestamp}</p>
        <hr/>
        <h3>Recent Conversation History:</h3>
        <pre style="background: #f4f4f4; padding: 10px; border-radius: 5px;">
{history_text}
        </pre>
        <hr/>
        <p><strong>To reply directly to the visitor, simply reply to this email.</strong> Your reply will be instantly streamed into their active chat window.</p>
        """

        reply_to_email = f"reply+{conversation_id}@yourdomain.com"
        
        # Determine Message-ID for tracking
        message_id = f"<{conversation_id}@escalation.chatbot>"

        if settings.RESEND_API_KEY:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "from": settings.EMAIL_FROM,
                            "to": to_email,
                            "subject": f"{settings.PROJECT_NAME} Escalation - {visitor_question[:30]}...",
                            "html": html_content,
                            "reply_to": reply_to_email,
                            "headers": {
                                "Message-ID": message_id
                            }
                        },
                        timeout=15.0
                    )
                    response.raise_for_status()
                    data = response.json()
                    # Resend returns email id as part of the payload
                    return data.get("id") or message_id
            except Exception as e:
                print(f"[Email Escalation Error] Failed to send email via Resend: {str(e)}")
        
        # Fallback Mock Logs (Useful for local testing)
        print(f"\n======== [MOCK EMAIL ESCALATION] ========")
        print(f"To: {to_email}")
        print(f"From: {settings.EMAIL_FROM}")
        print(f"Reply-To: {reply_to_email}")
        print(f"Subject: {settings.PROJECT_NAME} Escalation - {visitor_question[:30]}...")
        print(f"Message-ID: {message_id}")
        print(f"Body:\n{html_content}")
        print(f"=========================================\n")
        
        return message_id

email_service = EmailService()
