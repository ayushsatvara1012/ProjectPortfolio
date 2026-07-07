# Sapybase AI Engine & Web App

Sapybase is an autonomous AI chatbot platform built for modern businesses. This repository contains the Next.js frontend web application and the Python (FastAPI) backend AI engine.

## Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS
- **Backend**: Python 3.12 FastAPI + Uvicorn
- **Database**: Supabase Postgres (pgvector for embeddings)
- **Auth**: Clerk
- **Billing**: Polar

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
