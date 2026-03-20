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
const commentTagSearchEl = document.getElementById("comment-tag-search");
const commentTagSelectedEl = document.getElementById("comment-tag-selected");
const commentTagListEl = document.getElementById("comment-tag-list");
const commentCompleteTagBtn = document.getElementById("comment-complete-tag-btn");
const commentSubmitLoadingEl = document.getElementById("comment-submit-loading");
const commentResultModalEl = document.getElementById("comment-result-modal");
const commentResultMessageEl = document.getElementById("comment-result-message");
const commentResultOkBtn = document.getElementById("comment-result-ok-btn");
const selectedCommentImages = [];
const selectedCommentTagIds = new Set();
const fallbackCommentTags = [
  { id: "barrier", label: "障害物あり" },
  { id: "steps", label: "段差あり" },
  { id: "slope", label: "急な坂" },
  { id: "pavement", label: "路面が荒い" },
  { id: "lighting", label: "夜間は暗い" },
];
let allCommentTags = [];
let hasLoadedCommentTags = false;
let currentPointId = null;
const authTokenApi = window.AuthToken || null;
const deleteButtonIconUrl = AppPath.toApp("/assets/buttons/delete.png");
const COMPLETE_TAG_CODE = "complete";
const COMPLETE_TAG_LABEL = "完了";
const COMPLETE_TAG_CODE_ALIASES = new Set(["complete", "completed", "done", "resolved", "inactive"]);

function authFetch(input, init) {
  if (authTokenApi && typeof authTokenApi.authFetch === "function") {
    return authTokenApi.authFetch(input, init);
  }
  return fetch(input, init);
}

