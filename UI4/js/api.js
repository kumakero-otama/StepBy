/* ===========================================================
   StepBy UI1 — API client

   One place that knows how to talk to the backend. Every call:
     - has a timeout (a hung request used to leave spinners up forever)
     - throws a typed ApiError with a translatable `messageKey`
     - is abortable, so a screen can cancel its in-flight work on teardown

   Endpoints follow documents/API_list.md.
   =========================================================== */
(function (w) {
  'use strict';

  var cfg = w.APP_CONFIG;
  var auth = w.StepByAuth;

  /** Error with a stable `code` and an i18n key the UI can render. */
  function ApiError(code, messageKey, status, detail) {
    var err = new Error(code);
    err.name = 'ApiError';
    err.code = code;
    err.messageKey = messageKey;
    err.status = status || 0;
    err.detail = detail || null;
    return err;
  }

  /* A 400 says nothing useful on its own. These are the codes the backend
     actually returns for a road-info post, mapped to something a person can
     act on. Anything unlisted still falls back to the generic message. */
  var CODE_KEYS = {
    invalid_image_data: 'error.imageData',
    invalid_coordinates: 'error.coordinates',
    guest_pro_locked: 'pro.guestLocked'
  };

  function keyForStatus(status) {
    if (status === 401 || status === 403) return 'error.unauthorized';
    if (status === 404) return 'error.notFound';
    return 'error.generic';
  }

  /**
   * fetch with timeout, auth header and JSON handling.
   * @param {string} path  /api/... or /auth/... (absolute URLs pass through)
   * @param {object} [opts] { method, body, signal, timeoutMs, auth:false }
   */
  async function request(path, opts) {
    var options = opts || {};
    var controller = new AbortController();
    var timeoutMs = options.timeoutMs || cfg.REQUEST_TIMEOUT_MS;
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    /* Let a caller-supplied signal also cancel us. */
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', function () { controller.abort(); }, { once: true });
    }

    var headers = options.auth === false ? new Headers() : auth.authHeaders();
    var body;
    if (options.body !== undefined && options.body !== null) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }
    headers.set('Accept', 'application/json');

    var response;
    try {
      response = await fetch(auth.toApi(path), {
        method: options.method || 'GET',
        headers: headers,
        body: body,
        signal: controller.signal,
        /* Cookie-free by design; never send ambient credentials. */
        credentials: 'omit',
        cache: 'no-store'
      });
    } catch (e) {
      clearTimeout(timer);
      if (timedOut) throw ApiError('timeout', 'error.timeout', 0);
      /* A cancelled request is not a failure. Report it as a typed error so
         callers can recognise it with api.isAbort() instead of comparing
         controllers after the fact — doing that by hand is what made the map
         pop up "something went wrong" every time two overlay loads raced. */
      if (e && e.name === 'AbortError') throw ApiError('aborted', null, 0);
      throw ApiError('network', 'error.network', 0, e && e.message);
    }
    clearTimeout(timer);

    var payload = null;
    var text = await response.text();
    if (text) {
      try { payload = JSON.parse(text); } catch (e) { payload = { raw: text }; }
    }

    if (!response.ok) {
      if (response.status === 401) auth.clearSession();
      var code = (payload && (payload.error && payload.error.code || payload.error)) || String(response.status);
      throw ApiError(code, CODE_KEYS[code] || keyForStatus(response.status), response.status, payload);
    }

    return payload;
  }

  function query(params) {
    var usp = new URLSearchParams();
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      usp.set(k, String(v));
    });
    var s = usp.toString();
    return s ? '?' + s : '';
  }

  /* ---- Response adapters --------------------------------------------------
     One place that knows the wire format. Everything downstream works with
     these shapes, so a backend rename is a change here and nowhere else.

     Wire shapes as of API v1.25:
       list   -> { points: [{ id, lat, lng, createdBy }] }        (no detail!)
       detail -> { point: { id, lat, lng, status, createdAt,
                            tags: [{ id, code, labelJa }],
                            posts: [{ body, authorUsername, authorIconUrl,
                                      media: [{ url }] }] } }
  */
  function normalizeSummary(raw) {
    return {
      id: String(raw.id !== undefined ? raw.id : raw.pointId),
      lat: Number(raw.lat),
      lng: Number(raw.lng),
      createdBy: raw.createdBy !== undefined ? String(raw.createdBy) : null,
      /* The list endpoint carries no content. Screens that want it call
         getReport(); `hydrated` tells them whether they still need to. */
      hydrated: false,
      tags: [],
      notes: '',
      author: null,
      images: [],
      createdAt: null
    };
  }

  function normalizeReport(point) {
    var posts = point.posts || [];
    /* The newest post is the current description; older ones are history. */
    var lead = posts[posts.length - 1] || null;
    var images = [];
    posts.forEach(function (post) {
      (post.media || []).forEach(function (item) {
        if (item && item.url) images.push(item.url);
      });
    });

    return {
      id: String(point.id !== undefined ? point.id : point.pointId),
      lat: Number(point.lat),
      lng: Number(point.lng),
      status: point.status || 'active',
      createdAt: point.createdAt || (lead && lead.createdAt) || null,
      hydrated: true,
      tags: point.tags || [],
      notes: (lead && lead.body) || '',
      createdBy: lead && lead.createdBy !== undefined ? String(lead.createdBy) : null,
      author: lead
        ? { name: lead.authorUsername || '', iconUrl: lead.authorIconUrl || '' }
        : null,
      images: images,
      posts: posts
    };
  }

  /** True when a call was cancelled (teardown, re-sort, newer request). */
  function isAbort(err) {
    return !!err && (err.code === 'aborted' || err.name === 'AbortError');
  }

  var api = {
    ApiError: ApiError,
    isAbort: isAbort,
    request: request,
    normalizeSummary: normalizeSummary,
    normalizeReport: normalizeReport,

    /* ---- auth ---- */
    signInWithGoogle: function (idToken) {
      return request('/auth/google', { method: 'POST', body: { id_token: idToken }, auth: false });
    },
    signUpWithGoogle: function (idToken, username, iconDataUrl) {
      return request('/auth/google/signup', {
        method: 'POST',
        auth: false,
        body: { id_token: idToken, username: username, icon_data_url: iconDataUrl || '' }
      });
    },
    signInAsGuest: function () {
      return request('/auth/guest', { method: 'POST', auth: false });
    },
    me: function (opts) { return request('/auth/me', opts); },
    signOut: function () { return request('/auth/logout', { method: 'POST' }); },
    updateProfile: function (username, iconDataUrl) {
      var body = { username: username };
      if (iconDataUrl) body.icon_data_url = iconDataUrl;
      return request('/auth/profile', { method: 'POST', body: body });
    },

    /* ---- config ---- */
    getConfig: function (opts) { return request('/api/config', opts); },

    /* ---- road reports ----
       The backend rejects /api/road-info without a bounding circle — even
       with mine=1 it answers 400 invalid_radius — so the centre and radius
       are required arguments here rather than something each caller has to
       remember. Responses go through normalise() so screens never have to
       guess between `id`/`pointId` or dig posts[0].body out themselves. */
    listReports: function (centre, opts) {
      var options = opts || {};
      if (!centre || !isFinite(centre.lat) || !isFinite(centre.lng)) {
        return Promise.reject(ApiError('missing_centre', 'error.generic', 0));
      }
      var params = {
        centerLat: Number(centre.lat).toFixed(6),
        centerLng: Number(centre.lng).toFixed(6),
        radiusKm: centre.radiusKm || cfg.FEED_RADIUS_KM
      };
      if (centre.mine) params.mine = 1;
      return request('/api/road-info' + query(params), options)
        .then(function (res) { return ((res && res.points) || []).map(normalizeSummary); });
    },
    getReport: function (pointId, opts) {
      return request('/api/road-info' + query({ pointId: pointId }), opts)
        .then(function (res) {
          var point = res && res.point;
          return point ? normalizeReport(point) : null;
        });
    },
    createReport: function (payload) {
      return request('/api/road-info', { method: 'POST', body: payload, timeoutMs: 30000 });
    },
    deleteReport: function (pointId) {
      return request('/api/road-info', { method: 'POST', body: { pointId: pointId, status: 'deleted' } });
    },

    /**
     * List reports and fill in their detail.
     *
     * The list endpoint returns coordinates only, so anything that needs
     * tags, notes, photos or an author has to fetch each point. This does it
     * with a bounded worker pool and a bounded total, calls onItem as each
     * one arrives so the UI can paint progressively, and never lets a single
     * failed detail blank the whole list.
     *
     * If the backend ever returns full records from the list endpoint, delete
     * the hydration half and everything downstream keeps working.
     */
    listReportsDetailed: function (centre, opts) {
      var options = opts || {};
      var limit = options.limit || 30;
      var parallel = options.parallel || 4;
      var signal = options.signal;

      return api.listReports(centre, { signal: signal }).then(function (items) {
        /* Hand the bare list over straight away so the caller can paint
           placeholder cards while the details are still arriving. */
        if (options.onList) options.onList(items);
        var queue = items.slice(0, limit);

        function worker() {
          if (!queue.length || (signal && signal.aborted)) return Promise.resolve();
          var summary = queue.shift();
          return api.getReport(summary.id, { signal: signal })
            .then(function (full) {
              if (full) Object.assign(summary, full);
            })
            .catch(function () { summary.hydrated = true; })
            .then(function () {
              if (options.onItem) options.onItem(summary);
              return worker();
            });
        }

        return Promise
          .all(Array.from({ length: Math.min(parallel, queue.length) }, worker))
          .then(function () { return items; });
      });
    },

    /* ---- tags ---- */
    listPostTags: function (opts) { return request('/api/post-tags', opts); },

    /* ---- recorded routes ----
       Same bounding-circle requirement as /api/road-info. */
    listRecords: function (centre, opts) {
      if (!centre || !isFinite(centre.lat) || !isFinite(centre.lng)) {
        return Promise.reject(ApiError('missing_centre', 'error.generic', 0));
      }
      var params = {
        centerLat: Number(centre.lat).toFixed(6),
        centerLng: Number(centre.lng).toFixed(6),
        radiusKm: centre.radiusKm || cfg.FEED_RADIUS_KM
      };
      if (centre.mine) params.mine = 1;
      return request('/api/records' + query(params), opts)
        .then(function (res) { return (res && res.paths) || []; });
    },
    matchPoint: function (params, opts) {
      return request('/api/match' + query(params), Object.assign({ auth: false }, opts || {}));
    },
    startSession: function (body) { return request('/api/session/start', { method: 'POST', body: body || {} }); },
    endSession: function (body) { return request('/api/session/end', { method: 'POST', body: body || {} }); },
    cancelSession: function (body) { return request('/api/session/cancel', { method: 'POST', body: body || {} }); },
    setSessionMemo: function (body) { return request('/api/session/memo', { method: 'POST', body: body }); },
    deactivateSession: function (body) {
      return request('/api/session/deactivate', { method: 'POST', body: body });
    },
    /* Owner, memo and tag names for a recorded route. Unauthenticated. */
    sessionInfo: function (sessionId, opts) {
      return request('/api/tactile-session-info' + query({ sessionId: sessionId }),
        Object.assign({ auth: false }, opts || {}));
    },

    /* ---- PRO account ----
       Not a paid tier: a mode for professionals supporting people with visual
       impairments, who record finer detail. Guests get 403 guest_pro_locked. */
    getProStatus: function (opts) { return request('/api/pro-status', opts); },
    setProStatus: function (isPro) {
      return request('/api/pro-status', { method: 'PUT', body: { isPro: !!isPro } });
    },
    listTactileTags: function (opts) {
      return request('/api/tactile-tags' + query({ activeOnly: 1 }), opts);
    },
    addSessionTag: function (body) {
      return request('/api/session-tags', { method: 'POST', body: body });
    },

    /* ---- OSM overlay ---- */
    osmTactileWays: function (params, opts) {
      return request('/api/osm-tactile-ways' + query(params), Object.assign({ timeoutMs: 25000 }, opts || {}));
    }
  };

  w.StepByApi = api;
})(window);
