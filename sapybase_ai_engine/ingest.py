import os
import psycopg2
from pgvector.psycopg2 import register_vector
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from embedding_config import get_embedding_model, EMBEDDING_DIMENSIONS

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
COMPANY_ID = os.getenv("Sapybase_COMPANY_ID")


def list_companies():
    """Run this to find your real company ID if ingest fails with FK violation."""
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT id, company_name, allowed_origin FROM companies ORDER BY created_at DESC LIMIT 10")
    rows = cursor.fetchall()
    print("=== Companies in DB ===")
    for row in rows:
        print(f"  id={row[0]}  name={row[1]}  origin={row[2]}")
    cursor.close()
    conn.close()

SOURCE_URL = "Sapybase.com/core-services"

PARENT_CHUNK_SIZE = 1500
PARENT_CHUNK_OVERLAP = 150
CHILD_CHUNK_SIZE = 300
CHILD_CHUNK_OVERLAP = 50


def ingest_knowledge():
    print("Starting Ingestion Pipeline (parent-child chunking)...")

    with open("Sapybase_core.md", "r", encoding="utf-8") as file:
        raw_text = file.read()

    parent_splitter = RecursiveCharacterTextSplitter(
        chunk_size=PARENT_CHUNK_SIZE, chunk_overlap=PARENT_CHUNK_OVERLAP
    )
    child_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHILD_CHUNK_SIZE, chunk_overlap=CHILD_CHUNK_OVERLAP
    )

    parent_texts = parent_splitter.split_text(raw_text)
    print(f"Split into {len(parent_texts)} parent chunks.")

    embeddings_model = get_embedding_model("retrieval_document")

    conn = psycopg2.connect(DB_URL)
    register_vector(conn)
    cursor = conn.cursor()

    # Clear existing rows for this source before re-ingesting
    cursor.execute(
        "DELETE FROM company_knowledge WHERE company_id = %s AND url = %s",
        (COMPANY_ID, SOURCE_URL)
    )
    conn.commit()
    print("Cleared existing rows for this source.")

    total_parents = 0
    total_children = 0

    for p_idx, parent_text in enumerate(parent_texts):
        # Insert parent row (no embedding — not searched, only returned as context)
        cursor.execute(
            """
            INSERT INTO company_knowledge (company_id, url, content, embedding, chunk_type, parent_id)
            VALUES (%s, %s, %s, NULL, 'parent', NULL)
            RETURNING id
            """,
            (COMPANY_ID, SOURCE_URL, parent_text)
        )
        parent_id = cursor.fetchone()[0]
        total_parents += 1

        child_texts = child_splitter.split_text(parent_text)
        for c_idx, child_text in enumerate(child_texts):
            vector = embeddings_model.embed_query(child_text)
            if len(vector) > EMBEDDING_DIMENSIONS:
                vector = vector[:EMBEDDING_DIMENSIONS]

            cursor.execute(
                """
                INSERT INTO company_knowledge (company_id, url, content, embedding, chunk_type, parent_id)
                VALUES (%s, %s, %s, %s, 'child', %s)
                """,
                (COMPANY_ID, SOURCE_URL, child_text, vector, parent_id)
            )
            total_children += 1
            print(f"  Parent {p_idx + 1}/{len(parent_texts)}, child {c_idx + 1}/{len(child_texts)} ingested.")

        conn.commit()

    cursor.close()
    conn.close()
    print(f"Ingestion complete. {total_parents} parents, {total_children} child chunks.")


if __name__ == "__main__":
    ingest_knowledge()