/* ─────────────────────────────────────────────────────────────────────────
   Al Bateen Beach Palace — Laundry Management System  v3.1.1
   ─ Remarks modal when staff marks laundry "Ready"
   ─ Delivery Location (optional free-text) appended below the submit form
   ─ Clickable stat cards (admin/staff) → records modal: year/month filter + PDF
   ─ Delivery location shown on records list (replaces collection location when set)
   ─ Stats modal closes on navigation
   ─ Mobile-safe layout
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Auth helpers ─────────────────────────────────────────────────────── */
  function getToken() {
    try {
      for (const store of [localStorage, sessionStorage]) {
        for (const k of Object.keys(store)) {
          const v = store.getItem(k);
          if (v && v.startsWith('eyJ') && v.split('.').length === 3) return v;
        }
      }
    } catch (_) {}
    return null;
  }

  function getRole() {
    try {
      const tok = getToken();
      if (!tok) return null;
      return JSON.parse(atob(tok.split('.')[1])).role || null;
    } catch (_) { return null; }
  }

  function apiFetch(path, opts) {
    const tok = getToken();
    const hdrs = {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: 'Bearer ' + tok } : {}),
      ...(opts && opts.headers ? opts.headers : {})
    };
    return fetch(path, Object.assign({}, opts, { headers: hdrs }));
  }

  /* ── Shared state ─────────────────────────────────────────────────────── */
  var deliveryLocation = '';
  var statCards = new WeakSet();
  var openModal = null;
  var dlCache = {};        // recordId → deliveryLocation string
  var dlTagged = new WeakSet(); // elements already injected with delivery tag
  var prevPath = location.pathname;

  /* ── Styles ───────────────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    /* Overlay & modal */
    '.lsc-ov{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;',
    'display:flex;align-items:flex-start;justify-content:center;',
    'padding:8px;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;}',
    '.lsc-md{background:#fff;border-radius:14px;width:100%;max-width:560px;',
    'margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;',
    'font-family:system-ui,-apple-system,sans-serif;pointer-events:all;}',
    '.lsc-md.wide{max-width:860px;}',
    '.lsc-hdr{background:#1E293B;color:#fff;padding:14px 18px;',
    'display:flex;align-items:center;gap:8px;}',
    '.lsc-hdr h3{margin:0;font-size:15px;font-weight:700;line-height:1.4;flex:1;min-width:0;}',
    '.lsc-body{padding:18px;overflow-y:auto;max-height:calc(100svh - 160px);}',
    '.lsc-foot{padding:10px 18px 16px;display:flex;flex-wrap:wrap;gap:8px;',
    'border-top:1px solid #E2E8F0;pointer-events:all;}',
    /* Close button */
    '.lsc-x{flex-shrink:0;width:32px;height:32px;border-radius:7px;',
    'background:rgba(255,255,255,.18);border:none;color:#fff;font-size:22px;',
    'line-height:1;cursor:pointer;display:flex;align-items:center;',
    'justify-content:center;padding:0;pointer-events:all;-webkit-appearance:none;}',
    '.lsc-x:hover{background:rgba(255,255,255,.35);}',
    /* Buttons */
    '.lsc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;',
    'padding:11px 20px;border-radius:10px;border:none;cursor:pointer;',
    'font-size:14px;font-weight:700;font-family:inherit;min-height:44px;',
    'box-sizing:border-box;-webkit-appearance:none;pointer-events:all;}',
    '.lsc-btn:hover{opacity:.85;}',
    '.lsc-btn:disabled{opacity:.45;cursor:not-allowed;}',
    '.lsc-ok{background:#16A34A;color:#fff;flex:1;}',
    '.lsc-cl{background:#F1F5F9;color:#334155;border:1.5px solid #CBD5E1;flex:0 0 auto;}',
    '.lsc-ex{background:#DC2626;color:#fff;flex:0 0 auto;}',
    /* Form elements */
    '.lsc-fld{margin-bottom:14px;}',
    '.lsc-lbl{display:block;font-size:11px;font-weight:700;color:#64748B;',
    'text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;line-height:1.4;}',
    '.lsc-sub{font-weight:400;text-transform:none;letter-spacing:0;',
    'color:#94A3B8;font-size:11px;margin-left:4px;}',
    '.lsc-inp,.lsc-ta{width:100%;box-sizing:border-box;border:1.5px solid #CBD5E1;',
    'border-radius:10px;padding:10px 13px;font-size:14px;font-family:inherit;',
    'color:#1E293B;background:#fff;outline:none;-webkit-appearance:none;display:block;}',
    '.lsc-inp:focus,.lsc-ta:focus{border-color:#2563EB;',
    'box-shadow:0 0 0 3px rgba(37,99,235,.12);}',
    '.lsc-ta{resize:vertical;min-height:76px;}',
    '.lsc-hint{font-size:12px;color:#94A3B8;margin-top:5px;line-height:1.5;}',
    /* Delivery location section in submit form */
    '.lsc-dl-box{background:#fff;border-radius:14px;border:1.5px solid #E2E8F0;',
    'overflow:hidden;margin-bottom:16px;}',
    '.lsc-dl-hdr{background:#F8FAFC;border-bottom:1.5px solid #E2E8F0;',
    'padding:11px 16px;display:flex;align-items:center;gap:8px;}',
    '.lsc-dl-hdr-txt{font-size:13px;font-weight:700;color:#1E293B;}',
    '.lsc-dl-body{padding:16px;}',
    /* Stats modal */
    '.lsc-pills{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;}',
    '.lsc-pill{background:#F1F5F9;border-radius:20px;padding:5px 13px;',
    'font-size:13px;color:#475569;border:1px solid #E2E8F0;}',
    '.lsc-pill b{color:#1E293B;}',
    '.lsc-frow{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:flex-end;}',
    '.lsc-sel{border:1.5px solid #CBD5E1;border-radius:10px;padding:8px 12px;',
    'font-size:13px;font-family:inherit;background:#fff;outline:none;',
    '-webkit-appearance:none;cursor:pointer;color:#1E293B;}',
    '.lsc-sel:focus{border-color:#2563EB;}',
    '.lsc-tw{overflow-x:auto;border-radius:10px;border:1px solid #E2E8F0;',
    'max-height:360px;overflow-y:auto;}',
    '.lsc-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}',
    '.lsc-tbl th{background:#F8FAFC;color:#475569;font-weight:700;',
    'padding:8px 10px;text-align:left;border-bottom:2px solid #E2E8F0;',
    'position:sticky;top:0;white-space:nowrap;}',
    '.lsc-tbl td{padding:7px 10px;border-bottom:1px solid #F1F5F9;',
    'color:#1E293B;vertical-align:top;}',
    '.lsc-tbl tr:hover td{background:#F8FAFC;}',
    '.lsc-sb{display:inline-block;border-radius:12px;padding:2px 10px;',
    'font-size:11px;font-weight:700;text-transform:capitalize;white-space:nowrap;}',
    '.lsc-s-pending{background:#FEF9C3;color:#854D0E;}',
    '.lsc-s-washing{background:#DBEAFE;color:#1D4ED8;}',
    '.lsc-s-drying{background:#EDE9FE;color:#6D28D9;}',
    '.lsc-s-ready{background:#DCFCE7;color:#15803D;}',
    '.lsc-s-collected{background:#D1FAE5;color:#065F46;}',
    '.lsc-s-cancelled{background:#FEE2E2;color:#991B1B;}',
    /* Delivery tag on records list */
    '.lsc-dl-tag{display:inline-flex;align-items:center;gap:3px;',
    'margin-top:3px;font-size:11px;color:#0F766E;font-weight:600;',
    'background:#CCFBF1;border-radius:5px;padding:2px 7px;white-space:nowrap;}',
    /* Stat card hover */
    '.lsc-cc{cursor:pointer!important;transition:box-shadow .15s,transform .15s!important;}',
    '.lsc-cc:hover{transform:translateY(-2px)!important;',
    'box-shadow:0 8px 24px rgba(37,99,235,.18)!important;}',
    /* Print */
    '@media print{body>*:not(#lsc-pr){display:none!important;}',
    '#lsc-pr{display:block!important;}}',
    /* Mobile */
    '@media(max-width:480px){',
    '.lsc-body{padding:12px;}',
    '.lsc-btn{font-size:13px;padding:10px 14px;}',
    '.lsc-tbl th,.lsc-tbl td{padding:6px 7px;font-size:11.5px;}',
    '.lsc-hdr h3{font-size:13px;}}'
  ].join('');
  document.head.appendChild(style);

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
    catch(_){ return iso || ''; }
  }

  /* Build an overlay; clicking backdrop closes it */
  function mkOverlay() {
    var ov = document.createElement('div');
    ov.className = 'lsc-ov';
    ov.addEventListener('mousedown', function(e) {
      if (e.target === ov) { closeModal(ov); }
    });
    return ov;
  }

  /* Build modal shell */
  function mkModal(title, wide) {
    var ov = mkOverlay();
    var md = document.createElement('div');
    md.className = wide ? 'lsc-md wide' : 'lsc-md';

    var hdr = document.createElement('div');
    hdr.className = 'lsc-hdr';
    var h3 = document.createElement('h3');
    h3.textContent = title;
    var xb = document.createElement('button');
    xb.className = 'lsc-x';
    xb.type = 'button';
    xb.setAttribute('aria-label', 'Close');
    xb.textContent = '×';
    xb.addEventListener('click', function() { closeModal(ov); });
    hdr.appendChild(h3);
    hdr.appendChild(xb);
    md.appendChild(hdr);
    ov.appendChild(md);
    return { ov: ov, md: md, h3: h3 };
  }

  function openModalFn(ov) {
    if (openModal && openModal !== ov) { openModal.remove(); }
    openModal = ov;
    document.body.appendChild(ov);
    // Close on Escape key
    function onKey(e) {
      if (e.key === 'Escape') { closeModal(ov); document.removeEventListener('keydown', onKey); }
    }
    document.addEventListener('keydown', onKey);
  }

  function closeModal(ov) {
    try { ov.remove(); } catch(_){}
    if (openModal === ov) openModal = null;
  }

  /* ════════════════════════════════════════════════════════════════════════
     FEATURE 1 — Remarks modal when staff marks laundry "Ready"
     ════════════════════════════════════════════════════════════════════════ */
  function showRemarksModal() {
    return new Promise(function(resolve) {
      var shell = mkModal('✅ Mark as Ready — Staff Note (Optional)', false);
      var body = document.createElement('div');
      body.className = 'lsc-body';
      body.innerHTML =
        '<div class="lsc-fld">' +
        '<label class="lsc-lbl">Note for the employee<span class="lsc-sub"> — optional</span></label>' +
        '<textarea id="lrm-ta" class="lsc-ta" rows="3" ' +
        'placeholder="e.g. One shirt had a stain that could not be fully removed. Please inspect."></textarea>' +
        '<p class="lsc-hint">This note will appear in the employee\'s notification and on their record.</p>' +
        '</div>';

      var foot = document.createElement('div');
      foot.className = 'lsc-foot';

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'lsc-btn lsc-cl';
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', function() { closeModal(shell.ov); resolve(false); });

      var okBtn = document.createElement('button');
      okBtn.className = 'lsc-btn lsc-ok';
      okBtn.type = 'button';
      okBtn.textContent = '✓ Confirm — Mark as Ready';
      okBtn.addEventListener('click', function() {
        var ta = document.getElementById('lrm-ta');
        var note = ta ? ta.value.trim() : '';
        closeModal(shell.ov);
        resolve(note || '');
      });

      foot.appendChild(cancelBtn);
      foot.appendChild(okBtn);
      shell.md.appendChild(body);
      shell.md.appendChild(foot);
      openModalFn(shell.ov);
      setTimeout(function() { var ta = document.getElementById('lrm-ta'); if(ta) ta.focus(); }, 80);
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
     FEATURE 2 — Delivery Location optional field on Submit page
     The original Location dropdown is left exactly as-is.
     We only add an optional "Delivery Location" text input at the bottom.
     ════════════════════════════════════════════════════════════════════════ */
  function injectDeliveryField(anchorEl) {
    if (document.getElementById('lsc-dl-box')) return;

    var box = document.createElement('div');
    box.id = 'lsc-dl-box';
    box.className = 'lsc-dl-box';
    box.innerHTML =
      '<div class="lsc-dl-hdr">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" ' +
      'stroke-width="2.5" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>' +
      '<circle cx="12" cy="10" r="3"/></svg>' +
      '<span class="lsc-dl-hdr-txt">Delivery Location</span>' +
      '<span style="font-size:11px;color:#94A3B8;font-weight:400;margin-left:6px;">— optional</span>' +
      '</div>' +
      '<div class="lsc-dl-body">' +
      '<div class="lsc-fld" style="margin-bottom:0;">' +
      '<input id="lsc-dl-inp" class="lsc-inp" type="text" ' +
      'placeholder="e.g. Manager\'s Office, same room, Floor 3, Reception…" ' +
      'autocomplete="off" maxlength="200" />' +
      '<p class="lsc-hint">Leave blank — by default your finished laundry is collected from the laundry room.</p>' +
      '</div>' +
      '</div>';

    anchorEl.before(box);

    var inp = document.getElementById('lsc-dl-inp');
    if (inp) {
      if (deliveryLocation) inp.value = deliveryLocation;
      inp.addEventListener('input', function() { deliveryLocation = this.value; });
    }
  }

  function tryInjectDeliveryField() {
    if (document.getElementById('lsc-dl-box')) return;
    if (!location.pathname.includes('submit')) return;

    /* Find the Notes textarea card and inject before it */
    var textareas = Array.prototype.slice.call(document.querySelectorAll('textarea'));
    var notesTa = null;
    for (var i = 0; i < textareas.length; i++) {
      if (/additional|special|note|instruct/i.test(textareas[i].placeholder || '')) {
        notesTa = textareas[i]; break;
      }
    }
    if (notesTa) {
      var card = notesTa.closest('.bg-white') ||
                 notesTa.closest('[class*="rounded"]') ||
                 notesTa.parentElement && notesTa.parentElement.parentElement;
      if (card) { injectDeliveryField(card); return; }
    }

    /* Fallback: inject before the submit button's card */
    var btns = Array.prototype.slice.call(document.querySelectorAll('button'));
    for (var j = 0; j < btns.length; j++) {
      if (/submit laundry/i.test(btns[j].textContent || '')) {
        var bcard = btns[j].closest('.bg-white') ||
                    btns[j].closest('[class*="rounded"]') ||
                    btns[j].parentElement;
        if (bcard) { injectDeliveryField(bcard); return; }
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
     FEATURE 3 — Fetch interceptor
     • PATCH /status → show remarks modal on "ready"
     • POST /api/laundry → append deliveryLocation if provided
     • GET /api/laundry → cache staffNote + deliveryLocation for badges
     ════════════════════════════════════════════════════════════════════════ */
  var _origFetch = window.fetch.bind(window);

  window.fetch = async function(input, init) {
    var url = (typeof input === 'string' ? input : (input && input.url)) || '';

    /* Remarks modal on ready */
    if (init && init.method === 'PATCH' &&
        /\/api\/laundry\/\d+\/status/.test(url) && init.body) {
      try {
        var body = JSON.parse(init.body);
        if (body.status === 'ready') {
          var result = await showRemarksModal();
          if (result === false) {
            return new Response(JSON.stringify({ cancelled: true }),
              { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (result) body.staffNote = result;
          init = Object.assign({}, init, { body: JSON.stringify(body) });
        }
      } catch(_) {}
    }

    /* Add deliveryLocation on laundry submit */
    if (init && init.method === 'POST' &&
        /\/api\/laundry(\?|$)/.test(url) && init.body) {
      try {
        var sb = JSON.parse(init.body);
        var dl = (deliveryLocation || '').trim();
        if (dl) sb.deliveryLocation = dl;
        init = Object.assign({}, init, { body: JSON.stringify(sb) });
      } catch(_) {}
    }

    var resp = await _origFetch(input, init);

    /* Cache deliveryLocation per recordId for list injection */
    if (/\/api\/laundry(\?|$)/.test(url) &&
        (!init || !init.method || init.method === 'GET')) {
      resp.clone().json().then(function(data) {
        var recs = data && data.records ? data.records :
                   (Array.isArray(data) ? data : []);
        recs.forEach(function(r) {
          if (r.recordId && r.deliveryLocation) {
            dlCache[r.recordId] = r.deliveryLocation;
          }
        });
        schedDeliveryInject();
      }).catch(function(){});
    }

    return resp;
  };

  /* ════════════════════════════════════════════════════════════════════════
     FEATURE 4 — Clickable stat cards → Records modal (admin / staff)
     ════════════════════════════════════════════════════════════════════════ */
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  function rangeFor(label) {
    var n = new Date(), y = n.getFullYear(), m = n.getMonth(), d = n.getDate();
    if (/today/i.test(label))
      return { from: new Date(y,m,d), to: new Date(y,m,d+1),
               title: 'Today — ' + n.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) };
    if (/this week/i.test(label))
      return { from: new Date(y,m,d-((n.getDay()+6)%7)), to: new Date(y,m,d-((n.getDay()+6)%7)+7),
               title: 'This Week' };
    if (/this year|ytd/i.test(label))
      return { from: new Date(y,0,1), to: new Date(y+1,0,1), title: 'Year ' + y };
    return { from: new Date(y,m,1), to: new Date(y,m+1,1), title: MONTHS[m] + ' ' + y };
  }

  async function fetchRecs(from, to) {
    try {
      var p = new URLSearchParams({dateFrom:from.toISOString(), dateTo:to.toISOString(), limit:'500'});
      var r = await apiFetch('/api/laundry?' + p);
      if (!r.ok) return [];
      return (await r.json()).records || [];
    } catch(_) { return []; }
  }

  function sBadge(s) {
    return '<span class="lsc-sb lsc-s-' + esc(s||'pending') + '">' + esc(s||'pending') + '</span>';
  }

  async function showStatsModal(cardLabel) {
    var range = rangeFor(cardLabel);
    var curY = new Date().getFullYear();

    var shell = mkModal('📋 Records — ' + range.title, true);
    shell.md.id = 'lsc-stats-modal';

    var body = document.createElement('div');
    body.className = 'lsc-body';

    /* Year / month filter row */
    var frow = document.createElement('div');
    frow.className = 'lsc-frow';
    frow.innerHTML =
      '<div>' +
      '<label style="display:block;font-size:11px;font-weight:700;color:#64748B;margin-bottom:4px;">YEAR</label>' +
      '<select class="lsc-sel" id="lsc-sm-yr">' +
      [0,1,2,3,4,5].map(function(i){var y=curY-i;return '<option value="'+y+'"'+(y===range.from.getFullYear()?' selected':'')+'>'+y+'</option>';}).join('') +
      '</select>' +
      '</div>' +
      '<div>' +
      '<label style="display:block;font-size:11px;font-weight:700;color:#64748B;margin-bottom:4px;">MONTH</label>' +
      '<select class="lsc-sel" id="lsc-sm-mo">' +
      MONTHS.map(function(n,i){return '<option value="'+i+'"'+(i===range.from.getMonth()?' selected':'')+'>'+n+'</option>';}).join('') +
      '</select>' +
      '</div>' +
      '<button class="lsc-btn lsc-cl" id="lsc-sm-go" type="button" style="height:42px;">🔍 Search</button>';

    var pills = document.createElement('div');
    pills.className = 'lsc-pills';
    pills.id = 'lsc-sm-pills';

    var tw = document.createElement('div');
    tw.className = 'lsc-tw';
    tw.innerHTML =
      '<table class="lsc-tbl">' +
      '<thead><tr>' +
      '<th>#</th><th>Record ID</th><th>Employee</th>' +
      '<th>Location</th><th>Deliver To</th>' +
      '<th>Items</th><th>Status</th><th>Date</th><th>Staff Note</th>' +
      '</tr></thead>' +
      '<tbody id="lsc-sm-body">' +
      '<tr><td colspan="9" style="text-align:center;padding:28px;color:#94A3B8;">Loading…</td></tr>' +
      '</tbody></table>';

    body.appendChild(frow);
    body.appendChild(pills);
    body.appendChild(tw);

    var foot = document.createElement('div');
    foot.className = 'lsc-foot';

    var closeBtn2 = document.createElement('button');
    closeBtn2.className = 'lsc-btn lsc-cl';
    closeBtn2.type = 'button';
    closeBtn2.textContent = 'Close';
    closeBtn2.addEventListener('click', function() { closeModal(shell.ov); });

    var pdfBtn = document.createElement('button');
    pdfBtn.className = 'lsc-btn lsc-ex';
    pdfBtn.type = 'button';
    pdfBtn.innerHTML = '🖨 Export PDF';
    pdfBtn.addEventListener('click', doPrint);

    foot.appendChild(closeBtn2);
    foot.appendChild(pdfBtn);
    shell.md.appendChild(body);
    shell.md.appendChild(foot);
    openModalFn(shell.ov);

    /* Search button */
    document.getElementById('lsc-sm-go').addEventListener('click', function() {
      var y = +document.getElementById('lsc-sm-yr').value;
      var mo = +document.getElementById('lsc-sm-mo').value;
      range = { from: new Date(y,mo,1), to: new Date(y,mo+1,1), title: MONTHS[mo]+' '+y };
      shell.h3.textContent = '📋 Records — ' + range.title;
      render();
    });

    async function render() {
      var tbody = document.getElementById('lsc-sm-body');
      var pillsEl = document.getElementById('lsc-sm-pills');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:28px;color:#94A3B8;">Loading…</td></tr>';
      if (pillsEl) pillsEl.innerHTML = '';

      var recs = await fetchRecs(range.from, range.to);
      var counts = {}, totalItems = 0;
      recs.forEach(function(r){ counts[r.status]=(counts[r.status]||0)+1; totalItems+=(r.totalItems||0); });

      if (pillsEl) {
        pillsEl.innerHTML =
          '<span class="lsc-pill"><b>'+recs.length+'</b> Submissions</span>' +
          '<span class="lsc-pill"><b>'+totalItems+'</b> Items</span>' +
          Object.keys(counts).sort().map(function(st){
            return '<span class="lsc-pill"><b>'+counts[st]+'</b> '+st.charAt(0).toUpperCase()+st.slice(1)+'</span>';
          }).join('');
      }

      if (!recs.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:#94A3B8;">No records found for this period.</td></tr>';
        return;
      }

      tbody.innerHTML = recs.map(function(r, i) {
        return '<tr>' +
          '<td style="color:#94A3B8;font-size:11px;">'+(i+1)+'</td>' +
          '<td style="font-family:monospace;font-size:11.5px;white-space:nowrap;">'+esc(r.recordId)+'</td>' +
          '<td>'+esc(r.employeeName||'—')+'<div style="color:#94A3B8;font-size:11px;">'+esc(r.employeeCode||'')+'</div></td>' +
          '<td style="font-size:12px;max-width:130px;">'+esc(r.location||'—')+'</td>' +
          '<td style="font-size:12px;max-width:120px;">'+esc(r.deliveryLocation||'—')+'</td>' +
          '<td style="text-align:center;font-weight:700;">'+(r.totalItems||0)+'</td>' +
          '<td>'+sBadge(r.status)+'</td>' +
          '<td style="font-size:11.5px;white-space:nowrap;">'+fmtDate(r.submittedAt)+'</td>' +
          '<td style="font-size:11.5px;max-width:150px;word-break:break-word;">' +
          (r.staffNote ? '<span style="color:#1D4ED8;">📝 '+esc(r.staffNote.slice(0,60))+(r.staffNote.length>60?'…':'')+'</span>' : '') +
          '</td></tr>';
      }).join('');
    }

    function doPrint() {
      var pr = document.getElementById('lsc-pr');
      if (!pr) { pr = document.createElement('div'); pr.id='lsc-pr'; document.body.appendChild(pr); }
      var pillsEl = document.getElementById('lsc-sm-pills');
      var summHtml = pillsEl ? pillsEl.innerHTML : '';
      var rows = Array.prototype.slice.call(document.querySelectorAll('#lsc-sm-body tr')).map(function(tr, i) {
        return '<tr style="background:'+(i%2===0?'#F8FAFC':'#fff')+'">' +
          '<td style="padding:5px 8px;border-bottom:1px solid #E2E8F0;">'+(i+1)+'</td>' +
          Array.prototype.slice.call(tr.querySelectorAll('td')).slice(1).map(function(td){
            return '<td style="padding:5px 8px;border-bottom:1px solid #E2E8F0;">'+td.innerHTML+'</td>';
          }).join('') + '</tr>';
      }).join('');
      pr.innerHTML =
        '<div style="font-family:system-ui,sans-serif;padding:24px;max-width:960px;margin:auto;">' +
        '<div style="border-bottom:2px solid #1E293B;padding-bottom:12px;margin-bottom:16px;">' +
        '<h1 style="margin:0;font-size:17px;color:#1E293B;">Al Bateen Beach Palace — Laundry Records</h1>' +
        '<p style="margin:4px 0 0;color:#64748B;font-size:12px;">'+esc(range.title)+' &nbsp;|&nbsp; Exported: '+new Date().toLocaleString()+'</p>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">'+summHtml+'</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:11.5px;">' +
        '<thead><tr style="background:#1E293B;color:#fff;">' +
        '<th style="padding:7px 8px;text-align:left;">#</th>' +
        '<th style="padding:7px 8px;text-align:left;">Record ID</th>' +
        '<th style="padding:7px 8px;text-align:left;">Employee</th>' +
        '<th style="padding:7px 8px;text-align:left;">Location</th>' +
        '<th style="padding:7px 8px;text-align:left;">Deliver To</th>' +
        '<th style="padding:7px 8px;text-align:center;">Items</th>' +
        '<th style="padding:7px 8px;text-align:left;">Status</th>' +
        '<th style="padding:7px 8px;text-align:left;">Date</th>' +
        '<th style="padding:7px 8px;text-align:left;">Staff Note</th>' +
        '</tr></thead><tbody>'+rows+'</tbody></table>' +
        '<p style="margin-top:18px;font-size:10.5px;color:#94A3B8;text-align:center;">Al Bateen Beach Palace Hotel — Laundry Management System</p>' +
        '</div>';
      window.print();
      /* Remove the print-only div so it doesn't remain visible on screen */
      setTimeout(function() { if (pr && pr.parentNode) pr.parentNode.removeChild(pr); }, 500);
    }

    render();
  }

  /* ════════════════════════════════════════════════════════════════════════
     FEATURE 5 — Show delivery location on records list
     Reads the table header to find the LOCATION column index, then for
     every row whose record-ID cell has a cached delivery location, appends
     a teal "🚚 Deliver to:" tag inside that same cell.
     ════════════════════════════════════════════════════════════════════════ */
  var dlInjectTmr = 0;
  function schedDeliveryInject() {
    clearTimeout(dlInjectTmr);
    dlInjectTmr = setTimeout(injectDeliveryOnList, 350);
  }

  /* Find the 0-based column index of the LOCATION header in a <thead> */
  function getLocationColIndex(table) {
    var ths = Array.prototype.slice.call(table.querySelectorAll('thead th, thead td'));
    for (var i = 0; i < ths.length; i++) {
      var t = (ths[i].textContent || '').trim().toUpperCase();
      if (t === 'LOCATION' || t === 'LOCATION / DELIVER TO') return i;
    }
    return -1;
  }

  function injectDeliveryOnList() {
    if (!Object.keys(dlCache).length) return;

    /* Find all <table> elements on the page (outside our modal) */
    var tables = Array.prototype.slice.call(document.querySelectorAll('table'));
    tables.forEach(function(table) {
      if (table.closest('.lsc-ov')) return;

      var locIdx = getLocationColIndex(table);
      if (locIdx < 0) return;          /* no LOCATION header found */

      var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
      rows.forEach(function(row) {
        /* Find the record-ID cell: a cell whose text matches LDY-... */
        var cells = Array.prototype.slice.call(row.querySelectorAll('td'));
        if (!cells.length) return;

        var recId = null;
        cells.forEach(function(td) {
          if (recId) return;
          var spans = Array.prototype.slice.call(td.querySelectorAll('span, div, p'));
          spans.forEach(function(s) {
            if (recId) return;
            var txt = (s.textContent || '').trim();
            if (/^LDY-\d{6}-\d+$/.test(txt)) recId = txt;
          });
          /* Also check the cell itself */
          if (!recId) {
            var cellTxt = (td.textContent || '').trim();
            if (/^LDY-\d{6}-\d+$/.test(cellTxt)) recId = cellTxt;
          }
        });

        if (!recId || !dlCache[recId]) return;
        var dl = dlCache[recId];

        /* Target the LOCATION column cell */
        var locCell = cells[locIdx];
        if (!locCell) return;
        if (dlTagged.has(locCell)) return;
        dlTagged.add(locCell);

        var tag = document.createElement('div');
        tag.className = 'lsc-dl-tag';
        tag.innerHTML = '🚚 ' + esc(dl);
        locCell.appendChild(tag);
      });
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
     FEATURE 6 — Admin: Delivery Locations management panel
     Injected into the admin Settings page. Lets admin add / delete
     delivery locations which are stored server-side.
     ════════════════════════════════════════════════════════════════════════ */
  var dlPanelInjected = false;

  async function injectDlAdminPanel() {
    if (dlPanelInjected) return;
    if (getRole() !== 'admin') return;

    /* Only show on Settings-like pages (by URL or by page content) */
    var path = location.pathname;
    var isSettingsPage = /settings|admin|config/i.test(path);
    /* Also detect by looking for typical settings headings */
    if (!isSettingsPage) {
      var headings = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3'));
      isSettingsPage = headings.some(function(h) {
        return /setting|admin|config|manage|system/i.test(h.textContent || '');
      });
    }
    if (!isSettingsPage) return;

    /* Look for a scrollable container to append to */
    var main = document.querySelector('main') ||
               document.querySelector('[class*="content"]') ||
               document.querySelector('[class*="main"]') ||
               document.getElementById('root');
    if (!main) return;

    /* Don't inject twice */
    if (document.getElementById('lsc-dl-admin')) return;

    dlPanelInjected = true;

    var panel = document.createElement('div');
    panel.id = 'lsc-dl-admin';
    panel.style.cssText = 'margin:24px;background:#fff;border-radius:14px;border:1.5px solid #E2E8F0;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;';
    panel.innerHTML =
      '<div style="background:#1E293B;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:10px;">' +
        '<span style="font-size:16px;">🚚</span>' +
        '<div>' +
          '<div style="font-size:14px;font-weight:700;">Delivery Locations</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,.65);margin-top:2px;">Manage where laundry can be delivered</div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:16px;">' +
        '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
          '<input id="lsc-dl-inp" placeholder="e.g. Room 101, Manager Office…" ' +
            'style="flex:1;border:1.5px solid #CBD5E1;border-radius:10px;padding:9px 13px;font-size:13px;font-family:inherit;outline:none;" />' +
          '<button id="lsc-dl-add" style="padding:9px 16px;background:#2563EB;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">+ Add</button>' +
        '</div>' +
        '<div id="lsc-dl-list" style="display:flex;flex-wrap:wrap;gap:8px;min-height:36px;"></div>' +
      '</div>';

    main.appendChild(panel);

    /* Load and render locations */
    async function loadLocs() {
      try {
        var r = await apiFetch('/api/delivery-locations');
        var locs = await r.json();
        var list = document.getElementById('lsc-dl-list');
        if (!list) return;
        list.innerHTML = '';
        if (!locs.length) {
          list.innerHTML = '<span style="color:#94A3B8;font-size:12px;">No delivery locations yet. Add one above.</span>';
          return;
        }
        locs.forEach(function(loc) {
          var chip = document.createElement('div');
          chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:8px;padding:5px 10px;font-size:13px;font-weight:500;color:#1E293B;';
          chip.innerHTML = '<span>🚚 ' + esc(loc.name) + '</span>';
          var del = document.createElement('button');
          del.innerHTML = '&times;';
          del.title = 'Delete';
          del.style.cssText = 'background:none;border:none;cursor:pointer;color:#94A3B8;font-size:16px;line-height:1;padding:0 2px;font-weight:700;';
          del.addEventListener('click', async function() {
            if (!confirm('Delete "' + loc.name + '"?')) return;
            await apiFetch('/api/delivery-locations/' + loc.id, { method: 'DELETE' });
            loadLocs();
          });
          chip.appendChild(del);
          list.appendChild(chip);
        });
      } catch(_) {}
    }

    loadLocs();

    document.getElementById('lsc-dl-add').addEventListener('click', async function() {
      var inp = document.getElementById('lsc-dl-inp');
      var name = (inp ? inp.value : '').trim();
      if (!name) return;
      inp.disabled = true;
      try {
        await apiFetch('/api/delivery-locations', {
          method: 'POST',
          body: JSON.stringify({ name: name })
        });
        inp.value = '';
        loadLocs();
      } catch(_) {}
      inp.disabled = false;
    });

    /* Allow Enter key to add */
    document.getElementById('lsc-dl-inp').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('lsc-dl-add').click();
    });
  }

  /* ── Wire stat cards ────────────────────────────────────────────────────── */
  function wireStatCards() {
    var role = getRole();
    if (!role || (role !== 'admin' && role !== 'staff')) return;
    /* Never process elements inside an open modal overlay */
    if (document.querySelector('.lsc-ov')) return;

    var all = Array.prototype.slice.call(document.querySelectorAll('[class]'));
    all.forEach(function(el) {
      if (statCards.has(el)) return;
      /* Skip anything inside our own overlays */
      if (el.closest('.lsc-ov')) return;
      var txt = el.textContent || '';
      if (!/\b(today|this week|this month|this year)\b/i.test(txt)) return;
      if (el.children.length > 8 || txt.length > 300) return;
      var card = el.closest('[class*="card"]') || el.closest('[class*="Card"]') ||
                 el.closest('[class*="rounded"]') || (el.parentElement && el.parentElement.parentElement);
      if (!card || statCards.has(card)) return;
      /* Skip the card if it is (or is inside) our overlay */
      if (card.closest('.lsc-ov') || card.classList.contains('lsc-ov')) return;
      var lbl = (txt.match(/\b(today|this week|this month|this year)\b/i) || ['this month'])[0];
      statCards.add(el);
      statCards.add(card);
      card.classList.add('lsc-cc');
      card.setAttribute('title', 'Click to view records');
      card.addEventListener('click', function() { showStatsModal(lbl); });
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
     MAIN LOOP
     ════════════════════════════════════════════════════════════════════════ */
  setInterval(function() {
    var path = location.pathname;

    /* Close modal and reset injectors when user navigates to a different page */
    if (path !== prevPath) {
      if (openModal) closeModal(openModal);
      prevPath = path;
      dlTagged = new WeakSet();
      dlPanelInjected = false;
    }

    if (path.includes('submit')) {
      tryInjectDeliveryField();
    } else {
      deliveryLocation = '';
    }
    wireStatCards();
    if (Object.keys(dlCache).length) injectDeliveryOnList();
    injectDlAdminPanel();
  }, 600);

  new MutationObserver(function() {
    var path = location.pathname;
    if (path.includes('submit')) tryInjectDeliveryField();
    wireStatCards();
    if (Object.keys(dlCache).length) schedDeliveryInject();
    injectDlAdminPanel();
  }).observe(document.body, { childList: true, subtree: true });

  console.log('[LSC v3.1.1] Loaded ✓');
})();
