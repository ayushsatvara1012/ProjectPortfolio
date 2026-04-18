import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# ── Embedding Model Configuration ────────────────────────────────────────────
# To upgrade the embedding model in the future:
#   1. Change EMBEDDING_MODEL and EMBEDDING_DIMENSIONS below.
#   2. Re-run ingest.py (or wipe + re-embed all company_knowledge rows).
#   3. If dimensions change, also update the vector(N) column in your DB schema.
# ─────────────────────────────────────────────────────────────────────────────

EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768  # gemini-embedding-001 native output dimension


def get_embedding_model(task_type: str) -> GoogleGenerativeAIEmbeddings:
    """Return a configured embedding model for the given task type.

    task_type: 'retrieval_document' when ingesting, 'retrieval_query' when querying.
    """
    return GoogleGenerativeAIEmbeddings(
        model=EMBEDDING_MODEL,
        google_api_key=os.getenv("GEMINI_API_KEY"),
        task_type=task_type,
    )