// ユーザー投稿本文を安全に表示するためのHTMLエスケープ。
function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// APIの日時文字列を画面表示用の yyyy/mm/dd hh:mm へ変換する。
function formatDate(dateRaw) {
  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

// 読み込み失敗時にエラー文言だけを見せる。
function setError(message) {
  if (detailLoadingEl) {
    detailLoadingEl.classList.add("hidden");
  }
  if (detailContentEl) {
    detailContentEl.classList.add("hidden");
  }
  if (detailErrorEl) {
    detailErrorEl.textContent = message;
    detailErrorEl.classList.remove("hidden");
  }
}

// タグ一覧を箇条書きで描画する。
function renderTags(tags) {
  if (!tagsListEl) {
    return;
  }
  if (!Array.isArray(tags) || tags.length < 1) {
    tagsListEl.innerHTML = "<li>なし</li>";
    return;
  }
  tagsListEl.innerHTML = tags
    .map((tag) => `<li>${escapeHtml(tag && tag.labelJa)}</li>`)
    .join("");
}

// 投稿一覧（本文 + 画像）をカード形式で描画する。
function renderPosts(posts) {
  if (!postsListEl) {
    return;
  }
  const safePosts = Array.isArray(posts) ? posts : [];
  if (postCountEl) {
    postCountEl.textContent = `(全${safePosts.length}件)`;
  }
  if (safePosts.length < 1) {
    postsListEl.innerHTML = '<div class="post-card">投稿はまだありません。</div>';
    return;
  }

  postsListEl.innerHTML = safePosts
    .map((post) => {
      const media = Array.isArray(post.media) ? post.media : [];
      const authorName = post && post.authorUsername ? post.authorUsername : "ユーザー";
      const authorIconUrl = post && post.authorIconUrl
        ? AppPath.toApiAsset(post.authorIconUrl)
        : AppPath.toApp("/assets/account_default.png");
      const mediaHtml = media
        .map((item) => `<img src="${escapeHtml(AppPath.toApiAsset(item.url))}" alt="投稿画像" loading="lazy" />`)
        .join("");
      return `
        <article class="post-card">
          <div class="post-head">
            <img class="avatar-img" src="${escapeHtml(authorIconUrl)}" alt="${escapeHtml(authorName)}のアイコン" />
            <span class="post-author">${escapeHtml(authorName)}</span>
            <span class="post-date">${escapeHtml(formatDate(post.createdAt))}</span>
          </div>
          <div class="post-body">${escapeHtml(post.body)}</div>
          <div class="media-list">${mediaHtml}</div>
        </article>
      `;
    })
    .join("");
}

// ローディング表示から通常表示へ切り替える。
function showContent() {
  if (detailLoadingEl) {
    detailLoadingEl.classList.add("hidden");
  }
  if (detailErrorEl) {
    detailErrorEl.classList.add("hidden");
  }
  if (detailContentEl) {
    detailContentEl.classList.remove("hidden");
  }
}

// コメント投稿モーダルの表示状態を切り替える。
function setCommentModalOpen(open) {
  if (!commentModalEl) {
    return;
  }
  if (open) {
    commentModalEl.classList.remove("hidden");
    void loadCommentTags();
    return;
  }
  commentModalEl.classList.add("hidden");
}

function normalizeCommentTags(rawTags) {
  return rawTags
    .map((tag, index) => {
      if (!tag || typeof tag !== "object") {
        return null;
      }
      const idFromApi = typeof tag.id === "string" && tag.id.trim() ? tag.id.trim() : "";
      const codeFromApi = typeof tag.code === "string" && tag.code.trim() ? tag.code.trim() : "";
      const id = idFromApi || codeFromApi || `tag_${index}`;
      const labelCandidates = [tag.label, tag.labelJa, tag.labelEn, tag.labelHi, codeFromApi, idFromApi];
      const label = labelCandidates.find((v) => typeof v === "string" && v.trim()) || id;
      return { id, label: label.trim() };
    })
    .filter(Boolean);
}

function normalizeTagId(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeTagLabel(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isCompleteTag(tag) {
  if (!tag || typeof tag !== "object") {
    return false;
  }
  const tagId = normalizeTagId(tag.id);
  const label = normalizeTagLabel(tag.label);
  return COMPLETE_TAG_CODE_ALIASES.has(tagId) || label === normalizeTagLabel(COMPLETE_TAG_LABEL);
}

function ensureCompleteTagPresent() {
  if (allCommentTags.some((tag) => normalizeTagId(tag.id) === COMPLETE_TAG_CODE)) {
    return;
  }
  allCommentTags.push({ id: COMPLETE_TAG_CODE, label: COMPLETE_TAG_LABEL });
}

function hasCompleteTagSelected() {
  return Array.from(selectedCommentTagIds).some((tagId) => COMPLETE_TAG_CODE_ALIASES.has(normalizeTagId(tagId)));
}

function setCompleteTagSelected(selected) {
  if (selected) {
    selectedCommentTagIds.add(COMPLETE_TAG_CODE);
    return;
  }
  Array.from(selectedCommentTagIds).forEach((tagId) => {
    if (COMPLETE_TAG_CODE_ALIASES.has(normalizeTagId(tagId))) {
      selectedCommentTagIds.delete(tagId);
    }
  });
}

function confirmCompleteTagSelection() {
  if (!commentCompleteTagBtn) {
    return false;
  }
  const message = commentCompleteTagBtn.dataset.confirmMessage
    || "このタグがついた道情報は非表示になります。よろしいですか";
  return window.confirm(message);
}

function handleCompleteTagToggle() {
  if (hasCompleteTagSelected()) {
    setCompleteTagSelected(false);
    renderCommentTagUi();
    return;
  }
  if (!confirmCompleteTagSelection()) {
    return;
  }
  setCompleteTagSelected(true);
  renderCommentTagUi();
}

function getVisibleCommentTags() {
  const query = commentTagSearchEl ? commentTagSearchEl.value.trim().toLowerCase() : "";
  const source = query
    ? allCommentTags.filter((tag) => {
      if (isCompleteTag(tag)) {
        return false;
      }
      return tag.label.toLowerCase().includes(query) || tag.id.toLowerCase().includes(query);
    })
    : allCommentTags.filter((tag) => !isCompleteTag(tag));
  return source.sort((a, b) => {
    const aSelected = selectedCommentTagIds.has(a.id);
    const bSelected = selectedCommentTagIds.has(b.id);
    if (aSelected !== bSelected) {
      return aSelected ? -1 : 1;
    }
    return a.label.localeCompare(b.label, "ja");
  });
}

function renderSelectedCommentTags() {
  if (!commentTagSelectedEl) {
    return;
  }
  const selectedTags = allCommentTags.filter((tag) => selectedCommentTagIds.has(tag.id));
  if (selectedTags.length < 1) {
    commentTagSelectedEl.innerHTML = '<div class="comment-tag-selected-empty">未選択</div>';
    return;
  }
  commentTagSelectedEl.innerHTML = selectedTags
    .map((tag) => `<button type="button" class="comment-tag-item" data-remove-tag-id="${escapeHtml(tag.id)}">${escapeHtml(tag.label)} ×</button>`)
    .join("");
}

function renderCommentTagList() {
  if (!commentTagListEl) {
    return;
  }
  const visibleTags = getVisibleCommentTags();
  if (visibleTags.length < 1) {
    commentTagListEl.innerHTML = '<div class="comment-tag-list-empty">一致するタグがありません</div>';
    return;
  }
  commentTagListEl.innerHTML = visibleTags
    .map((tag) => `<button type="button" class="comment-tag-option" data-tag-id="${escapeHtml(tag.id)}">${escapeHtml(tag.label)}</button>`)
    .join("");
}

function renderCommentTagUi() {
  renderSelectedCommentTags();
  renderCommentTagList();
  if (commentCompleteTagBtn) {
    commentCompleteTagBtn.classList.toggle("selected", hasCompleteTagSelected());
  }
}

async function loadCommentTags() {
  if (hasLoadedCommentTags) {
    return;
  }
  try {
    const res = await authFetch("/api/post-tags");
    if (!res.ok) {
      throw new Error(`load_comment_tags_failed:${res.status}`);
    }
    const payload = await res.json();
    const tags = normalizeCommentTags(Array.isArray(payload && payload.tags) ? payload.tags : []);
    allCommentTags = tags.length > 0 ? tags : fallbackCommentTags.slice();
  } catch {
    allCommentTags = fallbackCommentTags.slice();
  } finally {
    ensureCompleteTagPresent();
    hasLoadedCommentTags = true;
    renderCommentTagUi();
  }
}

async function handleCommentTagSearchSubmit() {
  if (!commentTagSearchEl) {
    return;
  }
  const raw = commentTagSearchEl.value.trim();
  if (!raw) {
    return;
  }
  const normalizedRaw = normalizeTagId(raw);
  if (COMPLETE_TAG_CODE_ALIASES.has(normalizedRaw) || normalizeTagLabel(raw) === normalizeTagLabel(COMPLETE_TAG_LABEL)) {
    if (confirmCompleteTagSelection()) {
      setCompleteTagSelected(true);
    }
    commentTagSearchEl.value = "";
    renderCommentTagUi();
    return;
  }

  const existing = allCommentTags.find((tag) => tag.label === raw || tag.id === raw);
  if (existing) {
    if (isCompleteTag(existing)) {
      if (confirmCompleteTagSelection()) {
        setCompleteTagSelected(true);
      }
    } else {
      selectedCommentTagIds.add(existing.id);
    }
    commentTagSearchEl.value = "";
    renderCommentTagUi();
    return;
  }

  try {
    const res = await authFetch("/api/post-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: raw }),
    });
    if (!res.ok) {
      throw new Error(`create_tag_failed:${res.status}`);
    }
    const payload = await res.json();
    const normalized = normalizeCommentTags(payload && payload.tag ? [payload.tag] : []);
    if (normalized.length < 1) {
      throw new Error("invalid_created_tag");
    }
    const [tag] = normalized;
    if (!allCommentTags.some((item) => item.id === tag.id)) {
      allCommentTags.push(tag);
    }
    if (isCompleteTag(tag)) {
      if (confirmCompleteTagSelection()) {
        setCompleteTagSelected(true);
      }
    } else {
      selectedCommentTagIds.add(tag.id);
    }
  } catch (err) {
    // /api/road-info が未登録コードを自動作成するため、POST失敗時は入力値をそのまま送信対象に残す。
    const fallbackTag = { id: raw, label: raw };
    if (!allCommentTags.some((item) => item.id === fallbackTag.id)) {
      allCommentTags.push(fallbackTag);
    }
    if (isCompleteTag(fallbackTag)) {
      if (confirmCompleteTagSelection()) {
        setCompleteTagSelected(true);
      }
    } else {
      selectedCommentTagIds.add(fallbackTag.id);
    }
  }

  commentTagSearchEl.value = "";
  renderCommentTagUi();
}

// 選択済み画像のプレビューをモーダル内に描画する。
function renderCommentImagePreview() {
  if (!commentImagePreviewEl) {
    return;
  }
  if (selectedCommentImages.length < 1) {
    commentImagePreviewEl.innerHTML = '<div class="comment-image-empty">選択された画像がここに表示されます</div>';
    return;
  }

  const imagesHtml = selectedCommentImages
    .map((item) => `
      <div class="comment-image-item">
        <button
          class="comment-image-remove-btn"
          type="button"
          aria-label="この画像を削除"
          data-remove-image-id="${escapeHtml(item.id)}"
        >
          <img src="${escapeHtml(deleteButtonIconUrl)}" alt="" />
        </button>
        <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name || "投稿画像")}" loading="lazy" />
      </div>
    `)
    .join("");
  commentImagePreviewEl.innerHTML = `<div class="comment-image-list">${imagesHtml}</div>`;
}

// file input を安全に開く（showPicker対応端末を優先）。
function openCommentInputPicker(inputEl) {
  if (!inputEl) {
    return;
  }
  try {
    if (typeof inputEl.showPicker === "function") {
      inputEl.showPicker();
      return;
    }
    inputEl.click();
  } catch {
    inputEl.click();
  }
}

// モーダルに追加する画像ファイルを内部配列へ反映する。
function addCommentImageFiles(files) {
  files.forEach((file) => {
    if (!file || typeof file.type !== "string" || !file.type.startsWith("image/")) {
      return;
    }
    selectedCommentImages.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name || "選択された画像",
      url: URL.createObjectURL(file),
      file,
    });
  });
  renderCommentImagePreview();
}

