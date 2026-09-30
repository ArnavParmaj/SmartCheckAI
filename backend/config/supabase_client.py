"""
Supabase Client Configuration
Initializes the Supabase Python client using SUPABASE_URL and SUPABASE_KEY from the .env file.
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from backend/.env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

supabase = None

try:
    from supabase import create_client, Client

    if (
        SUPABASE_URL
        and SUPABASE_URL != "your-url"
        and SUPABASE_KEY
        and SUPABASE_KEY != "your-key"
    ):
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    else:
        try:
            supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception:
            supabase = None
except ImportError:
    supabase = None
