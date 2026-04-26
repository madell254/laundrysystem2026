/* ─────────────────────────────────────────────────────────────────────────
   Al Bateen Beach Palace — Laundry Management System  v3.2.1
   ─ Remarks modal when staff marks laundry "Ready"
   ─ Location * dropdown on submit form populated from /api/locations (admin-managed)
   ─ Clickable stat cards (admin/staff) → records modal: year/month filter + PDF
   ─ Admin panel "Locations" tab → add / delete location options
   ─ Stats modal closes on navigation
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
  var statCards = new WeakSet();
  var openModal = null;
  var prevPath = location.pathname;
  var locCache = [];        // Array of {id,name} from /api/locations
  var locCacheTtl = 0;      // epoch ms when cache expires
  var locSelectsWired = new WeakSet(); // select elements already overridden

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
     FEATURE 2 — Fetch interceptor
     • PATCH /status → show remarks modal on "ready"
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

    return await _origFetch(input, init);
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
      '<th>Location</th>' +
      '<th>Items</th><th>Status</th><th>Date</th><th>Staff Note</th>' +
      '</tr></thead>' +
      '<tbody id="lsc-sm-body">' +
      '<tr><td colspan="8" style="text-align:center;padding:28px;color:#94A3B8;">Loading…</td></tr>' +
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
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:#94A3B8;">Loading…</td></tr>';
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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:#94A3B8;">No records found for this period.</td></tr>';
        return;
      }

      tbody.innerHTML = recs.map(function(r, i) {
        return '<tr>' +
          '<td style="color:#94A3B8;font-size:11px;">'+(i+1)+'</td>' +
          '<td style="font-family:monospace;font-size:11.5px;white-space:nowrap;">'+esc(r.recordId)+'</td>' +
          '<td>'+esc(r.employeeName||'—')+'<div style="color:#94A3B8;font-size:11px;">'+esc(r.employeeCode||'')+'</div></td>' +
          '<td style="font-size:12px;max-width:130px;">'+esc(r.location||'—')+'</td>' +
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
     FEATURE 5 — Override the Location * dropdown on the Submit form
     The React bundle has hardcoded options (OB array). This replaces those
     options with live data from /api/locations (admin-managed).
     Uses MutationObserver-safe approach: marks enhanced selects and
     re-applies on re-render via periodic check.
     ════════════════════════════════════════════════════════════════════════ */

  /* Fetch locations with a short cache (30s) */
  async function fetchLocations() {
    var now = Date.now();
    if (locCache.length && now < locCacheTtl) return locCache;
    try {
      var res = await apiFetch('/api/locations');
      if (res.ok) {
        locCache = await res.json();
        locCacheTtl = now + 30000;
      }
    } catch(_) {}
    return locCache;
  }

  /* Override a single <select> element's options with API locations */
  async function overrideLocationSelect(sel) {
    if (locSelectsWired.has(sel)) return;
    var locs = await fetchLocations();
    if (!locs.length) return;

    /* Capture current selected value so we can preserve it */
    var currentVal = sel.value;

    /* Remove all options and add "Select Location" + API options */
    sel.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select Location';
    sel.appendChild(placeholder);

    locs.forEach(function(loc) {
      var opt = document.createElement('option');
      opt.value = loc.name;
      opt.textContent = loc.name;
      sel.appendChild(opt);
    });

    /* Restore previously chosen value if still valid */
    if (currentVal) sel.value = currentVal;

    /* Mark as wired */
    locSelectsWired.add(sel);
    sel.setAttribute('data-lsc-loc', '1');

    /* React controls the value via its own state — dispatch a synthetic event
       so React detects the current selection and updates its internal state */
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype, 'value'
    );
    if (nativeInputValueSetter && nativeInputValueSetter.set) {
      nativeInputValueSetter.set.call(sel, sel.value);
    }
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* Find and override all Location * selects on the page */
  function tryOverrideLocationSelects() {
    if (!location.pathname.includes('submit')) return;
    var selects = Array.prototype.slice.call(document.querySelectorAll('select'));
    selects.forEach(function(sel) {
      if (sel.closest('.lsc-ov')) return;
      /* Identify the Location * select: first option says "Select Location"
         or it already has one of the known default locations */
      var firstOpt = sel.options[0];
      if (!firstOpt) return;
      var firstTxt = (firstOpt.text || '').trim();
      if (firstTxt !== 'Select Location' && !sel.getAttribute('data-lsc-loc')) return;
      overrideLocationSelect(sel);
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
     FEATURE 6 — Admin Location Management
     Injects a "📍 Locations" button into the admin tab bar (next to
     Departments). Clicking it opens a modal overlay for adding / deleting
     the locations that appear in the submit-form dropdown.
     ════════════════════════════════════════════════════════════════════════ */

  /* Open the Locations management modal */
  function showLocModal() {
    if (getRole() !== 'admin') return;

    /* Build a standard modal shell */
    var shell = mkModal('📍 Location Management', false);
    shell.md.id = 'lsc-loc-modal';

    var body = document.createElement('div');
    body.className = 'lsc-body';
    body.style.maxHeight = '70vh';

    /* Description */
    var desc = document.createElement('p');
    desc.style.cssText = 'margin:0 0 16px;font-size:13px;color:#475569;line-height:1.6;';
    desc.textContent = 'Add or remove locations that employees can select when submitting laundry. Changes take effect immediately in the submission form.';
    body.appendChild(desc);

    /* Add row */
    var addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:8px;margin-bottom:18px;';
    addRow.innerHTML =
      '<input id="lsc-loc-inp" type="text" class="lsc-inp" ' +
        'placeholder="Enter location name…" maxlength="100" autocomplete="off" ' +
        'style="flex:1;" />' +
      '<button id="lsc-loc-add" class="lsc-btn" ' +
        'style="background:#2563EB;color:#fff;flex:0 0 auto;white-space:nowrap;' +
        'padding:11px 18px;font-size:13px;">+ Add</button>';
    body.appendChild(addRow);

    /* List */
    var listWrap = document.createElement('div');
    listWrap.id = 'lsc-loc-list';
    listWrap.style.cssText =
      'display:flex;flex-direction:column;gap:0;' +
      'border:1.5px solid #E2E8F0;border-radius:12px;overflow:hidden;';
    listWrap.innerHTML =
      '<div style="padding:14px;color:#94A3B8;font-size:13px;text-align:center;">Loading…</div>';
    body.appendChild(listWrap);

    var foot = document.createElement('div');
    foot.className = 'lsc-foot';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'lsc-btn lsc-cl';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function() { closeModal(shell.ov); });
    foot.appendChild(closeBtn);

    shell.md.appendChild(body);
    shell.md.appendChild(foot);
    openModalFn(shell.ov);

    /* ── Load locations ──────────────────────────────────────── */
    async function loadLocs() {
      locCacheTtl = 0;
      var locs = await fetchLocations();
      var list = document.getElementById('lsc-loc-list');
      if (!list) return;
      list.innerHTML = '';

      if (!locs.length) {
        list.innerHTML =
          '<div style="padding:20px;color:#94A3B8;font-size:13px;text-align:center;">' +
          'No locations yet. Add your first location above.</div>';
        return;
      }

      locs.forEach(function(loc, idx) {
        var row = document.createElement('div');
        row.style.cssText =
          'display:flex;align-items:center;gap:10px;padding:12px 16px;' +
          'border-bottom:1px solid #F1F5F9;background:' + (idx%2===0?'#fff':'#FAFAFA') + ';';

        var pin = document.createElement('span');
        pin.textContent = '📍';
        pin.style.cssText = 'font-size:16px;flex-shrink:0;';

        var name = document.createElement('span');
        name.textContent = loc.name;
        name.style.cssText = 'flex:1;font-size:14px;font-weight:500;color:#1E293B;';

        var delBtn = document.createElement('button');
        delBtn.innerHTML = '🗑 Delete';
        delBtn.style.cssText =
          'background:#FEE2E2;color:#991B1B;border:none;border-radius:8px;' +
          'padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;' +
          'flex-shrink:0;transition:background .15s;font-family:inherit;';
        delBtn.addEventListener('mouseover', function(){ this.style.background='#FECACA'; });
        delBtn.addEventListener('mouseout',  function(){ this.style.background='#FEE2E2'; });
        delBtn.addEventListener('click', async function() {
          if (!confirm('Delete "' + loc.name + '"?\n\nEmployees will no longer be able to select this location.')) return;
          delBtn.disabled = true;
          delBtn.textContent = 'Deleting…';
          try {
            await apiFetch('/api/locations/' + loc.id, { method: 'DELETE' });
            locCacheTtl = 0;
            loadLocs();
          } catch(_) {
            delBtn.disabled = false;
            delBtn.innerHTML = '🗑 Delete';
          }
        });

        row.appendChild(pin);
        row.appendChild(name);
        row.appendChild(delBtn);
        list.appendChild(row);
      });
    }

    loadLocs();

    /* ── Add handler ─────────────────────────────────────────── */
    var addBtn = document.getElementById('lsc-loc-add');
    var inp    = document.getElementById('lsc-loc-inp');

    addBtn.addEventListener('click', async function() {
      var name = (inp ? inp.value : '').trim();
      if (!name) {
        if (inp) { inp.style.borderColor = '#EF4444'; inp.focus(); }
        return;
      }
      inp.style.borderColor = '#CBD5E1';
      addBtn.disabled = true;
      addBtn.textContent = 'Adding…';
      try {
        var res = await apiFetch('/api/locations', {
          method: 'POST',
          body: JSON.stringify({ name: name })
        });
        if (res.status === 409) {
          alert('That location already exists.');
        } else if (res.ok) {
          inp.value = '';
          locCacheTtl = 0;
          loadLocs();
        } else {
          alert('Failed to add location. Please try again.');
        }
      } catch(_) { alert('Network error. Please try again.'); }
      addBtn.disabled = false;
      addBtn.textContent = '+ Add';
      inp.focus();
    });

    if (inp) {
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addBtn.click();
      });
      inp.focus();
    }
  }

  /* Inject a "📍 Locations" button into the admin panel tab bar.
     We look for the admin tab bar (the row of buttons: Users, Departments…)
     and append our button to it if not already present. */
  function injectLocTabButton() {
    if (!location.pathname.includes('admin')) return;
    if (getRole() !== 'admin') return;
    if (document.getElementById('lsc-loc-tab-btn')) return;

    /* Find the tab bar: a container that has buttons "Users" AND "Departments" */
    var allBtns = Array.prototype.slice.call(document.querySelectorAll('button'));
    var userBtn = null, deptBtn = null;
    allBtns.forEach(function(b) {
      var t = (b.textContent || '').trim();
      if (t === 'Users') userBtn = b;
      if (t === 'Departments') deptBtn = b;
    });
    if (!userBtn || !deptBtn) return; /* admin panel not rendered yet */

    /* The tab bar is the shared parent of these two buttons */
    var tabBar = userBtn.parentElement;
    if (!tabBar || !tabBar.contains(deptBtn)) {
      /* Try one level up */
      tabBar = userBtn.parentElement && userBtn.parentElement.parentElement;
      if (!tabBar || !tabBar.contains(deptBtn)) return;
    }

    /* Clone the style from the Departments button so ours looks identical */
    var refBtn = deptBtn;
    var locBtn = document.createElement('button');
    locBtn.id = 'lsc-loc-tab-btn';
    locBtn.type = 'button';

    /* Copy base classes but strip active/selected classes */
    var baseClass = (refBtn.className || '')
      .replace(/\bbg-(?:blue|indigo|primary)\S*/g, '')
      .replace(/\btext-white\b/g, '')
      .replace(/\bborder-(?:blue|indigo|primary)\S*/g, '')
      .trim();
    locBtn.className = baseClass;

    /* Style it like a normal (inactive) tab */
    locBtn.style.cssText =
      'cursor:pointer;display:inline-flex;align-items:center;gap:6px;';
    locBtn.innerHTML = '<span style="font-size:15px;">📍</span><span>Locations</span>';

    locBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      showLocModal();
    });

    tabBar.appendChild(locBtn);
  }

  function setupLocTabListener() { /* kept for API compat — logic moved to injectLocTabButton */ }
  function maybeShowLocPanel()   { /* replaced by injectLocTabButton */ }

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

    /* Close modal / cleanup when user navigates to a different page */
    if (path !== prevPath) {
      if (openModal) closeModal(openModal);
      prevPath = path;
      locSelectsWired = new WeakSet(); /* reset so selects get re-wired on new page */
    }

    if (path.includes('submit')) {
      tryOverrideLocationSelects();
    }
    wireStatCards();
    injectLocTabButton(); /* inject "Locations" button into admin tab bar */
  }, 600);

  new MutationObserver(function() {
    var path = location.pathname;
    if (path.includes('submit')) {
      tryOverrideLocationSelects();
    }
    wireStatCards();
    injectLocTabButton();
  }).observe(document.body, { childList: true, subtree: true });

  console.log('[LSC v3.2.2] Loaded ✓');
})();
