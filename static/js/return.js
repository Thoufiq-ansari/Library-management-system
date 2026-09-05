/* return.js */

const returnTableBody = document.getElementById("returnTableBody");
const returnSearchInput = document.getElementById("returnSearch");
const returnModalBackdrop = document.getElementById("returnModalBackdrop");
const returnForm = document.getElementById("returnForm");

let issuedTxnsCache = [];
let searchDebounce = null;

function renderReturnTable(txns) {
  if (!txns.length) {
    returnTableBody.innerHTML = `<tr><td colspan="8" class="empty-row">No issued books found.</td></tr>`;
    return;
  }

  returnTableBody.innerHTML = txns.map((t) => `
    <tr>
      <td>${t.transaction_id}</td>
      <td>${escapeHtml(t.book_title)}</td>
      <td>${escapeHtml(t.isbn)}</td>
      <td>${escapeHtml(t.member_name)}</td>
      <td>${escapeHtml(t.issue_date)}</td>
      <td>${escapeHtml(t.due_date)}</td>
      <td>${t.is_overdue ? '<span class="badge badge-danger">Overdue</span>' : '<span class="badge badge-success">Issued</span>'}</td>
      <td><button class="btn btn-primary btn-small" onclick="openReturnModal(${t.transaction_id})">Return</button></td>
    </tr>`).join("");
}

async function loadIssuedForReturn(query = "") {
  returnTableBody.innerHTML = `<tr><td colspan="8" class="empty-row">Loading...</td></tr>`;
  try {
    const txns = await api.get("/api/transactions?status=issued");
    issuedTxnsCache = txns;
    const filtered = query
      ? txns.filter((t) =>
          t.book_title.toLowerCase().includes(query.toLowerCase()) ||
          t.isbn.toLowerCase().includes(query.toLowerCase()) ||
          t.member_name.toLowerCase().includes(query.toLowerCase()))
      : txns;
    renderReturnTable(filtered);
  } catch (err) {
    returnTableBody.innerHTML = `<tr><td colspan="8" class="empty-row">Failed to load data.</td></tr>`;
    showAlert(err.message, "error");
  }
}

returnSearchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadIssuedForReturn(returnSearchInput.value.trim()), 250);
});

function openReturnModal(txnId) {
  document.getElementById("returnTxnId").value = txnId;
  document.getElementById("returnDate").value = todayISO();
  returnModalBackdrop.classList.remove("hidden");
}

function closeReturnModal() {
  returnModalBackdrop.classList.add("hidden");
}

document.getElementById("closeReturnModal").addEventListener("click", closeReturnModal);
document.getElementById("cancelReturnForm").addEventListener("click", closeReturnModal);

returnForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const txnId = document.getElementById("returnTxnId").value;
  const returnDate = document.getElementById("returnDate").value;

  try {
    const res = await api.post(`/api/return/${txnId}`, { return_date: returnDate });
    showAlert(res.message, "success");
    closeReturnModal();
    loadIssuedForReturn(returnSearchInput.value.trim());
  } catch (err) {
    showAlert(err.message, "error");
  }
});

loadIssuedForReturn();
