"""
init_db.py
----------
Run this once to create the SQLite database file and its tables, and to
create a default admin account so you can log in for the first time.

Usage:
    python init_db.py
"""

import sqlite3
import getpass
from werkzeug.security import generate_password_hash

from database import init_db, DB_PATH


def create_default_admin(username="thoufiq", password="thoufiq0110"):
    """Insert a default admin user if the users table is empty."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM users")
    count = cur.fetchone()[0]

    if count == 0:
        password_hash = generate_password_hash(password)
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        conn.commit()
        print(f"Default admin account created -> username: '{username}', password: '{password}'")
        print("IMPORTANT: Log in and change this password in production use.")
    else:
        print("A user already exists in the database. Skipping default admin creation.")

    conn.close()


if __name__ == "__main__":
    print("Initializing database schema...")
    init_db()
    print(f"Database ready at: {DB_PATH}")

    create_default_admin()
    print("Database setup complete.")
