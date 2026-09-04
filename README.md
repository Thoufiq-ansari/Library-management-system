# Library Management System

A complete Library Management System web app: Flask (Python) backend, SQLite
database, and a vanilla HTML/CSS/JavaScript frontend.

## Folder structure

```
library_management_system/
├── app.py                  # Flask app: routes + JSON API
├── database.py              # SQLite connection helper
├── init_db.py                # Creates the DB and default admin account
├── schema.sql                # Table definitions
├── requirements.txt
├── library.db                # Created after running init_db.py
├── templates/
│   ├── base.html              # Shared layout (sidebar, topbar)
│   ├── login.html
│   ├── dashboard.html
│   ├── books.html
│   ├── members.html
│   ├── issue_book.html
│   ├── return_book.html
│   └── reports.html
└── static/
    ├── css/style.css
    └── js/
        ├── main.js
        ├── dashboard.js
        ├── books.js
        ├── members.js
        ├── issue.js
        ├── return.js
        └── reports.js
```

## 1. Installation

```bash
cd library_management_system
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Database setup

```bash
python init_db.py
```

This creates `library.db` with all tables, and a default admin account:

- **Username:** `admin`
- **Password:** `admin123`

Change this password after your first login for real use (there's no
in-app "change password" screen in this build — update it by re-running
`init_db.py` against a fresh database, or update the hash directly with
`werkzeug.security.generate_password_hash`).

## 3. Run the Flask server

```bash
python app.py
```

The server starts at `http://127.0.0.1:5000` (Flask's debug reloader is on).

## 4. Open the application

Open a browser and go to:

```
http://127.0.0.1:5000
```

You'll be redirected to the login page. Log in with `admin` / `admin123`.

## Notes

- All book/member/issue data is entered by you through the UI — the app
  ships with no fake/sample records.
- Available copies are tracked automatically: issuing a book decreases
  `available_copies`, returning increases it. Books cannot be issued when
  `available_copies` is 0.
- ISBNs and member emails must be unique; duplicates are rejected.
- A book can't be deleted while a copy is still issued to a member, and a
  member can't be deleted while they still have a book issued.
- Overdue books are any `issued` transaction whose due date is before
  today.