// 指定IDの画像を選択リストから削除する。
function removeCommentImageById(imageId) {
  const index = selectedCommentImages.findIndex((item) => item.id === imageId);
  if (index < 0) {
    return;
  }
  const removed = selectedCommentImages[index];
  if (removed && removed.url) {
    URL.revokeObjectURL(removed.url);
  }
  selectedCommentImages.splice(index, 1);
  renderCommentImagePreview();
}

// 投稿中オーバーレイの表示状態を切り替える。
function setCommentSubmittingVisible(visible) {
  if (!commentSubmitLoadingEl) {
    return;
  }
  if (visible) {
    commentSubmitLoadingEl.classList.remove("hidden");
    return;
  }
  commentSubmitLoadingEl.classList.add("hidden");
}

// 投稿結果のモーダルを表示する。
function showCommentResultModal(message) {
  if (!commentResultModalEl || !commentResultMessageEl) {
    return;
  }
  commentResultMessageEl.textContent = message;
  commentResultModalEl.classList.remove("hidden");
}

// 投稿結果モーダルを閉じる。
function hideCommentResultModal() {
  if (!commentResultModalEl) {
    return;
  }
  commentResultModalEl.classList.add("hidden");
}

// Fileをdata URLへ変換して投稿APIで扱える形式にする。
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("file_read_failed"));
    };
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

