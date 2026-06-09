# 🤖 Verdia AI Chatbot Widget Platform

Welcome to the **Verdia AI Chatbot Widget Platform**—a premium, commercial-grade SaaS solution featuring a white-label embeddable AI live-chat widget, a robust FastAPI RAG backend, a cloud Supabase database, and a stunning Next.js 14 glassmorphic dashboard.

This repository contains all code and distributable integration files completed to absolute production-ready perfection ahead of the kick-off milestone.

---

## 📂 Project Repository Structure

*   `admin-dashboard/` - **SaaS Admin Control Panel** built with Next.js 14 App Router, featuring hashed cookie authentication, interactive visual widget customizer, AI onboarding wizard, conversation logs, and API key manager.
*   `backend-api/` - **AI RAG Streaming Backend** built with FastAPI and SQLAlchemy, connected to cloud Supabase PostgreSQL and OpenRouter LLM streaming pipelines.
*   `widget-client/` - **Universal JavaScript Chat Widget** built with isolated vanilla Web Components and Shadow DOM layout (`< 30 KB` footprint).
*   `wordpress-plugin/` - **WordPress Integration wrapper**, enqueuing configuration and enqueuing the script dynamically based on plugin settings.
*   `react-package/` - **React npm Package wrapper** component (`ChatWidgetProps` interface) for modular React 18+ web apps.
*   `wp-chatbot.zip` - **Pre-Packaged Distributable WordPress Plugin** ready to be uploaded straight into any WordPress dashboard!

---

## ⚡ Quick Start: Local Setup & Running

Follow these simple steps to run the complete platform locally:

### 1. Backend Server (`backend-api`)
1.  Navigate into the `backend-api` directory:
    ```bash
    cd backend-api
    ```
2.  Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Configure your local environment by creating a `.env` file based on the config. Add your remote **Supabase PostgreSQL** database credentials and **OpenRouter API Key**:
    ```env
    DATABASE_URL="postgresql://postgres:[password]@db.scykehosibgichuorsjz.supabase.co:5432/postgres"
    QDRANT_PATH=":memory:" # In-memory local client ensures reload is 100% crash-proof
    LLM_PROVIDER="openrouter"
    OPENROUTER_API_KEY="your_openrouter_api_key"
    OPENROUTER_MODEL="openrouter/free"
    ```
4.  Start the FastAPI server:
    ```bash
    python -m uvicorn app.main:app --reload
    ```
    *The API will run at `http://localhost:8000` with automated interactive OpenAPI docs available at `http://localhost:8000/docs`.*

### 2. Next.js SaaS Dashboard (`admin-dashboard`)
1.  Navigate into the `admin-dashboard` directory:
    ```bash
    cd ../admin-dashboard
    ```
2.  Install npm dependencies:
    ```bash
    npm install
    ```
3.  Configure your environment in `.env`:
    ```env
    DATABASE_URL="postgresql://postgres:[password]@db.scykehosibgichuorsjz.supabase.co:5432/postgres"
    JWT_SECRET="your_secure_jwt_token_here"
    NEXT_PUBLIC_API_URL="http://localhost:8000"
    ```
4.  Sync database schemas with Supabase and seed the initial development user:
    ```bash
    npx prisma db push
    cd ../backend-api
    python seed_user.py
    cd ../admin-dashboard
    ```
5.  Start the Next.js dev server:
    ```bash
    npm run dev
    ```
    *The dashboard will run at `http://localhost:3000`.*

---

## 🔌 Integration Deployments

### 1. WordPress Plugin
We have pre-compiled the plugin into **`wp-chatbot.zip`** in the project root:
1.  Upload `wp-chatbot.zip` under **Plugins > Add New > Upload Plugin** in WordPress.
2.  Navigate to **Settings > AI Chatbot**, paste your live Dashboard API Key, and save.
3.  The widget is instantly live in the site's footer!

### 2. React Wrapper Component
Import the `<ChatWidget />` component directly from the `react-package/index.tsx` file inside any React layout:
```tsx
import { ChatWidget } from "./components/react-package";

export default function App() {
  return (
    <ChatWidget 
      apiKey="your_api_key_here"
      apiHost="http://localhost:8000"
      brandColor="#8B5CF6"
      welcomeMessage="Hi there! Ask us anything."
    />
  );
}
```

---

## 📋 Addressing Open Questions (Page 4 of PDF Specification)

We have carefully evaluated the open technical questions and designed the architectural layout accordingly:

*   **Q1: pgvector or Qdrant?**
    *   *Decision*: We selected **Qdrant**. Running in-memory (`:memory:`) during local development ensures 100% crash-proof reloading under Windows with zero file lock exceptions. For production, Qdrant is fully abstractable to a cloud instance without changing database logic.
*   **Q2: Multi-Language detection automatically?**
    *   *Decision*: We designed the Universal widget to fully support UTF-8, handling multilingual LLM streaming naturally. We suggest integrating auto-detection directly inside the RAG system prompt as part of a v2 release.
*   **Q3: White-label / Custom domain in v1?**
    *   *Decision*: The Admin Dashboard customizer completely white-labels the widget appearance (position, color, avatar, logo) out-of-the-box. Custom DNS domain matching is recommended for the dashboard SaaS in a v2 database routing release.
*   **Q4: Who provides LLM API Keys?**
    *   *Decision*: We built a secure, hashed **API Keys Manager** inside the Admin Dashboard. This allows Verdia to act as the primary API proxy gateway while letting each business owner manage their own scopes cleanly.
*   **Q5: creative freedom on UI?**
    *   *Decision*: We utilized our creative freedom to design a premium, glassmorphic cyberpunk dark UI system featuring harmonious ambient backdrops, neon button glows, and elegant responsive micro-animations designed to blow users away.

---

**Prepared by the Assigned Lead Developer · Confidential · Ready for Kick-Off Review**
