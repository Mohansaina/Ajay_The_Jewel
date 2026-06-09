import asyncio
import httpx
from app.config import settings

async def test_llm():
    print("Testing OpenRouter connection...")
    print(f"Model configured: {settings.OPENROUTER_MODEL}")
    print(f"API Key Prefix: {settings.OPENROUTER_API_KEY[:10]}...")

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Verdia AI Chatbot Widget Testing",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": "Hello! Reply with exactly 'OpenRouter Connection Successful' if this works."}],
        "stream": False,
        "temperature": 0.2
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=20.0
            )
            print(f"HTTP Status: {response.status_code}")
            if response.status_code == 200:
                result = response.json()
                print("Response JSON:")
                print(result)
            else:
                print("Error Response text:")
                print(response.text)
    except Exception as e:
        print(f"Exception during request: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_llm())