// モーダル内の選択画像をAPI送信用配列に変換する。
async function buildCommentImagePayloads() {
  const payloads = [];
  for (const item of selectedCommentImages) {
    if (!item || !item.file) {
      continue;
    }
    const dataUrl = await fileToDataUrl(item.file);
    payloads.push({
      name: item.name || item.file.name || "image",
      dataUrl,
    });
  }
  return payloads;
}

// 既存ポイントへ note/media を追加保存する。
async function submitComment() {
  if (!Number.isInteger(currentPointId) || currentPointId <= 0) {
    alert("投稿先の道情報IDが不正です。");
    return;
  }
  if (!commentSubmitBtn) {
    return;
  }

  const detail = commentBodyInputEl ? commentBodyInputEl.value.trim() : "";
  if (!detail && selectedCommentImages.length < 1 && selectedCommentTagIds.size < 1) {
    alert("本文・画像・タグのいずれかを入力してください。");
    return;
  }

  commentSubmitBtn.disabled = true;
  setCommentSubmittingVisible(true);
  try {
    const images = await buildCommentImagePayloads();
    const payload = {
      pointId: currentPointId,
      detail,
      tagIds: Array.from(selectedCommentTagIds),
      images,
    };
    if (hasCompleteTagSelected()) {
      payload.status = "inactive";
    }
    const res = await authFetch("/api/road-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 404) {
      throw new Error("point_not_found");
    }
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const errorCode = payload && payload.error ? payload.error : `submit_failed_${res.status}`;
      throw new Error(errorCode);
    }

    if (commentBodyInputEl) {
      commentBodyInputEl.value = "";
    }
    selectedCommentImages.forEach((item) => {
      if (item && item.url) {
        URL.revokeObjectURL(item.url);
      }
    });
    selectedCommentImages.splice(0, selectedCommentImages.length);
    selectedCommentTagIds.clear();
    if (commentTagSearchEl) {
      commentTagSearchEl.value = "";
    }
    renderCommentTagUi();
    renderCommentImagePreview();
    setCommentModalOpen(false);
    loadRoadInfoDetail();
    showCommentResultModal("コメントの投稿が成功しました");
  } catch (err) {
    setCommentModalOpen(false);
    showCommentResultModal("コメントの投稿が失敗しました");
  } finally {
    setCommentSubmittingVisible(false);
    commentSubmitBtn.disabled = false;
  }
}

