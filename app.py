"""
app.py
------
Main Flask application for the Library Management System.

Contains:
  - Session-based admin authentication (login/logout)
  - Page routes that render the HTML templates
  - JSON API routes (/api/...) used by the frontend JavaScript for all
    CRUD operations (books, members, issue/return, reports)

All database access uses parameterized queries (via database.get_db()) to
prevent SQL injection. Passwords are stored using werkzeug's salted hashes.
"""

from datetime import date, datetime
from functools import wraps

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import check_password_hash

from database import get_db, init_app as init_db_app

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-secret-key-in-production"
init_db_app(app)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def login_required(view):
    """Decorator for page routes: redirects to /login if not authenticated."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)
    return wrapped


def api_login_required(view):
    """Decorator for JSON API routes: returns 401 JSON if not authenticated."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Not authenticated. Please log in again."}), 401
        return view(*args, **kwargs)
    return wrapped


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def require_fields(data, fields):
    """Return a list of missing/blank required field names."""
    missing = []
    for f in fields:
        value = data.get(f)
        if value is None or (isinstance(value, str) and value.strip() == ""):
            missing.append(f)
    return missing


def parse_date(value, field_name):
    """Validate a YYYY-MM-DD date string. Returns the string or raises ValueError."""
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return value
    except (ValueError, TypeError):
        raise ValueError(f"{field_name} must be a valid date in YYYY-MM-DD format.")


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    if session.get("user_id"):
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if session.get("user_id"):
            return redirect(url_for("dashboard"))
        return render_template("login.html")

    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""

    error = None
    if not username or not password:
        error = "Please enter both username and password."
    else:
        db = get_db()
        user = db.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        if user is None or not check_password_hash(user["password_hash"], password):
            error = "Invalid username or password."

    if error:
        return render_template("login.html", error=error), 401

    session.clear()
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    next_url = request.args.get("next") or url_for("dashboard")
    return redirect(next_url)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------------------------------------------------------------------------
# Page routes (render templates; data is loaded client-side via /api/...)
# ---------------------------------------------------------------------------

@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html", username=session.get("username"))


@app.route("/books")
@login_required
def books_page():
    return render_template("books.html", username=session.get("username"))


@app.route("/members")
@login_required
def members_page():
    return render_template("members.html", username=session.get("username"))


@app.route("/issue")
@login_required
def issue_page():
    return render_template("issue_book.html", username=session.get("username"))


@app.route("/return")
@login_required
def return_page():
    return render_template("return_book.html", username=session.get("username"))


@app.route("/reports")
@login_required
def reports_page():
    return render_template("reports.html", username=session.get("username"))


# ---------------------------------------------------------------------------
# API: Dashboard
# ---------------------------------------------------------------------------

@app.route("/api/dashboard/stats")
@api_login_required
def api_dashboard_stats():
    db = get_db()
    total_books = db.execute("SELECT COALESCE(SUM(total_copies), 0) AS n FROM books").fetchone()["n"]
    available_books = db.execute("SELECT COALESCE(SUM(available_copies), 0) AS n FROM books").fetchone()["n"]
    issued_books = db.execute("SELECT COUNT(*) AS n FROM transactions WHERE status = 'issued'").fetchone()["n"]
    total_members = db.execute("SELECT COUNT(*) AS n FROM members").fetchone()["n"]
    overdue_books = db.execute(
        "SELECT COUNT(*) AS n FROM transactions WHERE status = 'issued' AND due_date < ?",
        (date.today().isoformat(),),
    ).fetchone()["n"]

    return jsonify({
        "total_books": total_books,
        "available_books": available_books,
        "issued_books": issued_books,
        "total_members": total_members,
        "overdue_books": overdue_books,
    })


# ---------------------------------------------------------------------------
# API: Books
# ---------------------------------------------------------------------------

