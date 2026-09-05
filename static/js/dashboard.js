/* dashboard.js */

async function loadStats() {
  try {
    const stats = await api.get("/api/dashboard/stats");
    document.getElementById("statTotalBooks").textContent = stats.total_books;
    document.getElementById("statAvailableBooks").textContent = stats.available_books;
    document.getElementById("statIssuedBooks").textContent = stats.issued_books;
    document.getElementById("statTotalMembers").textContent = stats.total_members;
    document.getElementById("statOverdueBooks").textContent = stats.overdue_books;
  } catch (err) {
    showAlert(err.message, "error");
  }
}

loadStats();
