/* ===========================================================
   StepBy UI1 — Report detail
   =========================================================== */
(function (w, d) {
  'use strict';

  var api = w.StepByApi;
  var auth = w.StepByAuth;
  var ui = w.StepByUI;
  var i18n = w.StepByI18n;
  var t = w.t;

  var content = d.getElementById('content');
  var pointId = new URLSearchParams(location.search).get('id');
  var point = null;

  function ownedByMe() {
    var me = auth.getCachedUser();
    return !!(me && point && point.createdBy && String(me.userId || me.id) === String(point.createdBy));
  }

  function render() {
    if (!point) return;

    var tags = point.tags.map(function (tag) {
      var label = i18n.tagLabel(tag);
      return label ? '<span class="chip">' + ui.esc(label) + '</span>' : '';
    }).join('') || '<span class="chip chip--muted">' + ui.esc(t('feed.noTags')) + '</span>';

    var images = point.images.map(function (src) {
      return '<img src="' + ui.esc(auth.toAsset(src)) + '" alt="" loading="lazy">';
    }).join('');

    var mapHref = auth.toApp('/map/') + '?lat=' + encodeURIComponent(point.lat) + '&lng=' + encodeURIComponent(point.lng);

    content.innerHTML =
      '<section class="card">' +
        '<div class="chip-set">' + tags + '</div>' +
        '<p class="card__meta">' +
          (point.author && point.author.name
            ? '<span>' + ui.esc(t('detail.postedBy', { name: point.author.name })) + '</span>'
            : '') +
          (point.createdAt ? '<span>' + ui.esc(i18n.formatRelative(point.createdAt)) + '</span>' : '') +
        '</p>' +
      '</section>' +

      '<section class="card" style="margin-top:12px">' +
        '<h2 class="section-title">' +
          '<span class="section-title__icon">' + w.StepByIcons.svg('pen') + '</span>' +
          '<span>' + ui.esc(t('detail.notes')) + '</span>' +
        '</h2>' +
        '<p>' + (point.notes ? ui.esc(point.notes) : '<span class="text-muted">' + ui.esc(t('detail.noNotes')) + '</span>') + '</p>' +
      '</section>' +

      (images
        ? '<section class="card" style="margin-top:12px">' +
            '<h2 class="section-title">' +
              '<span class="section-title__icon">' + w.StepByIcons.svg('image') + '</span>' +
              '<span>' + ui.esc(t('detail.photos')) + '</span>' +
            '</h2>' +
            '<div class="gallery">' + images + '</div>' +
          '</section>'
        : '') +

      '<p style="margin-top:16px">' +
        '<a class="btn btn--secondary btn--block" href="' + ui.esc(mapHref) + '">' +
          w.StepByIcons.svg('map') + '<span>' + ui.esc(t('detail.openInMap')) + '</span>' +
        '</a>' +
      '</p>' +

      (ownedByMe()
        ? '<p style="margin-top:8px">' +
            '<button type="button" class="btn btn--danger btn--block" id="delete-btn">' +
              w.StepByIcons.svg('trash-can') + '<span>' + ui.esc(t('common.delete')) + '</span></button>' +
          '</p>'
        : '');

    var del = d.getElementById('delete-btn');
    if (del) del.addEventListener('click', remove);
  }

  async function remove() {
    var ok = await ui.confirmDialog({
      title: t('post.deleteTitle'),
      body: t('post.deleteBody'),
      confirmLabel: t('common.delete'),
      danger: true
    });
    if (!ok) return;
    try {
      await api.deleteReport(pointId);
      ui.toast(t('post.deleted'), 'success');
      /* Back to the map, which is where the report was opened from. Sending
         people to the reports list dropped them on a screen with no way back
         into the app. */
      setTimeout(function () { location.replace(auth.toApp('/map/')); }, 700);
    } catch (err) {
      ui.toastError(err);
    }
  }

  async function load() {
    if (!pointId) {
      ui.emptyState(content, { icon: 'circle-exclamation', title: t('detail.notFound') });
      return;
    }
    ui.skeletonList(content, 2);
    try {
      point = await api.getReport(pointId);
      if (!point || !isFinite(point.lat)) {
        ui.emptyState(content, { icon: 'circle-exclamation', title: t('detail.notFound') });
        return;
      }
      content.removeAttribute('aria-busy');
      render();
    } catch (err) {
      /* A deleted or mistyped id is not a transient failure — offering
         "try again" would just repeat the same 404. */
      if (err.status === 404) {
        ui.emptyState(content, { icon: 'circle-exclamation', title: t('detail.notFound') });
        return;
      }
      ui.errorState(content, err, load);
    }
  }

  d.addEventListener('stepby:langchange', render);
  load();
})(window, document);