@app.route("/api/books", methods=["GET"])
@api_login_required
def api_books_list():
    q = (request.args.get("q") or "").strip()
    db = get_db()
    if q:
        like = f"%{q}%"
        rows = db.execute(
            """SELECT * FROM books
               WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ? OR category LIKE ?
               ORDER BY title""",
            (like, like, like, like),
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM books ORDER BY title").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/books/<int:book_id>", methods=["GET"])
@api_login_required
def api_books_get(book_id):
    db = get_db()
    row = db.execute("SELECT * FROM books WHERE book_id = ?", (book_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Book not found."}), 404
    return jsonify(dict(row))


@app.route("/api/books", methods=["POST"])
@api_login_required
def api_books_create():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["isbn", "title", "author", "total_copies"])
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400

    try:
        total_copies = int(data["total_copies"])
        if total_copies < 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Total copies must be a non-negative whole number."}), 400

    pub_year = data.get("publication_year")
    if pub_year not in (None, ""):
        try:
            pub_year = int(pub_year)
        except (ValueError, TypeError):
            return jsonify({"error": "Publication year must be a number."}), 400
    else:
        pub_year = None

    db = get_db()
    existing = db.execute("SELECT 1 FROM books WHERE isbn = ?", (data["isbn"].strip(),)).fetchone()
    if existing:
        return jsonify({"error": "A book with this ISBN already exists."}), 409

    try:
        cur = db.execute(
            """INSERT INTO books (isbn, title, author, category, publisher, publication_year,
                                    total_copies, available_copies)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["isbn"].strip(),
                data["title"].strip(),
                data["author"].strip(),
                (data.get("category") or "").strip() or None,
                (data.get("publisher") or "").strip() or None,
                pub_year,
                total_copies,
                total_copies,  # available copies = total copies when first added
            ),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        return jsonify({"error": f"Could not save book: {exc}"}), 500

    return jsonify({"message": "Book added successfully.", "book_id": cur.lastrowid}), 201


@app.route("/api/books/<int:book_id>", methods=["PUT"])
@api_login_required
def api_books_update(book_id):
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["isbn", "title", "author", "total_copies"])
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400

    db = get_db()
    book = db.execute("SELECT * FROM books WHERE book_id = ?", (book_id,)).fetchone()
    if book is None:
        return jsonify({"error": "Book not found."}), 404

    try:
        total_copies = int(data["total_copies"])
        if total_copies < 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"error": "Total copies must be a non-negative whole number."}), 400

    issued_count = book["total_copies"] - book["available_copies"]
    if total_copies < issued_count:
        return jsonify({
            "error": f"Total copies cannot be less than the {issued_count} copy(ies) currently issued."
        }), 400
    new_available = total_copies - issued_count

    pub_year = data.get("publication_year")
    if pub_year not in (None, ""):
        try:
            pub_year = int(pub_year)
        except (ValueError, TypeError):
            return jsonify({"error": "Publication year must be a number."}), 400
    else:
        pub_year = None

    duplicate = db.execute(
        "SELECT 1 FROM books WHERE isbn = ? AND book_id != ?", (data["isbn"].strip(), book_id)
    ).fetchone()
    if duplicate:
        return jsonify({"error": "Another book already uses this ISBN."}), 409

    try:
        db.execute(
            """UPDATE books SET isbn = ?, title = ?, author = ?, category = ?, publisher = ?,
                                  publication_year = ?, total_copies = ?, available_copies = ?
               WHERE book_id = ?""",
            (
                data["isbn"].strip(),
                data["title"].strip(),
                data["author"].strip(),
                (data.get("category") or "").strip() or None,
                (data.get("publisher") or "").strip() or None,
                pub_year,
                total_copies,
                new_available,
                book_id,
            ),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        return jsonify({"error": f"Could not update book: {exc}"}), 500

    return jsonify({"message": "Book updated successfully."})


@app.route("/api/books/<int:book_id>", methods=["DELETE"])
@api_login_required
def api_books_delete(book_id):
    db = get_db()
    book = db.execute("SELECT * FROM books WHERE book_id = ?", (book_id,)).fetchone()
    if book is None:
        return jsonify({"error": "Book not found."}), 404

    active = db.execute(
        "SELECT COUNT(*) AS n FROM transactions WHERE book_id = ? AND status = 'issued'",
        (book_id,),
    ).fetchone()["n"]
    if active > 0:
        return jsonify({"error": "Cannot delete a book that currently has copies issued to members."}), 409

    try:
        db.execute("DELETE FROM books WHERE book_id = ?", (book_id,))
        db.commit()
    except Exception as exc:
        db.rollback()
        return jsonify({"error": f"Could not delete book: {exc}"}), 500

    return jsonify({"message": "Book deleted successfully."})


# ---------------------------------------------------------------------------
# API: Members
# ---------------------------------------------------------------------------

@app.route("/api/members", methods=["GET"])
@api_login_required
def api_members_list():
    q = (request.args.get("q") or "").strip()
    db = get_db()
    if q:
        like = f"%{q}%"
        # Allow searching by member ID too, if the query is numeric
        if q.isdigit():
            rows = db.execute(
                """SELECT * FROM members
                   WHERE name LIKE ? OR email LIKE ? OR department LIKE ? OR member_id = ?
                   ORDER BY name""",
                (like, like, like, int(q)),
            ).fetchall()
        else:
            rows = db.execute(
                """SELECT * FROM members
                   WHERE name LIKE ? OR email LIKE ? OR department LIKE ?
                   ORDER BY name""",
                (like, like, like),
            ).fetchall()
    else:
        rows = db.execute("SELECT * FROM members ORDER BY name").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/members/<int:member_id>", methods=["GET"])
@api_login_required
def api_members_get(member_id):
    db = get_db()
    row = db.execute("SELECT * FROM members WHERE member_id = ?", (member_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Member not found."}), 404
    member = dict(row)
    history = db.execute(
        """SELECT t.*, b.title AS book_title FROM transactions t
           JOIN books b ON b.book_id = t.book_id
           WHERE t.member_id = ? ORDER BY t.issue_date DESC""",
        (member_id,),
    ).fetchall()
    member["history"] = [dict(h) for h in history]
    return jsonify(member)


@app.route("/api/members", methods=["POST"])
@api_login_required
def api_members_create():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["name", "email", "phone"])
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400

    email = data["email"].strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"error": "Please provide a valid email address."}), 400

    db = get_db()
    existing = db.execute("SELECT 1 FROM members WHERE email = ?", (email,)).fetchone()
    if existing:
        return jsonify({"error": "A member with this email already exists."}), 409

    reg_date = data.get("registration_date") or date.today().isoformat()
    try:
        parse_date(reg_date, "Registration date")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    try:
        cur = db.execute(
            """INSERT INTO members (name, email, phone, department, registration_date)
               VALUES (?, ?, ?, ?, ?)""",
            (
                data["name"].strip(),
                email,
                data["phone"].strip(),
                (data.get("department") or "").strip() or None,
                reg_date,
            ),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        return jsonify({"error": f"Could not save member: {exc}"}), 500

    return jsonify({"message": "Member added successfully.", "member_id": cur.lastrowid}), 201


@app.route("/api/members/<int:member_id>", methods=["PUT"])
@api_login_required
def api_members_update(member_id):
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["name", "email", "phone"])
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400

    email = data["email"].strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"error": "Please provide a valid email address."}), 400

    db = get_db()
    member = db.execute("SELECT 1 FROM members WHERE member_id = ?", (member_id,)).fetchone()
    if member is None:
        return jsonify({"error": "Member not found."}), 404

    duplicate = db.execute(
        "SELECT 1 FROM members WHERE email = ? AND member_id != ?", (email, member_id)
    ).fetchone()
    if duplicate:
        return jsonify({"error": "Another member already uses this email."}), 409

    try:
        db.execute(
            """UPDATE members SET name = ?, email = ?, phone = ?, department = ?
               WHERE member_id = ?""",
            (
                data["name"].strip(),
                email,
                data["phone"].strip(),
                (data.get("department") or "").strip() or None,
                member_id,
            ),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        return jsonify({"error": f"Could not update member: {exc}"}), 500

    return jsonify({"message": "Member updated successfully."})


@app.route("/api/members/<int:member_id>", methods=["DELETE"])
@api_login_required
def api_members_delete(member_id):
    db = get_db()
    member = db.execute("SELECT 1 FROM members WHERE member_id = ?", (member_id,)).fetchone()
    if member is None:
        return jsonify({"error": "Member not found."}), 404

    active = db.execute(
        "SELECT COUNT(*) AS n FROM transactions WHERE member_id = ? AND status = 'issued'",
        (member_id,),
    ).fetchone()["n"]
    if active > 0:
        return jsonify({"error": "Cannot delete a member who currently has book(s) issued."}), 409

    try:
        db.execute("DELETE FROM members WHERE member_id = ?", (member_id,))
        db.commit()
    except Exception as exc:
        db.rollback()
        return jsonify({"error": f"Could not delete member: {exc}"}), 500

    return jsonify({"message": "Member deleted successfully."})


# ---------------------------------------------------------------------------
# API: Issue / Return
# ---------------------------------------------------------------------------

@app.route("/api/transactions", methods=["GET"])
@api_login_required
def api_transactions_list():
    status = request.args.get("status")  # 'issued', 'returned', 'overdue', or None for all
    db = get_db()

    base_query = """SELECT t.*, b.title AS book_title, b.isbn, m.name AS member_name
                     FROM transactions t
                     JOIN books b ON b.book_id = t.book_id
                     JOIN members m ON m.member_id = t.member_id"""

    if status == "overdue":
        rows = db.execute(
            base_query + " WHERE t.status = 'issued' AND t.due_date < ? ORDER BY t.due_date",
            (date.today().isoformat(),),
        ).fetchall()
    elif status in ("issued", "returned"):
        rows = db.execute(
            base_query + " WHERE t.status = ? ORDER BY t.issue_date DESC", (status,)
        ).fetchall()
    else:
        rows = db.execute(base_query + " ORDER BY t.issue_date DESC").fetchall()

    today = date.today().isoformat()
    results = []
    for r in rows:
        d = dict(r)
        d["is_overdue"] = d["status"] == "issued" and d["due_date"] < today
        results.append(d)
    return jsonify(results)


@app.route("/api/issue", methods=["POST"])
@api_login_required
def api_issue_book():
    data = request.get_json(silent=True) or {}
    missing = require_fields(data, ["book_id", "member_id", "issue_date", "due_date"])
    if missing:
        return jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400

    try:
        book_id = int(data["book_id"])
        member_id = int(data["member_id"])
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid book or member selected."}), 400

    try:
        issue_date = parse_date(data["issue_date"], "Issue date")
        due_date = parse_date(data["due_date"], "Due date")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if due_date < issue_date:
        return jsonify({"error": "Due date cannot be before the issue date."}), 400

    db = get_db()

    book = db.execute("SELECT * FROM books WHERE book_id = ?", (book_id,)).fetchone()
    if book is None:
        return jsonify({"error": "Invalid book selected."}), 400

    member = db.execute("SELECT * FROM members WHERE member_id = ?", (member_id,)).fetchone()
    if member is None:
        return jsonify({"error": "Invalid member ID. Please select a registered member."}), 400

    if book["available_copies"] <= 0:
        return jsonify({"error": f'"{book["title"]}" has no available copies to issue.'}), 409

    try:
        db.execute(
            """INSERT INTO transactions (book_id, member_id, issue_date, due_date, status)
               VALUES (?, ?, ?, ?, 'issued')""",
            (book_id, member_id, issue_date, due_date),
        )
        db.execute(
            "UPDATE books SET available_copies = available_copies - 1 WHERE book_id = ?",
            (book_id,),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        return jsonify({"error": f"Could not issue book: {exc}"}), 500

    return jsonify({"message": f'"{book["title"]}" issued to {member["name"]} successfully.'}), 201


@app.route("/api/return/<int:transaction_id>", methods=["POST"])
@api_login_required
def api_return_book(transaction_id):
    data = request.get_json(silent=True) or {}
    return_date = data.get("return_date") or date.today().isoformat()
    try:
        parse_date(return_date, "Return date")
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    db = get_db()
    txn = db.execute(
        "SELECT * FROM transactions WHERE transaction_id = ?", (transaction_id,)
    ).fetchone()
    if txn is None:
        return jsonify({"error": "Transaction not found."}), 404
    if txn["status"] == "returned":
        return jsonify({"error": "This book has already been returned."}), 409

    if return_date < txn["issue_date"]:
        return jsonify({"error": "Return date cannot be before the issue date."}), 400

    try:
        db.execute(
            "UPDATE transactions SET status = 'returned', return_date = ? WHERE transaction_id = ?",
            (return_date, transaction_id),
        )
        db.execute(
            "UPDATE books SET available_copies = available_copies + 1 WHERE book_id = ?",
            (txn["book_id"],),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        return jsonify({"error": f"Could not process return: {exc}"}), 500

    return jsonify({"message": "Book marked as returned successfully."})


# ---------------------------------------------------------------------------
# API: Reports
# ---------------------------------------------------------------------------

@app.route("/api/reports/<report_type>", methods=["GET"])
@api_login_required
def api_reports(report_type):
    db = get_db()
    today = date.today().isoformat()

    if report_type == "books":
        rows = db.execute("SELECT * FROM books ORDER BY title").fetchall()
    elif report_type == "available":
        rows = db.execute(
            "SELECT * FROM books WHERE available_copies > 0 ORDER BY title"
        ).fetchall()
    elif report_type == "issued":
        rows = db.execute(
            """SELECT t.*, b.title AS book_title, b.isbn, m.name AS member_name
               FROM transactions t
               JOIN books b ON b.book_id = t.book_id
               JOIN members m ON m.member_id = t.member_id
               WHERE t.status = 'issued' ORDER BY t.due_date"""
        ).fetchall()
    elif report_type == "overdue":
        rows = db.execute(
            """SELECT t.*, b.title AS book_title, b.isbn, m.name AS member_name
               FROM transactions t
               JOIN books b ON b.book_id = t.book_id
               JOIN members m ON m.member_id = t.member_id
               WHERE t.status = 'issued' AND t.due_date < ? ORDER BY t.due_date""",
            (today,),
        ).fetchall()
    elif report_type == "members":
        rows = db.execute("SELECT * FROM members ORDER BY name").fetchall()
    elif report_type == "history":
        rows = db.execute(
            """SELECT t.*, b.title AS book_title, b.isbn, m.name AS member_name
               FROM transactions t
               JOIN books b ON b.book_id = t.book_id
               JOIN members m ON m.member_id = t.member_id
               ORDER BY t.issue_date DESC"""
        ).fetchall()
    else:
        return jsonify({"error": "Unknown report type."}), 404

    return jsonify([dict(r) for r in rows])


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Resource not found."}), 404
    return render_template("login.html", error="Page not found."), 404


@app.errorhandler(500)
def server_error(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "An unexpected server error occurred."}), 500
    return render_template("login.html", error="An unexpected server error occurred."), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
