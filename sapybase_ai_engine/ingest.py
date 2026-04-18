import os
import psycopg2
from pgvector.psycopg2 import register_vector
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from embedding_config import get_embedding_model, EMBEDDING_DIMENSIONS

# Load environment variables from .env
load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
COMPANY_ID = os.getenv("SAPYBASE_COMPANY_ID") # The UUID from Neon

def ingest_knowledge():
    print("🚀 Starting Ingestion Pipeline...")

    # 1. Read the raw Markdown text
    with open("sapybase_core.md", "r", encoding="utf-8") as file:
        raw_text = file.read()

    # 2. Chunk the text
    # 500 characters per chunk, with a 50 character overlap to keep context
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text(raw_text)
    print(f"✂️ Split document into {len(chunks)} chunks.")

    # 3. Initialize Embeddings
    embeddings_model = get_embedding_model("retrieval_document")

    # 4. Connect to Neon Database
    conn = psycopg2.connect(DB_URL)
    register_vector(conn) # Enable pgvector support in psycopg2
    cursor = conn.cursor()

    # Clear existing knowledge for this company to prevent duplicates on re-runs
    cursor.execute("DELETE FROM company_knowledge WHERE company_id = %s", (COMPANY_ID,))
    
    print("🧠 Generating Vectors and pushing to Neon...")
    
    # 5. Embed and Insert each chunk
    for i, chunk in enumerate(chunks):
        vector = embeddings_model.embed_query(chunk)
        if i == 0:
            print(f"📏 Vector dimension: {len(vector)}")

        if len(vector) > EMBEDDING_DIMENSIONS:
            vector = vector[:EMBEDDING_DIMENSIONS]
        
        # Insert into database
        cursor.execute(
            """
            INSERT INTO company_knowledge (company_id, url, content, embedding)
            VALUES (%s, %s, %s, %s)
            """,
            (COMPANY_ID, "sapybase.com/core-services", chunk, vector)
        )
        print(f"✅ Chunk {i+1}/{len(chunks)} ingested.")

    # Commit and close
    conn.commit()
    cursor.close()
    conn.close()
    print("🎉 Ingestion Complete! Your AI's memory is now active.")

if __name__ == "__main__":
    ingest_knowledge()