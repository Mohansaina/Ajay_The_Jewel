import json
import re
from typing import List, Dict, Any, AsyncGenerator
import httpx
from app.config import settings

class LLMService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()

    async def answer_with_context(
        self, 
        query: str, 
        context_chunks: List[Dict[str, Any]], 
        history: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        """
        Streams responses back to the widget, scoped strictly to the retrieved context chunks.
        Refuses to answer if the answer cannot be found in the context.
        """
        # Check if the query is a generic pleasantry / greeting / introduction
        q_clean = query.strip().lower().replace("?", "").replace("!", "").replace(".", "")
        pleasantry_phrases = [
            "hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening",
            "howdy", "yo", "test", "who are you", "what are you", "what is your name", 
            "your name", "good name", "how are you"
        ]
        is_pleasantry = any(p in q_clean for p in pleasantry_phrases)

        if is_pleasantry:
            system_prompt = (
                "You are a helpful and friendly customer support AI assistant.\n"
                "You can greet the user, introduce yourself, and answer pleasantries naturally and warmly.\n"
                "Politely inform the user that you are here to help them answer questions about the business, "
                "and invite them to ask any specific questions they have."
            )
        else:
            if not context_chunks:
                system_prompt = (
                    "You are a helpful, warm, and friendly customer support AI assistant.\n"
                    "The business owner has not uploaded any custom documents to the Knowledge Base yet.\n"
                    "You must assist the visitor using your general, professional customer service intelligence.\n"
                    "Answer the user's query about the business naturally, politely, and comprehensively using your general knowledge.\n"
                    "Politely invite them to ask anything, and guide them with how a customer service bot can help them."
                )
            else:
                context_text = "\n\n".join([
                    f"Source Document: {chunk['doc_name']}\nContent:\n{chunk['content']}"
                    for chunk in context_chunks
                ])
                system_prompt = (
                    "You are a helpful and professional customer support AI assistant.\n"
                    "Your task is to answer the user's question using ONLY the provided document context below.\n"
                    "Strict Guidelines:\n"
                    "1. You MUST answer the query using ONLY the provided context.\n"
                    "2. If the context does not contain the answer, you must respond EXACTLY with: 'I am sorry, but I do not have enough information to answer that question.' and nothing else.\n"
                    "3. Do NOT make up facts or use external/general knowledge under any circumstances.\n"
                    "4. Be concise and polite.\n\n"
                    f"=== Context ===\n{context_text}\n==============="
                )

        # Build messages payload
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history[-5:]:  # Limit history to last 5 messages
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": query})

        if self.provider == "openai":
            if not settings.OPENAI_API_KEY:
                # Mock streaming if key is missing (for local testing without keys)
                yield "Error: OPENAI_API_KEY is not configured in backend-api/.env"
                return
            
            async for chunk in self._stream_openai(messages):
                yield chunk
        elif self.provider == "openrouter":
            if not settings.OPENROUTER_API_KEY:
                yield "Error: OPENROUTER_API_KEY is not configured in backend-api/.env"
                return
            
            async for chunk in self._stream_openrouter(messages):
                yield chunk
        else:
            if not settings.GEMINI_API_KEY:
                yield "Error: GEMINI_API_KEY is not configured in backend-api/.env"
                return
            
            async for chunk in self._stream_gemini(system_prompt, history, query):
                yield chunk

    async def generate_onboarding_questions(self, doc_text: str) -> List[str]:
        """
        Generates 10 tailored mock questions that a typical website visitor might ask
        based on the uploaded document text.
        """
        prompt = (
            "Based on the following business document, write 10 distinct, realistic questions "
            "that a website visitor or customer would ask. "
            "Return the response ONLY as a JSON list of strings, with no explanation, "
            "no markdown formatting, and no extra text. Example format: [\"question 1\", \"question 2\"]\n\n"
            f"=== Business Document ===\n{doc_text[:10000]}\n================="
        )

        if self.provider == "openai":
            if not settings.OPENAI_API_KEY:
                return [f"Mock Question {i+1} (OpenAI Key not set)" for i in range(10)]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={
                        "model": "gpt-4o",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.5
                    },
                    timeout=45.0
                )
                response.raise_for_status()
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                return self._parse_json_questions(content)
        elif self.provider == "openrouter":
            if not settings.OPENROUTER_API_KEY:
                return [f"Mock Question {i+1} (OpenRouter Key not set)" for i in range(10)]
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "Verdia AI Chatbot Widget"
                    },
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.5
                    },
                    timeout=45.0
                )
                response.raise_for_status()
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                return self._parse_json_questions(content)
        else:
            if not settings.GEMINI_API_KEY:
                return [f"Mock Question {i+1} (Gemini Key not set)" for i in range(10)]
            
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-1.5-flash')
            # Synchronous call
            response = model.generate_content(prompt)
            return self._parse_json_questions(response.text)

    def _parse_json_questions(self, text: str) -> List[str]:
        """Cleans and parses the LLM output into a list of questions."""
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        try:
            questions = json.loads(cleaned)
            if isinstance(questions, list):
                return [str(q) for q in questions[:10]]
        except Exception:
            pass
        
        # Fallback regex extraction if JSON parse fails
        questions = re.findall(r'"([^"]+)"', cleaned)
        if len(questions) >= 5:
            return questions[:10]
            
        return [
            "What are your business hours?",
            "How can I contact support?",
            "Where are you located?",
            "What services do you offer?",
            "How do I sign up for an account?",
            "What is your refund policy?",
            "Do you offer free trials?",
            "How long does shipping take?",
            "Are there custom pricing options?",
            "How secure is my data?"
        ]

    async def _stream_openai(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": "gpt-4o",
                    "messages": messages,
                    "stream": True,
                    "temperature": 0.2
                },
                timeout=30.0
            ) as response:
                if response.status_code != 200:
                    yield f"Error calling OpenAI API: {response.status_code}"
                    return
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            delta = data_json["choices"][0]["delta"]
                            if "content" in delta:
                                yield delta["content"]
                        except Exception:
                            continue

    async def _stream_gemini(
        self, 
        system_prompt: str, 
        history: List[Dict[str, str]], 
        query: str
    ) -> AsyncGenerator[str, None]:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Format the chat history for Gemini
        model = genai.GenerativeModel(
            model_name='gemini-1.5-flash',
            system_instruction=system_prompt
        )
        
        chat_contents = []
        for msg in history[-5:]:
            role = "user" if msg["role"] == "user" else "model"
            chat_contents.append({"role": role, "parts": [msg["content"]]})
        chat_contents.append({"role": "user", "parts": [query]})
        
        # Async stream in python google-generativeai is done using model.generate_content_async
        response = await model.generate_content_async(chat_contents, stream=True)
        async for chunk in response:
            yield chunk.text

    async def _stream_openrouter(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "Verdia AI Chatbot Widget",
                    "Content-Type": "application/json"
                },
                json={
                    "model": settings.OPENROUTER_MODEL,
                    "messages": messages,
                    "stream": True,
                    "temperature": 0.2
                },
                timeout=30.0
            ) as response:
                if response.status_code != 200:
                    yield f"Error calling OpenRouter API: {response.status_code}"
                    return
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            delta = data_json["choices"][0]["delta"]
                            if "content" in delta:
                                yield delta["content"]
                        except Exception:
                            continue

llm_service = LLMService()
