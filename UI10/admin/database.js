const keyInput = document.getElementById("admin-key");
const loadButton = document.getElementById("load-overview");
const statusEl = document.getElementById("status");
const overviewEl = document.getElementById("overview");
const summaryEl = document.getElementById("database-summary");
const cardsEl = document.getElementById("table-cards");
const tableViewEl = document.getElementById("table-view");
const tableTitleEl = document.getElementById("table-title");
const tableHeadEl = document.getElementById("table-head");
const tableBodyEl = document.getElementById("table-body");
const experimentEl = document.getElementById("experiment");
const experimentResultEl = document.getElementById("experiment-result");
let adminKey = "";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

async function adminFetch(path, options = {}) {
  if (!adminKey) throw new Error("管理者キーを入力してください");
  const headers = new Headers(options.headers || {});
  headers.set("X-StepBy-Admin-Key", adminKey);
  const fetcher = window.AuthToken && window.AuthToken.authFetch ? window.AuthToken.authFetch : fetch;
  return fetcher(path, { ...options, headers, cache: "no-store" });
}

function setStatus(message, state = "ok") {
  statusEl.textContent = message;
  statusEl.dataset.state = state;
}

function renderRows(payload) {
  const rows = payload.rows || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  tableTitleEl.textContent = `${payload.label}（最新${payload.limit}件）`;
  tableHeadEl.innerHTML = columns.length ? `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>` : "";
  tableBodyEl.innerHTML = rows.length
    ? rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(typeof row[column] === "object" ? JSON.stringify(row[column], null, 2) : row[column])}</td>`).join("")}</tr>`).join("")
    : '<tr><td>レコードはありません</td></tr>';
  tableViewEl.classList.remove("hidden");
  tableViewEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadTable(key) {
  setStatus(`${key}を読込中…`);
  const response = await adminFetch(`/api/admin/tables/${encodeURIComponent(key)}?limit=25`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  renderRows(payload);
  setStatus("読込完了");
}

async function loadOverview() {
  adminKey = keyInput.value.trim();
  setStatus("開発DBを確認中…");
  loadButton.disabled = true;
  try {
    const response = await adminFetch("/api/admin/database-overview");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    summaryEl.textContent = `${payload.database.database_name}／${formatBytes(payload.database.bytes)}／開発環境`;
    cardsEl.innerHTML = "";
    payload.tables.forEach((table) => {
      const card = document.createElement("article");
      card.className = "table-card";
      card.innerHTML = `<strong>${escapeHtml(table.label)}</strong><p><code>${escapeHtml(table.key)}</code></p><p>${table.rowCount.toLocaleString()}件／${formatBytes(table.bytes)}</p>`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "最新25件を見る";
      button.addEventListener("click", () => loadTable(table.key).catch((error) => setStatus(error.message, "error")));
      card.appendChild(button);
      cardsEl.appendChild(card);
    });
    overviewEl.classList.remove("hidden");
    experimentEl.classList.remove("hidden");
    setStatus("開発DBを読み込みました");
  } catch (error) {
    setStatus(`読込失敗：${error.message}`, "error");
  } finally { loadButton.disabled = false; }
}

async function createExperiment() {
  const label = document.getElementById("experiment-label").value.trim();
  let payload;
  try { payload = JSON.parse(document.getElementById("experiment-payload").value); }
  catch { experimentResultEl.textContent = "JSONの形式が正しくありません"; return; }
  const response = await adminFetch("/api/admin/experiments", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  experimentResultEl.innerHTML = `<strong>作成・読取確認待ち：</strong>${escapeHtml(result.experimentId)} `;
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger";
  deleteButton.textContent = "この試験データを削除して確認";
  deleteButton.addEventListener("click", async () => {
    deleteButton.disabled = true;
    try {
      const deleteResponse = await adminFetch(`/api/admin/experiments/${result.experimentId}`, { method: "DELETE" });
      const deleted = await deleteResponse.json().catch(() => ({}));
      if (!deleteResponse.ok) throw new Error(deleted.error || `HTTP ${deleteResponse.status}`);
      experimentResultEl.textContent = `削除確認済み：${deleted.experimentId}（監査履歴は保持）`;
      await loadOverview();
    } catch (error) { experimentResultEl.textContent = `削除失敗：${error.message}`; deleteButton.disabled = false; }
  });
  experimentResultEl.appendChild(deleteButton);
  await loadTable("experiment.api_records");
}

loadButton.addEventListener("click", loadOverview);
document.getElementById("close-table").addEventListener("click", () => tableViewEl.classList.add("hidden"));
document.getElementById("create-experiment").addEventListener("click", () => createExperiment().catch((error) => { experimentResultEl.textContent = `作成失敗：${error.message}`; }));
