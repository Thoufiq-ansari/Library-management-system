/* main.js
 * Shared helpers used across every page: sidebar toggle, a small fetch
 * wrapper (api.get/post/put/del) that talks to the Flask JSON API, and a
 * reusable alert banner + confirm-delete modal helper.
 */

// ---------- Sidebar toggle (mobile) ----------
(function initSidebar() {
  const toggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!toggle || !sidebar || !backdrop) return;

  function close() {
    sidebar.classList.remove("open");
    backdrop.classList.remove("open");
  }

  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    backdrop.classList.toggle("open");
  });
  backdrop.addEventListener("click", close);
})();

// ---------- Alert banner ----------
function showAlert(message, type = "success") {
  const box = document.getElementById("alertBox");
  if (!box) {
    alert(message); // fallback (e.g. on login page before content block loads)
    return;
  }
  box.textContent = message;
  box.className = `alert-box alert-${type === "success" ? "success" : "error"}`;
  box.scrollIntoView({ behavior: "smooth", block: "start" });
  window.clearTimeout(showAlert._t);
  showAlert._t = window.setTimeout(() => {
    box.classList.add("hidden");
  }, 5000);
}

// ---------- Fetch wrapper ----------
const api = {
  async _request(method, url, body) {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    let response;
    try {
      response = await fetch(url, options);
    } catch (networkErr) {
      throw new Error("Network error: could not reach the server.");
    }

    if (response.status === 401) {
      window.location.href = "/login";
      throw new Error("Session expired. Redirecting to login...");
    }

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const message = (data && data.error) || `Request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  },
  get(url) { return this._request("GET", url); },
  post(url, body) { return this._request("POST", url, body); },
  put(url, body) { return this._request("PUT", url, body); },
  del(url) { return this._request("DELETE", url); },
};

// ---------- Small utilities ----------
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Generic confirm-delete modal ----------
// Pages that include #confirmModalBackdrop can call:
//   confirmAction("Delete this book?", async () => { ...do delete... });
function confirmAction(message, onConfirm) {
  const backdrop = document.getElementById("confirmModalBackdrop");
  const text = document.getElementById("confirmModalText");
  const confirmBtn = document.getElementById("confirmDeleteBtn");
  const cancelBtn = document.getElementById("cancelConfirm");
  const closeBtn = document.getElementById("closeConfirmModal");
  if (!backdrop) return;

  text.textContent = message;
  backdrop.classList.remove("hidden");

  function cleanup() {
    backdrop.classList.add("hidden");
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", cleanup);
    closeBtn.removeEventListener("click", cleanup);
  }

  async function handleConfirm() {
    cleanup();
    await onConfirm();
  }

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", cleanup);
  closeBtn.addEventListener("click", cleanup);
}
