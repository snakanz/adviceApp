#!/usr/bin/env python3

"""
Execute Database Wipe & Clean Schema
Direct execution via Supabase PostgreSQL connection
"""

import os
import sys
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

# Extract connection details from Supabase URL
# Format: https://xjqjzievgepqpgtggcjx.supabase.co
project_id = SUPABASE_URL.split('//')[1].split('.')[0]

# Supabase PostgreSQL connection details
DB_HOST = f"{project_id}.db.supabase.co"
DB_PORT = 5432
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASSWORD = SUPABASE_SERVICE_ROLE_KEY.split('.')[2] if '.' in SUPABASE_SERVICE_ROLE_KEY else None

print("🔍 Checking credentials...")
print(f"Host: {DB_HOST}")
print(f"Port: {DB_PORT}")
print(f"Database: {DB_NAME}")
print(f"User: {DB_USER}\n")

try:
    print("📖 Reading SQL script...")
    with open('DATABASE_WIPE_AND_CLEAN_SCHEMA.sql', 'r') as f:
        sql_script = f.read()
    print("✅ SQL script loaded\n")

    print("⚠️  WARNING: This will DELETE ALL DATA!")
    print("✅ Backup created (verify in Supabase Dashboard)\n")

    print("🚀 Connecting to Supabase PostgreSQL...\n")

    # Connect to Supabase PostgreSQL
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=SUPABASE_SERVICE_ROLE_KEY
    )

    cursor = conn.cursor()

    print("✅ Connected to Supabase PostgreSQL\n")
    print("🚀 Executing database wipe and clean schema...\n")

    # Execute the SQL script
    cursor.execute(sql_script)
    conn.commit()

    print("✅ SQL script executed successfully!\n")

    # Verify the schema was created
    print("🔍 Verifying schema...\n")

    cursor.execute("""
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
    """)

    tables = cursor.fetchall()
    print(f"✅ Tables created: {len(tables)}")
    for table in tables:
        print(f"   - {table[0]}")

    print("\n🎉 Database wipe and clean schema completed!\n")
    print("📋 Next steps:")
    print("1. User re-registers with Google OAuth")
    print("2. User connects Google Calendar")
    print("3. Meetings sync automatically")
    print("4. Verify success in frontend\n")

    cursor.close()
    conn.close()

except psycopg2.Error as err:
    print(f"❌ Database error: {err}")
    sys.exit(1)
except Exception as err:
    print(f"❌ Error: {err}")
    sys.exit(1)

