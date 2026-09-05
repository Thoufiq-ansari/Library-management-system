/* books.js */

const booksTableBody = document.getElementById("booksTableBody");
const bookSearchInput = document.getElementById("bookSearch");
const bookModalBackdrop = document.getElementById("bookModalBackdrop");
const bookForm = document.getElementById("bookForm");
const bookModalTitle = document.getElementById("bookModalTitle");

let searchDebounce = null;

function renderBooksTable(books) {
  if (!books.length) {
    booksTableBody.innerHTML = `<tr><td colspan="10" class="empty-row">No books found.</td></tr>`;
    return;
  }

  booksTableBody.innerHTML = books.map((b) => {
    const availBadge = b.available_copies > 0
      ? `<span class="badge badge-success">${b.available_copies}</span>`
      : `<span class="badge badge-danger">0</span>`;
    return `
      <tr>
        <td>${b.book_id}</td>
        <td>${escapeHtml(b.isbn)}</td>
        <td>${escapeHtml(b.title)}</td>
        <td>${escapeHtml(b.author)}</td>
        <td>${escapeHtml(b.category || "-")}</td>
        <td>${escapeHtml(b.publisher || "-")}</td>
        <td>${b.publication_year || "-"}</td>
        <td>${b.total_copies}</td>
        <td>${availBadge}</td>
        <td class="row-actions">
          <button class="btn btn-secondary btn-small" onclick="editBook(${b.book_id})">Edit</button>
          <button class="btn btn-danger btn-small" onclick="deleteBook(${b.book_id}, '${escapeHtml(b.title).replace(/'/g, "\\'")}')">Delete</button>
        </td>
      </tr>`;
  }).join("");
}

async function loadBooks(query = "") {
  booksTableBody.innerHTML = `<tr><td colspan="10" class="empty-row">Loading books...</td></tr>`;
  try {
    const url = query ? `/api/books?q=${encodeURIComponent(query)}` : "/api/books";
    const books = await api.get(url);
    renderBooksTable(books);
  } catch (err) {
    booksTableBody.innerHTML = `<tr><td colspan="10" class="empty-row">Failed to load books.</td></tr>`;
    showAlert(err.message, "error");
  }
}

bookSearchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadBooks(bookSearchInput.value.trim()), 300);
});

function openBookModal(book = null) {
  bookForm.reset();
  document.getElementById("bookId").value = "";
  if (book) {
    bookModalTitle.textContent = "Edit Book";
    document.getElementById("bookId").value = book.book_id;
    document.getElementById("isbn").value = book.isbn;
    document.getElementById("title").value = book.title;
    document.getElementById("author").value = book.author;
    document.getElementById("category").value = book.category || "";
    document.getElementById("publisher").value = book.publisher || "";
    document.getElementById("publication_year").value = book.publication_year || "";
    document.getElementById("total_copies").value = book.total_copies;
  } else {
    bookModalTitle.textContent = "Add Book";
  }
  bookModalBackdrop.classList.remove("hidden");
}

function closeBookModal() {
  bookModalBackdrop.classList.add("hidden");
}

document.getElementById("openAddBookBtn").addEventListener("click", () => openBookModal());
document.getElementById("closeBookModal").addEventListener("click", closeBookModal);
document.getElementById("cancelBookForm").addEventListener("click", closeBookModal);

async function editBook(bookId) {
  try {
    const book = await api.get(`/api/books/${bookId}`);
    openBookModal(book);
  } catch (err) {
    showAlert(err.message, "error");
  }
}

async function deleteBook(bookId, title) {
  confirmAction(`Delete "${title}"? This cannot be undone.`, async () => {
    try {
      const res = await api.del(`/api/books/${bookId}`);
      showAlert(res.message, "success");
      loadBooks(bookSearchInput.value.trim());
    } catch (err) {
      showAlert(err.message, "error");
    }
  });
}

bookForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bookId = document.getElementById("bookId").value;
  const payload = {
    isbn: document.getElementById("isbn").value.trim(),
    title: document.getElementById("title").value.trim(),
    author: document.getElementById("author").value.trim(),
    category: document.getElementById("category").value.trim(),
    publisher: document.getElementById("publisher").value.trim(),
    publication_year: document.getElementById("publication_year").value || null,
    total_copies: document.getElementById("total_copies").value,
  };

  try {
    const res = bookId
      ? await api.put(`/api/books/${bookId}`, payload)
      : await api.post("/api/books", payload);
    showAlert(res.message, "success");
    closeBookModal();
    loadBooks(bookSearchInput.value.trim());
  } catch (err) {
    showAlert(err.message, "error");
  }
});

loadBooks();
