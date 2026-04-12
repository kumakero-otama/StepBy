// ===============================================
// StepBy — road_info_detail.js
// 既存ロジックを保持し、新HTMLのIDに合わせたバージョン
// ===============================================

const API_BASE = "https://barrierfree-map.loophole.site";
const apiFetch = (url, opts) => (window.AuthToken && window.AuthToken.getAccessToken()) ? window.AuthToken.authFetch(url, opts) : fetch(url, opts);

const detailLoadingEl = document.getElementById("detail-loading");
const detailContentEl = document.getElementById("detail-content");
const detailErrorEl = document.getElementById("detail-error");
const tagsListEl = document.getElementById("tags-list");
const postsListEl = document.getElementById("posts-list");
const postCountEl = document.getElementById("post-count");
const backBtn = document.getElementById("back-btn");
const postSelfBtn = document.getElementById("post-self-btn");
const commentModalEl = document.getElementById("comment-modal");
const commentCloseBtn = document.getElementById("comment-close-btn");
const commentSubmitBtn = document.getElementById("comment-submit-btn");
const commentBodyInputEl = document.getElementById("comment-body-input");
const commentPhotoLibraryBtn = document.getElementById("comment-photo-library-btn");
const commentCameraBtn = document.getElementById("comment-camera-btn");
const commentPhotoLibraryInput = document.getElementById("comment-photo-library-input");
const commentCameraInput = document.getElementById("comment-camera-input");
const commentImagePreviewEl = document.getElementById("comment-image-preview");
const commentSubmitLoadingEl = document.getElementById("comment-submit-loading");
const commentResultModalEl = document.getElementById("comment-result-modal");
const commentResultMessageEl = document.getElementById("comment-result-message");
const commentResultOkBtn = document.getElementById("comment-result-ok-btn");
const selectedCommentImages = [];
let currentPointId = null;

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDate(dateRaw) {
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${d} ${hh}:${mm}`;
}

function setError(message) {
    if (detailLoadingEl) detailLoadingEl.classList.add("hidden");
    if (detailContentEl) detailContentEl.classList.add("hidden");
    if (detailErrorEl) { detailErrorEl.textContent = message; detailErrorEl.classList.remove("hidden"); }
    // 消去ボタンは常に表示したままにする（アクションボタンは隠さない）
}

function renderTags(tags) {
    if (!tagsListEl) return;
    if (!Array.isArray(tags) || tags.length < 1) {
        tagsListEl.innerHTML = '<span class="tag-chip"><i class="fas fa-minus"></i> なし</span>';
        return;
    }

    const tagIcons = {
        "音響信号機": "fa-volume-up",
        "点字ブロック": "fa-braille",
        "感知式信号機": "fa-traffic-light",
        "スロープ": "fa-wheelchair",
        "横断歩道": "fa-road",
        "エレベーター": "fa-elevator",
        "手すり": "fa-hand-holding-heart",
        "注意箇所": "fa-triangle-exclamation",
    };

    tagsListEl.innerHTML = tags
        .map((tag) => {
            const label = escapeHtml(tag && tag.labelJa);
            const icon = tagIcons[label] || "fa-tag";
            return `<span class="tag-chip"><i class="fas ${icon}"></i> ${label}</span>`;
        })
        .join("");
}

function renderPosts(posts) {
    if (!postsListEl) return;
    const safePosts = Array.isArray(posts) ? posts : [];
    if (postCountEl) postCountEl.textContent = `(全${safePosts.length}件)`;
    if (safePosts.length < 1) {
        postsListEl.innerHTML = '<div class="post-card"><p style="color:var(--text-light);text-align:center;">投稿はまだありません。</p></div>';
        return;
    }

    postsListEl.innerHTML = safePosts
        .map((post) => {
            const media = Array.isArray(post.media) ? post.media : [];
            const mediaHtml = media
                .map((item) => `<img src="${escapeHtml(item.url)}" alt="投稿画像" loading="lazy" />`)
                .join("");
            return `
        <article class="post-card">
          <div class="post-head">
            <div class="avatar"><i class="fas fa-user" style="font-size:16px;color:#fff;"></i></div>
            <div class="post-meta">
              <span class="user-name" style="font-weight:600;font-size:13px;display:block;">${escapeHtml(post.authorUsername || (post.author && post.author.name) || "不明なユーザー")}</span>
              <span class="date">${escapeHtml(formatDate(post.createdAt))}</span>
            </div>
          </div>
          <div class="post-body">${escapeHtml(post.body)}</div>
          <div class="media-list">${mediaHtml}</div>
        </article>
      `;
        })
        .join("");
}

function showContent() {
    if (detailLoadingEl) detailLoadingEl.classList.add("hidden");
    if (detailErrorEl) detailErrorEl.classList.add("hidden");
    if (detailContentEl) detailContentEl.classList.remove("hidden");
}

function setCommentModalOpen(open) {
    if (!commentModalEl) return;
    open ? commentModalEl.classList.remove("hidden") : commentModalEl.classList.add("hidden");
}

function renderCommentImagePreview() {
    if (!commentImagePreviewEl) return;
    if (selectedCommentImages.length < 1) {
        commentImagePreviewEl.innerHTML = '<div class="comment-image-empty">選択された画像がここに表示されます</div>';
        return;
    }
    commentImagePreviewEl.innerHTML = `<div class="comment-image-list">${selectedCommentImages
        .map((item) => `
      <div class="comment-image-item">
        <button class="comment-image-remove-btn" type="button" data-remove-image-id="${escapeHtml(item.id)}"><i class="fas fa-times"></i></button>
        <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name || "投稿画像")}" loading="lazy" />
      </div>
    `)
        .join("")}</div>`;
}

function openCommentInputPicker(inputEl) {
    if (!inputEl) return;
    try { if (typeof inputEl.showPicker === "function") { inputEl.showPicker(); return; } inputEl.click(); } catch { inputEl.click(); }
}

function addCommentImageFiles(files) {
    files.forEach((file) => {
        if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) return;
        selectedCommentImages.push({
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name || "選択された画像",
            url: URL.createObjectURL(file),
            file,
        });
    });
    renderCommentImagePreview();
}

function removeCommentImageById(imageId) {
    const index = selectedCommentImages.findIndex((item) => item.id === imageId);
    if (index < 0) return;
    const removed = selectedCommentImages[index];
    if (removed && removed.url) URL.revokeObjectURL(removed.url);
    selectedCommentImages.splice(index, 1);
    renderCommentImagePreview();
}

function setCommentSubmittingVisible(visible) {
    if (!commentSubmitLoadingEl) return;
    visible ? commentSubmitLoadingEl.classList.remove("hidden") : commentSubmitLoadingEl.classList.add("hidden");
}

function showCommentResultModal(message) {
    if (!commentResultModalEl || !commentResultMessageEl) return;
    commentResultMessageEl.textContent = message;
    commentResultModalEl.classList.remove("hidden");
}

function hideCommentResultModal() {
    if (!commentResultModalEl) return;
    commentResultModalEl.classList.add("hidden");
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { if (typeof reader.result === "string") { resolve(reader.result); return; } reject(new Error("file_read_failed")); };
        reader.onerror = () => reject(new Error("file_read_failed"));
        reader.readAsDataURL(file);
    });
}

async function buildCommentImagePayloads() {
    const payloads = [];
    for (const item of selectedCommentImages) {
        if (!item || !item.file) continue;
        const dataUrl = await fileToDataUrl(item.file);
        payloads.push({ name: item.name || item.file.name || "image", dataUrl });
    }
    return payloads;
}

async function submitComment() {
    if (!Number.isInteger(currentPointId) || currentPointId <= 0) { alert("投稿先の道情報IDが不正です。"); return; }
    if (!commentSubmitBtn) return;
    const detail = commentBodyInputEl ? commentBodyInputEl.value.trim() : "";
    if (!detail && selectedCommentImages.length < 1) { alert("本文または画像を入力してください。"); return; }

    commentSubmitBtn.disabled = true;
    setCommentSubmittingVisible(true);
    try {
        const images = await buildCommentImagePayloads();
        const res = await apiFetch(`${API_BASE}/api/road-info`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pointId: currentPointId, detail, images }),
        });
        if (res.status === 404) throw new Error("point_not_found");
        if (!res.ok) { const payload = await res.json().catch(() => ({})); throw new Error(payload?.error || `submit_failed_${res.status}`); }

        if (commentBodyInputEl) commentBodyInputEl.value = "";
        selectedCommentImages.forEach((item) => { if (item?.url) URL.revokeObjectURL(item.url); });
        selectedCommentImages.splice(0, selectedCommentImages.length);
        renderCommentImagePreview();
        setCommentModalOpen(false);
        loadRoadInfoDetail();
        showCommentResultModal("コメントの投稿が成功しました");
    } catch {
        setCommentModalOpen(false);
        showCommentResultModal("コメントの投稿が失敗しました");
    } finally {
        setCommentSubmittingVisible(false);
        commentSubmitBtn.disabled = false;
    }
}

function initActions() {
    if (postSelfBtn) { postSelfBtn.addEventListener("click", () => { setCommentModalOpen(true); if (commentBodyInputEl) commentBodyInputEl.focus(); }); }
    if (commentCloseBtn) { commentCloseBtn.addEventListener("click", () => setCommentModalOpen(false)); }
    if (commentModalEl) { commentModalEl.addEventListener("click", (e) => { if (e.target === commentModalEl) setCommentModalOpen(false); }); }

    if (commentImagePreviewEl) {
        commentImagePreviewEl.addEventListener("click", (e) => {
            const target = e.target;
            if (!target || typeof target.closest !== "function") return;
            const removeButton = target.closest("[data-remove-image-id]");
            const imageId = removeButton ? removeButton.getAttribute("data-remove-image-id") : null;
            if (imageId) removeCommentImageById(imageId);
        });
    }

    if (commentSubmitBtn) commentSubmitBtn.addEventListener("click", () => void submitComment());
    if (commentResultOkBtn) commentResultOkBtn.addEventListener("click", () => hideCommentResultModal());
    if (commentPhotoLibraryBtn && commentPhotoLibraryInput) { commentPhotoLibraryBtn.addEventListener("click", () => openCommentInputPicker(commentPhotoLibraryInput)); }
    if (commentCameraBtn && commentCameraInput) { commentCameraBtn.addEventListener("click", () => openCommentInputPicker(commentCameraInput)); }
    if (commentPhotoLibraryInput) { commentPhotoLibraryInput.addEventListener("change", () => { addCommentImageFiles(Array.from(commentPhotoLibraryInput.files || [])); commentPhotoLibraryInput.value = ""; }); }
    if (commentCameraInput) { commentCameraInput.addEventListener("change", () => { addCommentImageFiles(Array.from(commentCameraInput.files || [])); commentCameraInput.value = ""; }); }

    function goBack() { if (window.history.length > 1) { window.history.back(); return; } window.location.assign("../map/Index.html"); }

    if (backBtn) backBtn.addEventListener("click", goBack);
}

// デモ用フォールバックデータ
function showDemoContent(pointId) {
    const demoData = {
        point: {
            id: pointId,
            tags: [
                { labelJa: "点字ブロック" },
                { labelJa: "音響信号機" }
            ],
            posts: [
                { id: 1, body: "点字ブロックが整備されています。安全に通れます。", createdAt: "2026-03-16T20:26:00Z", media: [], author: { name: "おたまちゃん" } },
                { id: 2, body: "音響信号機があり、歩行者に優しい交差点です。", createdAt: "2026-03-16T20:25:00Z", media: [], author: { name: "おたまちゃん" } },
                { id: 3, body: "スロープも設置されており、車いすでも利用可能です。", createdAt: "2026-03-16T20:24:00Z", media: [], author: { name: "おたまちゃん" } }
            ]
        }
    };
    currentPointId = pointId;
    renderTags(demoData.point.tags);
    renderPosts(demoData.point.posts);
    showContent();
}



function loadRoadInfoDetail() {
    const params = new URLSearchParams(window.location.search);
    const pointId = Number(params.get("pointId"));
    if (!Number.isInteger(pointId) || pointId <= 0) { setError("道情報IDが不正です。"); return; }

    fetch(`${API_BASE}/api/road-info?pointId=${pointId}`)
        .then((res) => {
            if (res.status === 404) throw new Error("not_found");
            if (!res.ok) throw new Error(`request_failed:${res.status}`);
            return res.json();
        })
        .then((data) => {
            if (!data || !data.point) throw new Error("invalid_payload");
            currentPointId = Number(data.point.id);
            renderTags(data.point.tags);
            renderPosts(data.point.posts);
            showContent();
        })
        .catch((err) => {
            if (err.message === "not_found") { setError("対象の道情報が見つかりませんでした。"); return; }
            // API失敗時（認証エラー含む）はデモデータで表示
            showDemoContent(pointId);
        });
}


initActions();
setCommentModalOpen(false);
setCommentSubmittingVisible(false);
hideCommentResultModal();
renderCommentImagePreview();
loadRoadInfoDetail();
