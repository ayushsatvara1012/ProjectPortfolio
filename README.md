# Sapybase AI Engine & Web App

Sapybase is an autonomous AI chatbot platform built for modern businesses. This repository contains the Next.js frontend web application and the Python (FastAPI) backend AI engine.

## Architecture

- **Frontend (`/src`)**: A native Next.js App Router application containing the marketing site, SaaS dashboard, and embeddable widget routes.
- **Backend (`/sapybase_ai_engine`)**: A FastAPI application powering the RAG pipeline, AI agent orchestration, and database management.

### Enterprise Embed Architecture
The chatbot widget is optimized for global performance and zero-dependency integration:
- **Edge Runtime**: The `/embed` route is powered by the Vercel Edge Runtime for sub-second global delivery.
- **API Proxying**: All client-side requests are proxied via Next.js rewrites to the FastAPI backend, obfuscating internal infrastructure and simplifying CSP whitelisting for customers.
- **Dependency Isolation**: The widget is decoupled from the main dashboard dependencies (Clerk, React Query), resulting in a minimal initial JavaScript payload.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.12+)
- Postgres with pgvector

### Running Locally

We use `concurrently` to run both the frontend and backend development servers with a single command.

1. **Install dependencies:**
   ```bash
   npm install
   cd sapybase_ai_engine
   # Ensure your python virtual environment is activated and dependencies are installed
   pip install -r requirements.txt
   cd ..
   ```

2. **Start the development servers:**
   ```bash
   npm run dev:all
   ```
   This will start:
   - Next.js frontend on `http://localhost:3000`
   - FastAPI backend on `http://localhost:8000`

### Build for Production
To build the Next.js application for production:
```bash
npm run build
npm start
```
