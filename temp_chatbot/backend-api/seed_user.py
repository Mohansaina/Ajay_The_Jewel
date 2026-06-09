import hashlib
from app.database import engine, SessionLocal
from app.models import Base, User, WidgetSettings, APIKey

def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

def seed():
    # Initialize the database
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if user already exists
        email = "owner@example.com"
        password = "password123"
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Creating user {email}...")
            user = User(
                email=email,
                password_hash=hashed_password,
                company_name="Verdia Demo Inc."
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            print(f"User {email} already exists.")
            
        # Check settings
        settings_rec = db.query(WidgetSettings).filter(WidgetSettings.user_id == user.id).first()
        if not settings_rec:
            print("Creating default widget settings...")
            settings_rec = WidgetSettings(
                user_id=user.id,
                brand_color="#2563EB",
                welcome_message="Hi there! Ask me anything about our services.",
                position="bottom-right",
                escalation_email=email,
                escalation_subject_prefix="[AI Chatbot Escalation]",
                email_capture_required=False,
                confidence_threshold=0.7
            )
            db.add(settings_rec)
            db.commit()
        else:
            print("Widget settings already exist.")
            
        # Check API Key
        raw_key = "sk_live_test_key_1234567890"
        hashed_k = hash_key(raw_key)
        
        key_rec = db.query(APIKey).filter(APIKey.key_hash == hashed_k).first()
        if not key_rec:
            print(f"Creating default API Key: {raw_key}...")
            key_rec = APIKey(
                key_hash=hashed_k,
                user_id=user.id,
                name="Development Test Key",
                active=True
            )
            db.add(key_rec)
            db.commit()
        else:
            print("API key already exists.")
            
        print("\n===========================================")
        print("SEEDING SUCCESSFUL!")
        print("===========================================")
        print(f"User Email: {email}")
        print(f"Password:   {password}")
        print(f"API Key:    {raw_key}")
        print("===========================================\n")
        
    except Exception as e:
        print(f"Error during seeding: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
