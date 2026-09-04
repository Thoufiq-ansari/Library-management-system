"""
database.py
------------
Small helper module that centralizes all SQLite connection handling for the
Flask app. Using Flask's `g` object means one connection is opened per
request and automatically closed when the request ends.
"""

import sqlite3
import os
from flask import g

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "library.db")
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")


def get_db():
    """Return a SQLite connection stored on Flask's `g` request context.

    Rows are returned as sqlite3.Row objects so columns can be accessed by
    name (e.g. row["title"]) as well as by index.
    """
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(e=None):
    """Close the database connection at the end of the request, if open."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_app(app):
    """Register the close_db function to run after every request."""
    app.teardown_appcontext(close_db)


def init_db():
    """Create all tables from schema.sql. Safe to run multiple times
    because every statement uses `IF NOT EXISTS`."""
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, "r") as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()
