
        const API_BASE = "https://barrierfree-map.loophole.site";
        // ログイン済みならauthFetch、未ログインはfetch
        const apiFetch = (url, opts) => {
            if (window.AuthToken && window.AuthToken.getAccessToken()) {
                return window.AuthToken.authFetch(url, opts);
            }
            return fetch(url, opts);
        };

        const postsListEl = document.getElementById('posts-list');
        const statsText = document.getElementById('stats-text');
        const loadingState = document.getElementById('loading-state');
        const emptyState = document.getElementById('empty-state');
        const errorState = document.getElementById('error-state');

        let currentAbortController = null;

        function formatDate(dateRaw) {
            const date = new Date(dateRaw);
            if (isNaN(date)) return "";
            return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
        }

        // --- Address Cache ---
        const getCacheKey = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
        function getCachedAddress(lat, lng) {
            const key = getCacheKey(lat, lng);
            const val = localStorage.getItem(`addr_${key}`);
            // Invalidate cache if stored value looks like raw coordinates (failed fetch)
            if (val && /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(val.trim())) {
                localStorage.removeItem(`addr_${key}`);
                return null;
            }
            return val;
        }
        function setCachedAddress(lat, lng, addr) {
            const key = getCacheKey(lat, lng);
            localStorage.setItem(`addr_${key}`, addr);
        }

        // --- Reverse Geocoding via Nominatim ---
        async function getAddress(lat, lng, signal) {
            const cached = getCachedAddress(lat, lng);
            if (cached) return cached;

            try {
                // Sequential fetching with delay is handled in loop, butUA is important
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`, {
                    headers: { 'User-Agent': 'StepBy-BarrierFree-App-v2' },
                    signal
                });
                const data = await res.json();
                if (data && data.address) {
                    const a = data.address;
                    // Full list of Japanese Nominatim address fields
                    const state = a.prefecture || a.province || a.state || a.county || "";
                    const city = a.city || a.town || a.village || a.municipality || "";
                    const district = a.city_district || a.suburb || a.ward || a.neighbourhood || a.quarter || a.hamlet || "";

                    let addr = "";
                    if (state) addr += state;
                    if (city) addr += city;
                    else if (district) addr += district; // Use district if no city level

                    const finalAddr = addr.trim() ? `${addr.trim()}付近` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                    setCachedAddress(lat, lng, finalAddr);
                    return finalAddr;
                }
                return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            } catch (err) {
                return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
        }

        // --- Skeleton Template ---
        function createPostSkeleton(pt) {
            const div = document.createElement('div');
            div.className = 'post-item';
            div.dataset.pointId = pt.id;
            div.innerHTML = `
                <div class="post-item-photo-wrap skeleton">
                    <div style="position: absolute; top: 14px; right: 14px; display: flex; gap: 8px; z-index: 10;">
                        <button class="action-btn delete-req-btn" style="width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,0.95); color: #e74c3c; box-shadow: 0 4px 12px rgba(0,0,0,0.12); cursor: pointer;"><i class="fas fa-trash"></i></button>
                        <button class="action-btn edit-req-btn" style="width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,0.95); color: #2E9E8F; box-shadow: 0 4px 12px rgba(0,0,0,0.12); cursor: pointer;"><i class="fas fa-pen"></i></button>
                    </div>
                </div>
                <div class="post-item-body">
                    <div class="post-item-tags">
                        <span class="tag-chip skeleton" style="width: 60px; height: 18px; color: transparent;">TAG</span>
                    </div>
                    <div class="post-item-text skeleton" style="width: 100%; height: 40px; color: transparent;">BODY TEXT</div>
                    <div class="post-item-address skeleton" style="width: 70%; height: 14px; color: transparent;">ADDRESS</div>
                    <div class="post-item-footer">
                        <span class="location"><i class="fas fa-map-marker-alt"></i> ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</span>
                        <span class="date">...</span>
                    </div>
                </div>
            `;

            // Action Logic
            const deleteBtn = div.querySelector('.delete-req-btn');
            const editBtn = div.querySelector('.edit-req-btn');

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('この投稿情報を削除してもよろしいですか？')) {
                    div.style.transition = 'opacity 0.3s, transform 0.3s';
                    div.style.opacity = '0';
                    div.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        div.remove();
                        // Local count tracking to decrement
                        let count = parseInt(localStorage.getItem('myTotalPosts') || '21', 10);
                        if (count > 0) count--;
                        localStorage.setItem('myTotalPosts', count.toString());

                        // Update stats text on the page to reflect deleted item
                        const currentPosts = document.querySelectorAll('.post-item').length;
                        document.getElementById('stats-text').textContent = `${currentPosts} 件の投稿履歴が見つかりました`;
                    }, 300);
                    // In a real app, we would send a DELETE request here
                    // fetch(`${API_BASE}/api/road-info?pointId=${pt.id}`, {method: 'DELETE'})
                }
            });

            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.assign(`../edit_post/Index.html?pointId=${pt.id}`);
            });

            div.addEventListener('click', () => {
                window.location.assign(`../edit_post/Index.html?pointId=${pt.id}`);
            });

            return div;
        }

        // --- Dynamic Content Update (photo/tags/text only, no address) ---
        async function fetchPostDetail(pt, el, signal) {
            try {
                const res = await fetch(`${API_BASE}/api/road-info?pointId=${pt.id}`, { signal });
                const data = await res.json();
                const point = data.point;
                const post = (point.posts && point.posts.length > 0) ? point.posts[point.posts.length - 1] : null;
                const media = (post && post.media && post.media.length > 0) ? post.media[0] : null;

                // Photo Update
                const photoWrap = el.querySelector('.post-item-photo-wrap');
                photoWrap.classList.remove('skeleton');
                if (media && media.url) {
                    const fullUrl = media.url.startsWith('http') ? media.url : `${API_BASE}${media.url}`;
                    const finalUrl = fullUrl.startsWith('/') ? `${location.origin}${fullUrl}` : fullUrl;
                    photoWrap.innerHTML = `<img src="${finalUrl}" class="post-item-photo" alt="投稿写真" onerror="this.outerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:#8A9BB0;font-size:32px;\\'><i class=\\'fas fa-image\\'></i></div>'">`;
                } else {
                    photoWrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8A9BB0;font-size:32px;"><i class="fas fa-image"></i></div>`;
                }

                // Tags Update
                const tagsNode = el.querySelector('.post-item-tags');
                tagsNode.innerHTML = (point.tags || []).map(t => `<span class="tag-chip">${t.labelJa || t.label}</span>`).join('');

                // Text Update
                const textNode = el.querySelector('.post-item-text');
                textNode.classList.remove('skeleton');
                textNode.style.height = 'auto';
                textNode.style.color = 'inherit';
                textNode.textContent = post ? post.body : '詳細情報なし';

                // Date Update
                const dateNode = el.querySelector('.date');
                dateNode.textContent = post ? formatDate(post.createdAt) : "";

            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error('Failed to load detail for', pt.id, err);
            }
        }

        // --- Update address for a single element ---
        async function updateAddress(pt, el, signal) {
            const addr = await getAddress(pt.lat, pt.lng, signal);
            if (signal && signal.aborted) return;
            const addrNode = el.querySelector('.post-item-address');
            if (!addrNode) return;
            addrNode.classList.remove('skeleton');
            addrNode.style.height = 'auto';
            addrNode.style.color = 'inherit';
            addrNode.innerHTML = `<i class="fas fa-location-dot"></i> ${addr}`;
        }

        async function loadPosts() {
            if (currentAbortController) currentAbortController.abort();
            currentAbortController = new AbortController();
            const signal = currentAbortController.signal;

            loadingState.classList.remove('hidden');
            emptyState.classList.add('hidden');
            errorState.classList.add('hidden');
            postsListEl.innerHTML = "";
            postsListEl.classList.add('hidden');
            statsText.textContent = "全地域の投稿を取得中...";

            try {
                const isLoggedIn = window.AuthToken && window.AuthToken.getAccessToken();

                // 自分のuserIdを/auth/meから取得
                let myUserId = null;
                if (isLoggedIn) {
                    try {
                        const meRes = await window.AuthToken.authFetch('/auth/me');
                        if (meRes.ok) {
                            const meData = await meRes.json();
                            const u = meData.user || meData;
                            myUserId = u.userId || u.user_id || u.id || null;
                            console.log('[MyPosts] /auth/me:', JSON.stringify(u).substring(0, 200));
                        }
                    } catch (e) {
                        console.warn('[MyPosts] /auth/me failed:', e.message);
                    }
                }

                if (!isLoggedIn || !myUserId) {
                    loadingState.classList.add('hidden');
                    emptyState.classList.remove('hidden');
                    statsText.textContent = "未ログインのため表示できません";
                    return;
                }

                // APIの仕様上、全件取得ができないため全国の主要座標を並列検索して合体させる
                const regionsToSearch = [
                    { lat: 35.681, lng: 139.767 }, // 東京
                    { lat: 34.686, lng: 135.520 }, // 大阪
                    { lat: 35.170, lng: 136.882 }, // 名古屋
                    { lat: 43.062, lng: 141.354 }, // 札幌
                    { lat: 33.590, lng: 130.402 }, // 福岡
                    { lat: 38.260, lng: 140.882 }, // 仙台
                    { lat: 34.385, lng: 132.455 }  // 広島
                ];

                const fetchPromises = regionsToSearch.map(async (loc) => {
                    const params = new URLSearchParams({ centerLat: loc.lat, centerLng: loc.lng, radiusKm: 1500 });
                    params.set('user_id', myUserId);
                    try {
                        const res = await apiFetch(`${API_BASE}/api/road-info?${params.toString()}`, { signal });
                        if (res.ok) {
                            const data = await res.json();
                            return data.points || [];
                        }
                    } catch (err) {
                        if (err.name !== 'AbortError') console.warn('Fetch error for region', loc, err);
                    }
                    return [];
                });

                const results = await Promise.all(fetchPromises);
                
                // 全ての地域の配列を結合
                let allPoints = results.flat();

                // idで重複排除
                const uniquePointsMap = new Map();
                for (const p of allPoints) {
                    if (p && p.id && !uniquePointsMap.has(p.id)) {
                        uniquePointsMap.set(p.id, p);
                    }
                }
                allPoints = Array.from(uniquePointsMap.values());

                // クライアント側で確実に自分の投稿だけに絞り込む
                const filtered = allPoints.filter(p => {
                    const pId = p.userId || p.user_id || p.createdBy || p.created_by || p.authorId || p.author_id;
                    return pId != null && String(pId).trim() === String(myUserId).trim();
                });

                // 新しい順（id降順）でソート
                filtered.sort((a, b) => Number(b.id) - Number(a.id));

                let points = filtered;
                console.log('[MyPosts] total unique points after filter:', points.length);


                loadingState.classList.add('hidden');
                if (points.length === 0) {
                    emptyState.classList.remove('hidden');
                    statsText.textContent = "0 件の投稿";
                    return;
                }

                statsText.textContent = `${points.length} 件の投稿履歴が見つかりました`;
                postsListEl.classList.remove('hidden');

                // Render Skeletons in chunks for performance
                const listItems = points.slice(0, 30).map(pt => {
                    const skeleton = createPostSkeleton(pt);
                    postsListEl.appendChild(skeleton);
                    return { pt, skeleton };
                });

                // 1) Fetch all detail (photos/tags/text) IN PARALLEL — fast!
                await Promise.all(listItems.map(item =>
                    fetchPostDetail(item.pt, item.skeleton, signal)
                ));

                // 2) Fetch addresses SEQUENTIALLY in background (Nominatim: 1 req/sec)
                (async () => {
                    for (const item of listItems) {
                        if (signal.aborted) break;
                        // Use cache check to avoid delays for already-known addresses
                        if (!getCachedAddress(item.pt.lat, item.pt.lng)) {
                            await new Promise(r => setTimeout(r, 1200)); // 1.2s gap
                        }
                        if (signal.aborted) break;
                        await updateAddress(item.pt, item.skeleton, signal);
                    }
                })();

            } catch (err) {
                if (err.name === 'AbortError') return;
                loadingState.classList.add('hidden');
                errorState.classList.remove('hidden');
                statsText.textContent = "エラーが発生しました";
            }
        }

        loadPosts();
    