// 画面下部ボタンのイベントを初期化する。
function initActions() {
  if (postSelfBtn) {
    postSelfBtn.addEventListener("click", () => {
      setCommentModalOpen(true);
      if (commentBodyInputEl) {
        commentBodyInputEl.focus();
      }
    });
  }

  if (commentCloseBtn) {
    commentCloseBtn.addEventListener("click", () => {
      setCommentModalOpen(false);
    });
  }

  if (commentModalEl) {
    commentModalEl.addEventListener("click", (event) => {
      if (event.target === commentModalEl) {
        setCommentModalOpen(false);
      }
    });
  }

  if (commentImagePreviewEl) {
    commentImagePreviewEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const removeButton = target.closest("[data-remove-image-id]");
      const imageId = removeButton instanceof HTMLElement
        ? removeButton.getAttribute("data-remove-image-id")
        : null;
      if (!imageId) {
        return;
      }
      removeCommentImageById(imageId);
    });
  }

  if (commentTagSearchEl) {
    commentTagSearchEl.addEventListener("input", () => {
      renderCommentTagList();
    });

    const onTagSearchEnter = (event) => {
      const isEnter = event.key === "Enter" || event.keyCode === 13;
      if (!isEnter) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void handleCommentTagSearchSubmit();
    };

    commentTagSearchEl.addEventListener("keydown", onTagSearchEnter);
    commentTagSearchEl.addEventListener("keypress", onTagSearchEnter);
  }

  if (commentTagListEl) {
    commentTagListEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const tagId = target.getAttribute("data-tag-id");
      if (!tagId) {
        return;
      }
      if (COMPLETE_TAG_CODE_ALIASES.has(normalizeTagId(tagId))) {
        handleCompleteTagToggle();
        return;
      }
      if (selectedCommentTagIds.has(tagId)) {
        selectedCommentTagIds.delete(tagId);
      } else {
        selectedCommentTagIds.add(tagId);
      }
      renderCommentTagUi();
    });
  }

  if (commentCompleteTagBtn) {
    commentCompleteTagBtn.addEventListener("click", () => {
      handleCompleteTagToggle();
    });
  }

  if (commentTagSelectedEl) {
    commentTagSelectedEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const removeTagId = target.getAttribute("data-remove-tag-id");
      if (!removeTagId) {
        return;
      }
      selectedCommentTagIds.delete(removeTagId);
      renderCommentTagUi();
    });
  }

  if (commentSubmitBtn) {
    commentSubmitBtn.addEventListener("click", () => {
      void submitComment();
    });
  }

  if (commentResultOkBtn) {
    commentResultOkBtn.addEventListener("click", () => {
      hideCommentResultModal();
    });
  }

  if (commentPhotoLibraryBtn && commentPhotoLibraryInput) {
    commentPhotoLibraryBtn.addEventListener("click", () => {
      openCommentInputPicker(commentPhotoLibraryInput);
    });
  }

  if (commentCameraBtn && commentCameraInput) {
    commentCameraBtn.addEventListener("click", () => {
      openCommentInputPicker(commentCameraInput);
    });
  }

  if (commentPhotoLibraryInput) {
    commentPhotoLibraryInput.addEventListener("change", () => {
      const files = Array.from(commentPhotoLibraryInput.files || []);
      addCommentImageFiles(files);
      commentPhotoLibraryInput.value = "";
    });
  }

  if (commentCameraInput) {
    commentCameraInput.addEventListener("change", () => {
      const files = Array.from(commentCameraInput.files || []);
      addCommentImageFiles(files);
      commentCameraInput.value = "";
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.assign(AppPath.toApp("/map/Index.html"));
    });
  }
}

// URLのpointIdを使って詳細APIを呼び出し、画面に反映する。
function loadRoadInfoDetail() {
  const params = new URLSearchParams(window.location.search);
  const pointId = Number(params.get("pointId"));
  if (!Number.isInteger(pointId) || pointId <= 0) {
    setError("道情報IDが不正です。");
    return;
  }

  authFetch(`/api/road-info?pointId=${pointId}`)
    .then((res) => {
      if (res.status === 404) {
        throw new Error("not_found");
      }
      if (!res.ok) {
        throw new Error(`request_failed:${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      if (!data || !data.point) {
        throw new Error("invalid_payload");
      }
      currentPointId = Number(data.point.id);
      renderTags(data.point.tags);
      renderPosts(data.point.posts);
      showContent();
    })
    .catch((err) => {
      if (err.message === "not_found") {
        setError("対象の道情報が見つかりませんでした。");
        return;
      }
      setError("道情報の読み込みに失敗しました。");
    });
}

initActions();
setCommentModalOpen(false);
setCommentSubmittingVisible(false);
hideCommentResultModal();
renderCommentTagUi();
renderCommentImagePreview();
loadRoadInfoDetail();
