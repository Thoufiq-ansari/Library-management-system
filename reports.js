/* reports.js */

const reportTableHead = document.getElementById("reportTableHead");
const reportTableBody = document.getElementById("reportTableBody");
const tabButtons = document.querySelectorAll(".tab-btn");

// Column definitions per report type: [header label, row-object key or a function(row) -> html]
const REPORT_COLUMNS = {
  books: [
    ["ID", (r) => r.book_id],
    ["ISBN", (r) => escapeHtml(r.isbn)],
    ["Title", (r) => escapeHtml(r.title)],
    ["Author", (r) => escapeHtml(r.author)],
    ["Category", (r) => escapeHtml(r.category || "-")],
    ["Total", (r) => r.total_copies],
    ["Available", (r) => r.available_copies],
  ],
  available: [
    ["ID", (r) => r.book_id],
    ["ISBN", (r) => escapeHtml(r.isbn)],
    ["Title", (r) => escapeHtml(r.title)],
    ["Author", (r) => escapeHtml(r.author)],
    ["Available", (r) => r.available_copies],
  ],
  issued: [
    ["Txn ID", (r) => r.transaction_id],
    ["Book", (r) => escapeHtml(r.book_title)],
    ["Member", (r) => escapeHtml(r.member_name)],
    ["Issue Date", (r) => escapeHtml(r.issue_date)],
    ["Due Date", (r) => escapeHtml(r.due_date)],
    ["Status", (r) => r.is_overdue ? '<span class="badge badge-danger">Overdue</span>' : '<span class="badge badge-success">Issued</span>'],
  ],
  overdue: [
    ["Txn ID", (r) => r.transaction_id],
    ["Book", (r) => escapeHtml(r.book_title)],
    ["Member", (r) => escapeHtml(r.member_name)],
    ["Issue Date", (r) => escapeHtml(r.issue_date)],
    ["Due Date", (r) => `<span class="badge badge-danger">${escapeHtml(r.due_date)}</span>`],
  ],
  members: [
    ["ID", (r) => r.member_id],
    ["Name", (r) => escapeHtml(r.name)],
    ["Email", (r) => escapeHtml(r.email)],
    ["Phone", (r) => escapeHtml(r.phone)],
    ["Department", (r) => escapeHtml(r.department || "-")],
    ["Registered On", (r) => escapeHtml(r.registration_date)],
  ],
  history: [
    ["Txn ID", (r) => r.transaction_id],
    ["Book", (r) => escapeHtml(r.book_title)],
    ["Member", (r) => escapeHtml(r.member_name)],
    ["Issue Date", (r) => escapeHtml(r.issue_date)],
    ["Due Date", (r) => escapeHtml(r.due_date)],
    ["Return Date", (r) => r.return_date ? escapeHtml(r.return_date) : "-"],
    ["Status", (r) => r.status === "returned" ? '<span class="badge badge-muted">Returned</span>' : '<span class="badge badge-success">Issued</span>'],
  ],
};

async function loadReport(type) {
  const columns = REPORT_COLUMNS[type];
  reportTableHead.innerHTML = `<tr>${columns.map(([label]) => `<th>${label}</th>`).join("")}</tr>`;
  reportTableBody.innerHTML = `<tr><td colspan="${columns.length}" class="empty-row">Loading...</td></tr>`;

  try {
    const rows = await api.get(`/api/reports/${type}`);
    if (!rows.length) {
      reportTableBody.innerHTML = `<tr><td colspan="${columns.length}" class="empty-row">No records found.</td></tr>`;
      return;
    }
    reportTableBody.innerHTML = rows.map((row) =>
      `<tr>${columns.map(([, fn]) => `<td>${fn(row)}</td>`).join("")}</tr>`
    ).join("");
  } catch (err) {
    reportTableBody.innerHTML = `<tr><td colspan="${columns.length}" class="empty-row">Failed to load report.</td></tr>`;
    showAlert(err.message, "error");
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    loadReport(btn.dataset.report);
  });
});

loadReport("books");
