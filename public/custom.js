/* ─────────────────────────────────────────────────────────────────────────
   Al Bateen Beach Palace – Laundry System Custom Extensions  v2.8
   1. Remarks modal when marking as Ready
   2. Pickup Location (required) + Delivery Location (optional) on Submit
   3. Clickable stat cards → records viewer with year/month filter + PDF
   4. Note/location badges on record cards
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── AUTH HELPERS ─────────────────────────────────────────────────────────
  function getToken() {
    for (const store of [localStorage, sessionStorage]) {
      try {
        for (const key of Object.keys(store)) {
          const v = store.getItem(key);
          if (v && v.startsWith('eyJ') && v.length > 40) return v;
        }
      } catch (e) {}
    }
    return null;
  }

  function getRole() {
    try {
      const tok = getToken();
      if (!tok) return null;
      const payload = JSON.parse(atob(tok.split('.')[1]));
      return payload.role || null;
    } catch (e) { return null; }
  }

  const apiFetch = (path, opts) => {
    const token = getToken();
    return fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(opts?.headers || {})
      }
    });
  };

  // ── GLOBAL STATE ─────────────────────────────────────────────────────────
  window.__lsc = window.__lsc || {
    pickupLocation: '',
    deliveryLocation: '',
    dlLocations: [],
    dlLoaded: false,
    staffNoteCache: {},
    dlCache: {},
    injectedNotes: new WeakSet()
  };

  // ── MOBILE-SAFE CSS ───────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* ── overlay ── */
    .lsc-ov{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:12px;overflow-y:auto;box-sizing:border-box;}
    .lsc-modal{background:#fff;border-radius:14px;width:100%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;margin:auto;}
    .lsc-modal-hdr{background:#1E293B;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:8px;}
    .lsc-modal-hdr h3{margin:0;font-size:15px;font-family:system-ui,sans-serif;font-weight:600;line-height:1.3;}
    .lsc-modal-body{padding:20px;}
    .lsc-modal-footer{padding:12px 20px 16px;display:flex;flex-wrap:wrap;gap:8px;border-top:1px solid #E2E8F0;}
    /* ── form fields ── */
    .lsc-field{margin-bottom:14px;}
    .lsc-label{display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:5px;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;}
    .lsc-label span{font-weight:400;text-transform:none;color:#94A3B8;font-size:11px;}
    .lsc-input,.lsc-textarea,.lsc-select{width:100%;box-sizing:border-box;border:1.5px solid #CBD5E1;border-radius:10px;padding:10px 12px;font-size:14px;font-family:system-ui,sans-serif;color:#1E293B;background:#fff;outline:none;-webkit-appearance:none;appearance:none;}
    .lsc-input:focus,.lsc-textarea:focus,.lsc-select:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.15);}
    .lsc-input.lsc-error,.lsc-textarea.lsc-error{border-color:#DC2626;box-shadow:0 0 0 3px rgba(220,38,38,.15);}
    .lsc-input-hint{font-size:11px;color:#94A3B8;margin-top:4px;font-family:system-ui,sans-serif;line-height:1.4;}
    .lsc-input-hint.lsc-err-msg{color:#DC2626;}
    .lsc-textarea{resize:vertical;min-height:76px;}
    /* ── buttons ── */
    .lsc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 18px;border-radius:10px;border:none;cursor:pointer;font-size:14px;font-weight:600;font-family:system-ui,sans-serif;transition:opacity .15s;white-space:nowrap;min-height:42px;box-sizing:border-box;}
    .lsc-btn:hover{opacity:.86;}
    .lsc-btn:disabled{opacity:.5;cursor:not-allowed;}
    .lsc-btn-primary{background:#2563EB;color:#fff;flex:1;}
    .lsc-btn-ghost{background:#F1F5F9;color:#334155;border:1px solid #E2E8F0;}
    .lsc-btn-danger{background:#DC2626;color:#fff;}
    .lsc-btn-green{background:#16A34A;color:#fff;}
    .lsc-btn-close{background:none;border:none;cursor:pointer;color:#94A3B8;font-size:22px;line-height:1;padding:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;}
    .lsc-btn-close:hover{background:rgba(255,255,255,.15);color:#fff;}
    /* ── section on submit form ── */
    .lsc-loc-section{background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:16px;margin-top:14px;font-family:system-ui,sans-serif;}
    .lsc-loc-title{font-size:13px;font-weight:700;color:#1E293B;margin:0 0 14px;display:flex;align-items:center;gap:7px;}
    .lsc-divider{border:none;border-top:1px solid #E2E8F0;margin:12px 0;}
    /* ── badges ── */
    .lsc-badge{display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:3px 8px;font-size:11.5px;font-family:system-ui,sans-serif;margin:2px 3px 2px 0;vertical-align:middle;flex-shrink:0;}
    .lsc-badge-note{background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;}
    .lsc-badge-loc{background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;}
    /* ── stats modal ── */
    .lsc-stat-card-clickable{cursor:pointer;transition:transform .12s,box-shadow .12s;border-radius:inherit;}
    .lsc-stat-card-clickable:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.2);}
    .lsc-stat-card-clickable::after{content:'↗';font-size:11px;color:#94A3B8;margin-left:4px;vertical-align:super;}
    .lsc-tbl{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;}
    .lsc-tbl th{background:#F1F5F9;color:#475569;font-weight:600;padding:8px 10px;text-align:left;border-bottom:2px solid #E2E8F0;white-space:nowrap;}
    .lsc-tbl td{padding:8px 10px;border-bottom:1px solid #F1F5F9;color:#1E293B;vertical-align:top;}
    .lsc-tbl tr:hover td{background:#F8FAFC;}
    .lsc-tbl-wrap{overflow-x:auto;border-radius:10px;border:1px solid #E2E8F0;max-height:380px;overflow-y:auto;}
    .lsc-summary-pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
    .lsc-pill{background:#F1F5F9;border-radius:20px;padding:5px 14px;font-size:12.5px;font-family:system-ui,sans-serif;color:#334155;border:1px solid #E2E8F0;}
    .lsc-pill-val{font-weight:700;color:#1E293B;}
    .lsc-search-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;align-items:flex-end;}
    .lsc-search-row .lsc-select{flex:1;min-width:110px;max-width:160px;}
    .lsc-status-badge{display:inline-block;border-radius:12px;padding:2px 10px;font-size:11.5px;font-weight:600;text-transform:capitalize;}
    .lsc-st-pending{background:#FEF9C3;color:#854D0E;}
    .lsc-st-washing{background:#DBEAFE;color:#1D4ED8;}
    .lsc-st-drying{background:#EDE9FE;color:#6D28D9;}
    .lsc-st-ready{background:#DCFCE7;color:#15803D;}
    .lsc-st-collected{background:#D1FAE5;color:#065F46;}
    .lsc-st-cancelled{background:#FEE2E2;color:#991B1B;}
    /* ── print ── */
    @media print {
      body>*:not(#lsc-print-root){display:none!important;}
      #lsc-print-root{display:block!important;}
      .lsc-no-print{display:none!important;}
    }
    /* ── mobile tweaks ── */
    @media(max-width:500px){
      .lsc-modal{border-radius:10px;}
      .lsc-modal-body{padding:14px;}
      .lsc-btn{font-size:13px;padding:9px 14px;}
      .lsc-tbl th,.lsc-tbl td{padding:6px 7px;font-size:12px;}
    }
  `;
  document.head.appendChild(style);

  // ── OVERLAY / MODAL HELPERS ───────────────────────────────────────────────
  function makeOverlay(closeOnBackdrop = true) {
    const ov = document.createElement('div');
    ov.className = 'lsc-ov';
    if (closeOnBackdrop) ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    return ov;
  }

  function closeBtn(ov) {
    const b = document.createElement('button');
    b.className = 'lsc-btn-close lsc-no-print';
    b.innerHTML = '×';
    b.addEventListener('click', () => ov.remove());
    return b;
  }

  // ── STATUS COLOUR HELPER ──────────────────────────────────────────────────
  function statusClass(s) { return 'lsc-status-badge lsc-st-' + (s || 'pending'); }

  // ── 1. REMARKS MODAL ─────────────────────────────────────────────────────
  function showRemarksModal() {
    return new Promise(resolve => {
      const ov = makeOverlay(false);
      ov.innerHTML = `
        <div class="lsc-modal">
          <div class="lsc-modal-hdr">
            <h3>✅ Mark as Ready — Add a Note</h3>
            ${closeBtn(ov).outerHTML}
          </div>
          <div class="lsc-modal-body">
            <div class="lsc-field">
              <label class="lsc-label">Note for employee <span>(optional — e.g. stain warning, missing item)</span></label>
              <textarea id="lsc-rm-txt" class="lsc-textarea" placeholder="e.g. One shirt had a stain that could not be fully removed. Please inspect before collecting."></textarea>
            </div>
          </div>
          <div class="lsc-modal-footer">
            <button class="lsc-btn lsc-btn-ghost lsc-no-print" id="lsc-rm-cancel">Cancel</button>
            <button class="lsc-btn lsc-btn-green" id="lsc-rm-confirm">✓ Confirm — Mark as Ready</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      setTimeout(() => ov.querySelector('#lsc-rm-txt').focus(), 60);
      ov.querySelector('.lsc-btn-close').addEventListener('click', () => { ov.remove(); resolve(false); });
      ov.querySelector('#lsc-rm-cancel').addEventListener('click', () => { ov.remove(); resolve(false); });
      ov.querySelector('#lsc-rm-confirm').addEventListener('click', () => {
        const note = ov.querySelector('#lsc-rm-txt').value.trim() || null;
        ov.remove();
        resolve(note === null ? '' : note);
      });
    });
  }

  // ── 2. FETCH INTERCEPTOR ─────────────────────────────────────────────────
  const _origFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = (typeof input === 'string' ? input : input?.url) || '';

    // ── Intercept → "ready" status ─────────────────────────────────────────
    if (init?.method === 'PATCH' && /\/api\/laundry\/\d+\/status/.test(url) && init?.body) {
      try {
        const body = JSON.parse(init.body);
        if (body.status === 'ready') {
          const result = await showRemarksModal();
          if (result === false) {
            return new Response(JSON.stringify({ cancelled: true }), {
              status: 200, headers: { 'Content-Type': 'application/json' }
            });
          }
          if (result) body.staffNote = result;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (e) {}
    }

    // ── Intercept laundry submit → attach pickup + delivery location ────────
    if (init?.method === 'POST' && /\/api\/laundry$/.test(url) && init?.body) {
      try {
        const body = JSON.parse(init.body);
        const pickup = (window.__lsc.pickupLocation || '').trim();
        const delivery = (window.__lsc.deliveryLocation || '').trim();

        // Validate pickup required
        if (!pickup) {
          const errEl = document.getElementById('lsc-pickup-input');
          if (errEl) {
            errEl.classList.add('lsc-error');
            const hint = document.getElementById('lsc-pickup-hint');
            if (hint) { hint.textContent = 'Pickup location is required.'; hint.className = 'lsc-input-hint lsc-err-msg'; }
            errEl.focus();
          }
          return new Response(JSON.stringify({ error: 'Pickup location is required.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }

        body.location = pickup;
        if (delivery) body.deliveryLocation = delivery;
        init = { ...init, body: JSON.stringify(body) };
      } catch (e) {}
    }

    // ── Cache staffNote + deliveryLocation from record list responses ──────
    const resp = await _origFetch(input, init);
    if (/\/api\/laundry(\?|$)/.test(url) && (!init?.method || init.method === 'GET')) {
      resp.clone().json().then(data => {
        const recs = data?.records || (Array.isArray(data) ? data : []);
        recs.forEach(r => {
          if (r.recordId) {
            if (r.staffNote) window.__lsc.staffNoteCache[r.recordId] = r.staffNote;
            if (r.deliveryLocation) window.__lsc.dlCache[r.recordId] = r.deliveryLocation;
          }
        });
        scheduleNoteBadges();
      }).catch(() => {});
    }
    return resp;
  };

  // ── 3. SUBMIT FORM — PICKUP + DELIVERY LOCATION ──────────────────────────
  let locSectionInjected = false;

  function injectLocationSection(anchor) {
    if (locSectionInjected || document.getElementById('lsc-loc-section')) return;
    locSectionInjected = true;

    const section = document.createElement('div');
    section.id = 'lsc-loc-section';
    section.className = 'lsc-loc-section';
    section.innerHTML = `
      <p class="lsc-loc-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Pickup &amp; Delivery Locations
      </p>
      <div class="lsc-field">
        <label class="lsc-label" for="lsc-pickup-input">
          Pickup Location <span style="color:#DC2626">*</span>
          <span style="margin-left:4px;">(room, floor, accommodation, etc.)</span>
        </label>
        <input id="lsc-pickup-input" class="lsc-input" type="text"
          placeholder="e.g. Tower A – Room 212, Female Accommodation Block 3…"
          autocomplete="off" maxlength="200" />
        <p id="lsc-pickup-hint" class="lsc-input-hint">Enter where laundry should be collected from. This field is required.</p>
      </div>
      <hr class="lsc-divider" />
      <div class="lsc-field">
        <label class="lsc-label" for="lsc-delivery-input">
          Delivery Location
          <span>(optional — leave blank to collect from laundry room)</span>
        </label>
        <input id="lsc-delivery-input" class="lsc-input" type="text"
          placeholder="e.g. Manager's Office, Reception, same room as above…"
          autocomplete="off" maxlength="200" />
        <p class="lsc-input-hint">If specified, laundry will be delivered to this location instead.</p>
      </div>
    `;
    anchor.after(section);

    const pickupEl = document.getElementById('lsc-pickup-input');
    const deliveryEl = document.getElementById('lsc-delivery-input');

    pickupEl.addEventListener('input', () => {
      window.__lsc.pickupLocation = pickupEl.value;
      pickupEl.classList.remove('lsc-error');
      const hint = document.getElementById('lsc-pickup-hint');
      if (hint) { hint.textContent = 'Enter where laundry should be collected from. This field is required.'; hint.className = 'lsc-input-hint'; }
    });
    deliveryEl.addEventListener('input', () => {
      window.__lsc.deliveryLocation = deliveryEl.value;
    });

    // Pre-fill pickup from employee profile if available in localStorage
    try {
      const tok = getToken();
      if (tok) {
        const payload = JSON.parse(atob(tok.split('.')[1]));
        // Try to get employee location from /api/users/me or parse from token
      }
    } catch (e) {}
  }

  function tryInjectLocationSection() {
    if (document.getElementById('lsc-loc-section')) return;
    // Look for the submit/notes textarea or the form submit button
    const textareas = [...document.querySelectorAll('textarea')];
    const notesTA = textareas.find(t =>
      t.placeholder?.toLowerCase().match(/note|instruction|additional|special/));
    if (notesTA) {
      const block = notesTA.closest('[class]') || notesTA.parentElement;
      if (block) { injectLocationSection(block); return; }
    }
    // Fallback: look for the submit button and insert before it
    const submitBtns = [...document.querySelectorAll('button')];
    const submitBtn = submitBtns.find(b => b.textContent?.match(/submit laundry/i));
    if (submitBtn) {
      const block = submitBtn.closest('[class]') || submitBtn.parentElement;
      if (block) {
        const prev = block.previousElementSibling || block.parentElement;
        if (prev && !document.getElementById('lsc-loc-section')) injectLocationSection(prev);
      }
    }
  }

  // Reset when leaving submit page
  function resetLocationState() {
    window.__lsc.pickupLocation = '';
    window.__lsc.deliveryLocation = '';
    locSectionInjected = false;
  }

  // ── 4. STATS CARDS → RECORDS MODAL ───────────────────────────────────────
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  function getDateRangeForLabel(label) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    if (/today/i.test(label)) {
      return { from: new Date(y,m,d), to: new Date(y,m,d+1), title: 'Today — ' + now.toLocaleDateString() };
    }
    if (/this week/i.test(label)) {
      const dow = now.getDay();
      const mon = new Date(y,m,d - ((dow+6)%7));
      const sun = new Date(mon); sun.setDate(mon.getDate()+7);
      return { from: mon, to: sun, title: 'This Week (' + mon.toLocaleDateString() + ' – ' + now.toLocaleDateString() + ')' };
    }
    if (/this month/i.test(label)) {
      return { from: new Date(y,m,1), to: new Date(y,m+1,1), title: MONTH_NAMES[m] + ' ' + y };
    }
    if (/this year/i.test(label)) {
      return { from: new Date(y,0,1), to: new Date(y+1,0,1), title: 'Year ' + y };
    }
    return { from: new Date(y,m,1), to: new Date(y,m+1,1), title: MONTH_NAMES[m] + ' ' + y };
  }

  async function fetchRecords(from, to, limit = 200) {
    const params = new URLSearchParams({
      dateFrom: from.toISOString(),
      dateTo: to.toISOString(),
      limit: String(limit)
    });
    const r = await apiFetch('/api/laundry?' + params);
    if (!r.ok) return [];
    const data = await r.json();
    return data.records || [];
  }

  async function showStatsModal(cardLabel) {
    let { from, to, title } = getDateRangeForLabel(cardLabel);
    const ov = makeOverlay(true);
    document.body.appendChild(ov);

    function buildYearOptions() {
      const cur = new Date().getFullYear();
      let opts = '';
      for (let y = cur; y >= cur - 5; y--) opts += `<option value="${y}"${y===from.getFullYear()?'selected':''}>${y}</option>`;
      return opts;
    }
    function buildMonthOptions() {
      const cur = from.getMonth();
      return MONTH_NAMES.map((n,i) => `<option value="${i}"${i===cur?'selected':''}>${n}</option>`).join('');
    }

    const modal = document.createElement('div');
    modal.className = 'lsc-modal';
    modal.style.maxWidth = '720px';
    modal.innerHTML = `
      <div class="lsc-modal-hdr">
        <h3 id="lsc-sm-title">📋 Laundry Records — ${title}</h3>
        <button class="lsc-btn-close" id="lsc-sm-close">×</button>
      </div>
      <div class="lsc-modal-body" style="padding-bottom:8px;">
        <div class="lsc-search-row lsc-no-print">
          <div style="display:flex;flex-direction:column;gap:3px;">
            <span class="lsc-label" style="margin:0;">Year</span>
            <select class="lsc-select" id="lsc-sm-year" style="max-width:120px;">${buildYearOptions()}</select>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;">
            <span class="lsc-label" style="margin:0;">Month</span>
            <select class="lsc-select" id="lsc-sm-month" style="max-width:140px;">${buildMonthOptions()}</select>
          </div>
          <button class="lsc-btn lsc-btn-ghost" id="lsc-sm-search" style="align-self:flex-end;">🔍 Search</button>
        </div>
        <div id="lsc-sm-pills" class="lsc-summary-pills"></div>
        <div id="lsc-sm-tbl-wrap" class="lsc-tbl-wrap">
          <table class="lsc-tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Record ID</th>
                <th>Employee</th>
                <th>Pickup Location</th>
                <th>Delivery</th>
                <th>Items</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody id="lsc-sm-tbody"><tr><td colspan="9" style="text-align:center;padding:20px;color:#94A3B8;">Loading…</td></tr></tbody>
          </table>
        </div>
      </div>
      <div class="lsc-modal-footer lsc-no-print">
        <button class="lsc-btn lsc-btn-ghost" id="lsc-sm-close2">Close</button>
        <button class="lsc-btn lsc-btn-primary" id="lsc-sm-pdf" style="background:#DC2626;">🖨 Export PDF</button>
      </div>`;

    ov.appendChild(modal);
    document.getElementById('lsc-sm-close').addEventListener('click', () => ov.remove());
    document.getElementById('lsc-sm-close2').addEventListener('click', () => ov.remove());

    async function loadRecords() {
      const tbody = document.getElementById('lsc-sm-tbody');
      const pillsEl = document.getElementById('lsc-sm-pills');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:#94A3B8;">Loading…</td></tr>';
      pillsEl.innerHTML = '';

      const records = await fetchRecords(from, to);

      // Summary pills
      const counts = {};
      records.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
      const totalItems = records.reduce((s,r) => s + (r.totalItems || 0), 0);

      pillsEl.innerHTML = `
        <span class="lsc-pill"><span class="lsc-pill-val">${records.length}</span> Total Submissions</span>
        <span class="lsc-pill"><span class="lsc-pill-val">${totalItems}</span> Total Items</span>
        ${Object.entries(counts).map(([st,n]) => `<span class="lsc-pill"><span class="lsc-pill-val">${n}</span> ${st.charAt(0).toUpperCase()+st.slice(1)}</span>`).join('')}
      `;

      // Table rows
      if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:#94A3B8;">No records found for this period.</td></tr>';
        return;
      }
      tbody.innerHTML = records.map((r, i) => `
        <tr>
          <td style="color:#94A3B8;font-size:11px;">${i+1}</td>
          <td style="font-family:monospace;font-size:12px;">${r.recordId}</td>
          <td>${r.employeeName || '—'}<br><span style="color:#94A3B8;font-size:11px;">${r.employeeCode || ''}</span></td>
          <td style="font-size:12px;">${r.location || '—'}</td>
          <td style="font-size:12px;">${r.deliveryLocation || '—'}</td>
          <td style="text-align:center;">${r.totalItems || 0}</td>
          <td><span class="${statusClass(r.status)}">${r.status}</span></td>
          <td style="font-size:11.5px;white-space:nowrap;">${new Date(r.submittedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td>
          <td style="font-size:11.5px;max-width:140px;">${r.staffNote ? '<span class="lsc-badge lsc-badge-note" title="'+escHtml(r.staffNote)+'">📝 '+escHtml(r.staffNote.slice(0,40))+(r.staffNote.length>40?'…':'')+'</span>' : ''}</td>
        </tr>`).join('');
    }

    // Search button
    document.getElementById('lsc-sm-search').addEventListener('click', () => {
      const y = parseInt(document.getElementById('lsc-sm-year').value);
      const mo = parseInt(document.getElementById('lsc-sm-month').value);
      from = new Date(y, mo, 1);
      to = new Date(y, mo + 1, 1);
      title = MONTH_NAMES[mo] + ' ' + y;
      const titleEl = document.getElementById('lsc-sm-title');
      if (titleEl) titleEl.textContent = '📋 Laundry Records — ' + title;
      loadRecords();
    });

    // PDF export
    document.getElementById('lsc-sm-pdf').addEventListener('click', () => {
      const printRoot = document.getElementById('lsc-print-root') || document.createElement('div');
      printRoot.id = 'lsc-print-root';
      printRoot.style.cssText = 'display:none;';
      printRoot.innerHTML = `
        <div style="font-family:system-ui,sans-serif;padding:24px;max-width:900px;margin:auto;">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;border-bottom:2px solid #1E293B;padding-bottom:14px;">
            <div>
              <h1 style="margin:0;font-size:18px;color:#1E293B;">Al Bateen Beach Palace — Laundry Records</h1>
              <p style="margin:4px 0 0;color:#475569;font-size:13px;">${title} | Exported: ${new Date().toLocaleString()}</p>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
            ${document.getElementById('lsc-sm-pills')?.innerHTML || ''}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#1E293B;color:#fff;">
                <th style="padding:8px;text-align:left;">#</th>
                <th style="padding:8px;text-align:left;">Record ID</th>
                <th style="padding:8px;text-align:left;">Employee</th>
                <th style="padding:8px;text-align:left;">Pickup Location</th>
                <th style="padding:8px;text-align:left;">Delivery</th>
                <th style="padding:8px;text-align:center;">Items</th>
                <th style="padding:8px;text-align:left;">Status</th>
                <th style="padding:8px;text-align:left;">Date</th>
                <th style="padding:8px;text-align:left;">Note</th>
              </tr>
            </thead>
            <tbody>
              ${[...document.querySelectorAll('#lsc-sm-tbody tr')].map((tr, i) =>
                `<tr style="background:${i%2===0?'#F8FAFC':'#fff'};"><td style="padding:6px 8px;">${i+1}</td>${[...tr.querySelectorAll('td')].slice(1).map(td=>`<td style="padding:6px 8px;border-bottom:1px solid #E2E8F0;">${td.innerText}</td>`).join('')}</tr>`
              ).join('')}
            </tbody>
          </table>
          <p style="margin-top:20px;font-size:11px;color:#94A3B8;text-align:center;">Al Bateen Beach Palace Hotel — Laundry Management System</p>
        </div>`;
      if (!document.getElementById('lsc-print-root')) document.body.appendChild(printRoot);
      window.print();
    });

    loadRecords();
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Make stat cards clickable
  const statCardSet = new WeakSet();

  function makeStatCardsClickable() {
    const role = getRole();
    if (!role || !['admin','staff'].includes(role)) return;

    document.querySelectorAll('*').forEach(el => {
      if (statCardSet.has(el)) return;
      const txt = el.textContent?.trim() || '';
      if (!txt.match(/\b(today|this week|this month|this year)\b/i)) return;
      if (el.children.length > 8) return; // skip large containers
      if (getComputedStyle(el).cursor === 'pointer') return; // already interactive
      const labelMatch = txt.match(/\b(today|this week|this month|this year)\b/i);
      if (!labelMatch) return;
      statCardSet.add(el);
      const card = el.closest('[class*="card"]') || el.closest('[class*="Card"]') || el.parentElement;
      if (!card || statCardSet.has(card)) return;
      statCardSet.add(card);
      card.classList.add('lsc-stat-card-clickable');
      card.addEventListener('click', () => showStatsModal(labelMatch[0]));
    });
  }

  // ── 5. NOTE + DELIVERY BADGES ─────────────────────────────────────────────
  function injectNoteBadges() {
    document.querySelectorAll('[class*="mono"],[class*="font-mono"]').forEach(el => {
      const txt = (el.textContent || '').trim();
      if (!txt.startsWith('LDY-')) return;
      if (window.__lsc.injectedNotes.has(el)) return;
      const note = window.__lsc.staffNoteCache[txt];
      const dl = window.__lsc.dlCache[txt];
      if (!note && !dl) return;
      window.__lsc.injectedNotes.add(el);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-top:5px;';
      if (note) {
        const b = document.createElement('span');
        b.className = 'lsc-badge lsc-badge-note';
        b.title = note;
        b.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${escHtml(note.length>55?note.slice(0,55)+'…':note)}`;
        wrap.appendChild(b);
      }
      if (dl) {
        const b = document.createElement('span');
        b.className = 'lsc-badge lsc-badge-loc';
        b.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Deliver to: ${escHtml(dl)}`;
        wrap.appendChild(b);
      }
      (el.closest('div') || el.parentElement)?.appendChild(wrap);
    });
  }

  let badgeScheduled = false;
  function scheduleNoteBadges() {
    if (badgeScheduled) return;
    badgeScheduled = true;
    setTimeout(() => { badgeScheduled = false; injectNoteBadges(); }, 400);
  }

  // ── 6. MUTATION OBSERVER ─────────────────────────────────────────────────
  let lastPath = '';
  const observer = new MutationObserver(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/';

    if (path !== lastPath) {
      lastPath = path;
      if (!path.includes('submit')) resetLocationState();
    }

    if (path.includes('submit') || path === '/submit') {
      tryInjectLocationSection();
    }

    const role = getRole();
    if (role && ['admin','staff'].includes(role)) {
      makeStatCardsClickable();
    }

    scheduleNoteBadges();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[LSC v2.8] Extensions loaded.');
})();
