from app.database import SessionLocal
from app.models import Message

def main():
    db = SessionLocal()
    try:
        msgs = db.query(Message).filter(Message.conversation_id == "8b84d412-fbf3-4fb0-a7cb-dfd1dc792404").order_by(Message.created_at.desc()).limit(2).all()
        for m in reversed(msgs):
            print(f"[{m.sender.upper()}]: {m.content}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
