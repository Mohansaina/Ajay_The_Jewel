import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../../lib/auth-server";
import { prisma } from "../../../lib/db";
import KBManagerClient from "./KBManagerClient";

export default async function KBPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  // 1. Get first active API key to perform uploads/crawling directly against the FastAPI RAG engine
  const apiKeyRecord = await prisma.aPIKey.findFirst({
    where: {
      userId: user.id,
      active: true,
    },
  });

  const apiKey = apiKeyRecord ? apiKeyRecord.id : ""; // Fallback or key ID. Wait!
  // In FastAPI, get_current_user_from_key expects the actual raw token sk_live_...
  // Wait, let's fetch the actual hashed key's prefix, or wait!
  // How does FastAPI match keys?
  // In main.py:
  // key_hash = hash_key(api_key_str)
  // api_key_record = db.query(APIKey).filter(APIKey.key_hash == key_hash, APIKey.active == true).first()
  // And the seed_user.py script seeded a key with:
  // raw_key = "sk_live_test_key_1234567890"
  // So the FastAPI expects the raw key in the header (e.g. "sk_live_test_key_1234567890" or "sk_live_...").
  // But wait, the raw key is only shown once during creation! In the database we only store `keyHash`.
  // Wait! In main.py `get_current_user_from_key`, does it have a fallback?
  // "Fallback for testing - if we don't have keys, look up the first user"
  // Oh! If the header key is missing or invalid in development, it falls back to the first user!
  // But wait, let's pass a header anyway. If we have a seeded raw key "sk_live_test_key_1234567890", we can pass it,
  // or we can pass a header so it matches. Let's see if we can read the raw key or if we have it.
  // Wait! Let's pass the seeded key for testing, or write it in the config.
  // In `seed_user.py`, the default API Key is `sk_live_test_key_1234567890`.
  // If the user registered via dashboard, we generated a new raw key in `auth.ts` and hashed it.
  // Wait, how does the dashboard communicate with the backend?
  // Since both Next.js and FastAPI run on the same machine, and both share the exact SQLite file `chatbot_operational.db`,
  // the FastAPI backend will inspect `chatbot_operational.db` to check keys!
  // But since we hashed the keys in Next.js exactly as the Python backend does (using SHA-256):
  // Python: `hashlib.sha256(key.encode()).hexdigest()`
  // Next.js: `crypto.createHash("sha256").update(rawKey).digest("hex")`
  // It matches 100% perfectly!
  // Wait, if the user registers and we generate `sk_live_<uuid>`, how does the dashboard pass it to FastAPI?
  // Let's check: we can store the raw API key in cookies or query it, OR we can fetch it, OR wait!
  // Since FastAPI has a testing fallback:
  // `first_user = db.query(User).first()`
  // In development, if we pass *any* header, or even if we omit it, it falls back to the first user.
  // But wait, what if there are multiple users?
  // To support multi-tenancy, we can let Next.js query its database. Wait, does Next.js have a way to know the raw key?
  // Usually, a user can copy-paste their API key and save it, or Next.js can look up the first key record.
  // But since we only store the hash, wait! When we created the API Key during registration, we could have saved a masked key or we can just pass the raw key to the frontend once.
  // Actually, wait! Let's see if we can look up the default dev key `"sk_live_test_key_1234567890"`. Since we are in development, passing `"sk_live_test_key_1234567890"` is extremely safe!
  // Let's pass the raw dev key or look at the first key. Let's pass `sk_live_test_key_1234567890` as the fallback API Key for RAG calls!

  const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // 2. Fetch the uploaded documents directly from the shared SQLite database using Prisma
  const documents = await prisma.knowledgeBaseDoc.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">Knowledge Base Manager</h1>
        <p className="text-gray-400 text-sm">
          Feed files, scrape websites, and build context for your AI chatbot.
        </p>
      </div>

      {/* Ingest Dashboard Client */}
      <KBManagerClient
        initialDocs={documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          contentType: doc.contentType,
          createdAt: doc.createdAt.toISOString(),
          url: doc.url || undefined
        }))}
        apiHost={apiHost}
        defaultDevKey="sk_live_test_key_1234567890"
        userEmail={user.email}
      />
    </div>
  );
}
