import re
import io
from typing import List, Dict, Any, Optional
import httpx
from pypdf import PdfReader
from docx import Document
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from app.config import settings

class RAGService:
    def __init__(self):
        # Qdrant client initialized locally using SQLite-like file storage path
        if settings.QDRANT_HOST:
            self.client = QdrantClient(
                host=settings.QDRANT_HOST,
                api_key=settings.QDRANT_API_KEY
            )
        else:
            self.client = QdrantClient(path=settings.QDRANT_PATH)
        
        self.collection_name = "kb_chunks"
        self._ensure_collection()

    def _ensure_collection(self):
        # We use OpenAI's text-embedding-3-small (1536 dims) or Gemini embeddings (768 dims)
        # We can dynamically decide the size, but let's default to 1536 (OpenAI standard)
        # or 768 if Gemini is preferred. Let's make it 1536 as the standard.
        vector_size = 1536 if settings.LLM_PROVIDER in ["openai", "openrouter"] else 768
        
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection_name for c in collections)
        
        if not exists:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
            )

    async def get_embedding(self, text: str) -> List[float]:
        """Generates embedding vector for a given text segment."""
        # Standard vector sizes: OpenAI = 1536, Gemini = 768, Default = 1536
        vector_size = 1536 if settings.LLM_PROVIDER in ["openai", "openrouter"] else 768

        # 1. Try OpenAI if key is present
        if settings.OPENAI_API_KEY:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        "https://api.openai.com/v1/embeddings",
                        headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                        json={
                            "input": text,
                            "model": "text-embedding-3-small"
                        },
                        timeout=30.0
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data["data"][0]["embedding"]
            except Exception as e:
                print(f"OpenAI embedding generation failed: {str(e)}")

        # 2. Try Gemini if key is present
        if settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                result = genai.embed_content(
                    model="models/embedding-001",
                    content=text,
                    task_type="retrieval_document"
                )
                return result["embedding"]
            except Exception as e:
                print(f"Gemini embedding generation failed: {str(e)}")

        # 3. Fallback: Return a mock zero-vector so it never crashes
        print("Warning: Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured for embeddings. Using mock zero-vector.")
        return [0.0] * vector_size

    def chunk_text(self, text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
        """Splits a document text into smaller overlapping chunks."""
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk_words = words[i:i + chunk_size]
            chunks.append(" ".join(chunk_words))
            i += (chunk_size - overlap)
        return chunks

    def extract_text_from_file(self, content: bytes, filename: str) -> str:
        """Extracts plain text from docx, pdf, or txt files."""
        ext = filename.split(".")[-1].lower()
        if ext == "txt":
            return content.decode("utf-8", errors="ignore")
        elif ext == "pdf":
            pdf = PdfReader(io.BytesIO(content))
            text = ""
            for page in pdf.pages:
                text_content = page.extract_text()
                if text_content:
                    text += text_content + "\n"
            return text
        elif ext == "docx":
            doc = Document(io.BytesIO(content))
            return "\n".join([p.text for p in doc.paragraphs])
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    async def scrape_url(self, url: str) -> str:
        """Fetches html content from a website and extracts plain text."""
        async with httpx.AsyncClient() as client:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            response = await client.get(url, headers=headers, follow_redirects=True, timeout=15.0)
            response.raise_for_status()
            html = response.text
            
            # Remove scripts, styles and HTML tags
            html = re.sub(r'<(script|style).*?>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<[^>]*>', ' ', html)
            text = re.sub(r'\s+', ' ', text).strip()
            return text

    async def ingest_document(self, business_id: str, content: str, doc_name: str, doc_id: str, url: Optional[str] = None):
        """Chunks, embeds, and uploads a document to Qdrant, filtered by business_id."""
        chunks = self.chunk_text(content)
        points = []
        
        for idx, chunk in enumerate(chunks):
            embedding = await self.get_embedding(chunk)
            point_id = str(uuid_from_parts(doc_id, idx))
            
            points.append(PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "business_id": business_id,
                    "doc_id": doc_id,
                    "doc_name": doc_name,
                    "content": chunk,
                    "url": url,
                    "chunk_index": idx
                }
            ))
            
        # Upload points in batches of 100
        for i in range(0, len(points), 100):
            batch = points[i:i+100]
            self.client.upsert(
                collection_name=self.collection_name,
                points=batch
            )

    async def delete_document(self, business_id: str, doc_id: str):
        """Removes all vectorized points associated with a specific document."""
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(key="business_id", match=MatchValue(value=business_id)),
                    FieldCondition(key="doc_id", match=MatchValue(value=doc_id))
                ]
            )
        )

    async def search_kb(self, business_id: str, query: str, limit: int = 4) -> List[Dict[str, Any]]:
        """Queries the vector database for relevant chunks, enforcing strict business_id separation."""
        query_vector = await self.get_embedding(query)
        
        search_result = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            query_filter=Filter(
                must=[
                    FieldCondition(key="business_id", match=MatchValue(value=business_id))
                ]
            ),
            limit=limit
        )
        
        return [
            {
                "content": hit.payload["content"],
                "doc_name": hit.payload["doc_name"],
                "url": hit.payload.get("url"),
                "score": hit.score
            }
            for hit in search_result
        ]

def uuid_from_parts(base_id: str, index: int) -> str:
    """Helper to generate deterministic UUIDs for document chunks."""
    # We create a namespace UUID based on the document's original ID
    import uuid
    namespace = uuid.UUID(base_id) if len(base_id) == 36 else uuid.NAMESPACE_DNS
    return str(uuid.uuid5(namespace, f"chunk_{index}"))

rag_service = RAGService()
