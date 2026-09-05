/* issue.js */

const memberSelect = document.getElementById("memberSelect");
const bookSelect = document.getElementById("bookSelect");
const issueForm = document.getElementById("issueForm");
const issuedTableBody = document.getElementById("issuedTableBody");
const bookAvailabilityHint = document.getElementById("bookAvailabilityHint");

let booksCache = [];

async function loadDropdownData() {
  try {
    const [members, books] = await Promise.all([
      api.get("/api/members"),
      api.get("/api/books"),
    ]);

    memberSelect.innerHTML = '<option value="">-- Select a member --</option>' +
      members.map((m) => `<option value="${m.member_id}">${escapeHtml(m.name)} (ID: ${m.member_id})</option>`).join("");

    booksCache = books;
    bookSelect.innerHTML = '<option value="">-- Select a book --</option>' +
      books.map((b) => `<option value="${b.book_id}" ${b.available_copies <= 0 ? "disabled" : ""}>
          ${escapeHtml(b.title)} - ${escapeHtml(b.author)} (${b.available_copies} available)
        </option>`).join("");
  } catch (err) {
    showAlert(err.message, "error");
  }
}

bookSelect.addEventListener("change", () => {
  const book = booksCache.find((b) => String(b.book_id) === bookSelect.value);
  bookAvailabilityHint.textContent = book ? `${book.available_copies} copy(ies) currently available.` : "";
});

async function loadIssuedBooks() {
  issuedTableBody.innerHTML = `<tr><td colspan="6" class="empty-row">Loading...</td></tr>`;
  try {
    const txns = await api.get("/api/transactions?status=issued");
    if (!txns.length) {
      issuedTableBody.innerHTML = `<tr><td colspan="6" class="empty-row">No books are currently issued.</td></tr>`;
      return;
    }
    issuedTableBody.innerHTML = txns.map((t) => `
      <tr>
        <td>${t.transaction_id}</td>
        <td>${escapeHtml(t.book_title)}</td>
        <td>${escapeHtml(t.member_name)}</td>
        <td>${escapeHtml(t.issue_date)}</td>
        <td>${escapeHtml(t.due_date)}</td>
        <td>${t.is_overdue ? '<span class="badge badge-danger">Overdue</span>' : '<span class="badge badge-success">Issued</span>'}</td>
      </tr>`).join("");
  } catch (err) {
    issuedTableBody.innerHTML = `<tr><td colspan="6" class="empty-row">Failed to load data.</td></tr>`;
    showAlert(err.message, "error");
  }
}

issueForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    member_id: memberSelect.value,
    book_id: bookSelect.value,
    issue_date: document.getElementById("issueDate").value,
    due_date: document.getElementById("dueDate").value,
  };

  try {
    const res = await api.post("/api/issue", payload);
    showAlert(res.message, "success");
    issueForm.reset();
    bookAvailabilityHint.textContent = "";
    document.getElementById("issueDate").value = todayISO();
    await loadDropdownData();
    await loadIssuedBooks();
  } catch (err) {
    showAlert(err.message, "error");
  }
});

// Sensible defaults: issue date = today, due date = today + 14 days
(function setDefaultDates() {
  const issueDateInput = document.getElementById("issueDate");
  const dueDateInput = document.getElementById("dueDate");
  const today = new Date();
  issueDateInput.value = today.toISOString().slice(0, 10);
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  dueDateInput.value = due.toISOString().slice(0, 10);
})();

loadDropdownData();
loadIssuedBooks();
