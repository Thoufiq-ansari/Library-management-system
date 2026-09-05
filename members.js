/* members.js */

const membersTableBody = document.getElementById("membersTableBody");
const memberSearchInput = document.getElementById("memberSearch");
const memberModalBackdrop = document.getElementById("memberModalBackdrop");
const memberForm = document.getElementById("memberForm");
const memberModalTitle = document.getElementById("memberModalTitle");
const memberDetailBackdrop = document.getElementById("memberDetailBackdrop");
const memberDetailBody = document.getElementById("memberDetailBody");

let searchDebounce = null;

function renderMembersTable(members) {
  if (!members.length) {
    membersTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">No members found.</td></tr>`;
    return;
  }

  membersTableBody.innerHTML = members.map((m) => `
    <tr>
      <td>${m.member_id}</td>
      <td><a href="#" onclick="viewMember(${m.member_id}); return false;">${escapeHtml(m.name)}</a></td>
      <td>${escapeHtml(m.email)}</td>
      <td>${escapeHtml(m.phone)}</td>
      <td>${escapeHtml(m.department || "-")}</td>
      <td>${escapeHtml(m.registration_date)}</td>
      <td class="row-actions">
        <button class="btn btn-secondary btn-small" onclick="editMember(${m.member_id})">Edit</button>
        <button class="btn btn-danger btn-small" onclick="deleteMember(${m.member_id}, '${escapeHtml(m.name).replace(/'/g, "\\'")}')">Delete</button>
      </td>
    </tr>`).join("");
}

async function loadMembers(query = "") {
  membersTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">Loading members...</td></tr>`;
  try {
    const url = query ? `/api/members?q=${encodeURIComponent(query)}` : "/api/members";
    const members = await api.get(url);
    renderMembersTable(members);
  } catch (err) {
    membersTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">Failed to load members.</td></tr>`;
    showAlert(err.message, "error");
  }
}

memberSearchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadMembers(memberSearchInput.value.trim()), 300);
});

function openMemberModal(member = null) {
  memberForm.reset();
  document.getElementById("memberId").value = "";
  if (member) {
    memberModalTitle.textContent = "Edit Member";
    document.getElementById("memberId").value = member.member_id;
    document.getElementById("name").value = member.name;
    document.getElementById("email").value = member.email;
    document.getElementById("phone").value = member.phone;
    document.getElementById("department").value = member.department || "";
  } else {
    memberModalTitle.textContent = "Add Member";
  }
  memberModalBackdrop.classList.remove("hidden");
}

function closeMemberModal() {
  memberModalBackdrop.classList.add("hidden");
}

document.getElementById("openAddMemberBtn").addEventListener("click", () => openMemberModal());
document.getElementById("closeMemberModal").addEventListener("click", closeMemberModal);
document.getElementById("cancelMemberForm").addEventListener("click", closeMemberModal);
document.getElementById("closeMemberDetail").addEventListener("click", () => memberDetailBackdrop.classList.add("hidden"));

async function editMember(memberId) {
  try {
    const member = await api.get(`/api/members/${memberId}`);
    openMemberModal(member);
  } catch (err) {
    showAlert(err.message, "error");
  }
}

async function viewMember(memberId) {
  try {
    const member = await api.get(`/api/members/${memberId}`);
    const historyRows = member.history.length
      ? member.history.map((h) => `
          <tr>
            <td>${escapeHtml(h.book_title)}</td>
            <td>${escapeHtml(h.issue_date)}</td>
            <td>${escapeHtml(h.due_date)}</td>
            <td>${h.return_date ? escapeHtml(h.return_date) : "-"}</td>
            <td>${h.status === "returned" ? '<span class="badge badge-muted">Returned</span>' : '<span class="badge badge-success">Issued</span>'}</td>
          </tr>`).join("")
      : `<tr><td colspan="5" class="empty-row">No borrowing history.</td></tr>`;

    memberDetailBody.innerHTML = `
      <div class="detail-grid">
        <div><span>Member ID</span><strong>${member.member_id}</strong></div>
        <div><span>Name</span><strong>${escapeHtml(member.name)}</strong></div>
        <div><span>Email</span><strong>${escapeHtml(member.email)}</strong></div>
        <div><span>Phone</span><strong>${escapeHtml(member.phone)}</strong></div>
        <div><span>Department</span><strong>${escapeHtml(member.department || "-")}</strong></div>
        <div><span>Registered On</span><strong>${escapeHtml(member.registration_date)}</strong></div>
      </div>
      <h3 style="font-size:1rem;margin-bottom:8px;">Borrowing History</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Book</th><th>Issue Date</th><th>Due Date</th><th>Return Date</th><th>Status</th></tr></thead>
          <tbody>${historyRows}</tbody>
        </table>
      </div>`;
    memberDetailBackdrop.classList.remove("hidden");
  } catch (err) {
    showAlert(err.message, "error");
  }
}

async function deleteMember(memberId, name) {
  confirmAction(`Delete member "${name}"? This cannot be undone.`, async () => {
    try {
      const res = await api.del(`/api/members/${memberId}`);
      showAlert(res.message, "success");
      loadMembers(memberSearchInput.value.trim());
    } catch (err) {
      showAlert(err.message, "error");
    }
  });
}

memberForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const memberId = document.getElementById("memberId").value;
  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    department: document.getElementById("department").value.trim(),
  };

  try {
    const res = memberId
      ? await api.put(`/api/members/${memberId}`, payload)
      : await api.post("/api/members", payload);
    showAlert(res.message, "success");
    closeMemberModal();
    loadMembers(memberSearchInput.value.trim());
  } catch (err) {
    showAlert(err.message, "error");
  }
});

loadMembers();
