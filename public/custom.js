/* ─────────────────────────────────────────────────────────────────────────
   Laundry System – Custom Extensions
   • Remarks modal when staff/admin marks laundry as "Ready"
   • Delivery location picker on the Submit form
   • Delivery location shown on record cards
   • Remarks shown to employee on their records
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getToken() {
    try {
      const raw = localStorage.getItem('auth_token') ||
                  sessionStorage.getItem('auth_token') ||
                  document.cookie.split(';').map(c => c.trim())
                    .find(c => c.startsWith('token='))?.split('=')[1];
      return raw || null;
    } catch { return null; }
  }

  function getUser() {
    try {
      const s = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  function apiFetch(path, opts) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts?.headers || {}) };
    return fetch(path, { ...opts, headers });
  }

  function currentPath() { return location.pathname.replace(/\/+$/, '') || '/'; }

  // ── Styling constants ────────────────────────────────────────────────────
  const Z = 99999;
  const BLUE = '#2563EB';
  const GOLD = '#B8860B';
  const DARK = '#1E293B';
  const RED  = '#DC2626';
  const GREEN = '#16A34A';
  const LGRAY = '#F8FAFC';
  const MGRAY = '#E2E8F0';
  const DGRAY = '#64748B';

  // ── CSS injection ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .lsc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:${Z};display:flex;align-items:center;justify-content:center;}
    .lsc-modal{background:#fff;border-radius:16px;padding:28px 28px 22px;width:min(480px,94vw);box-shadow:0 24px 60px rgba(0,0,0,.25);position:relative;}
    .lsc-modal h3{margin:0 0 6px;font-size:17px;color:${DARK};font-family:system-ui,sans-serif;}
    .lsc-modal p{margin:0 0 16px;font-size:13px;color:${DGRAY};font-family:system-ui,sans-serif;line-height:1.5;}
    .lsc-modal textarea{width:100%;box-sizing:border-box;border:1.5px solid ${MGRAY};border-radius:10px;padding:10px 12px;font-size:13.5px;font-family:system-ui,sans-serif;resize:vertical;min-height:80px;outline:none;color:${DARK};}
    .lsc-modal textarea:focus{border-color:${BLUE};}
    .lsc-modal select{width:100%;box-sizing:border-box;border:1.5px solid ${MGRAY};border-radius:10px;padding:10px 12px;font-size:13.5px;font-family:system-ui,sans-serif;color:${DARK};outline:none;background:#fff;}
    .lsc-modal select:focus{border-color:${BLUE};}
    .lsc-label{display:block;font-size:12px;font-weight:600;color:${DGRAY};margin-bottom:6px;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;}
    .lsc-row{display:flex;gap:10px;margin-top:18px;}
    .lsc-btn{flex:1;padding:10px;border-radius:10px;border:none;cursor:pointer;font-size:13.5px;font-weight:600;font-family:system-ui,sans-serif;transition:opacity .15s;}
    .lsc-btn:hover{opacity:.88;}
    .lsc-btn-primary{background:${BLUE};color:#fff;}
    .lsc-btn-cancel{background:${MGRAY};color:${DARK};}
    .lsc-note-badge{display:inline-flex;align-items:center;gap:5px;background:#EFF6FF;color:${BLUE};border:1px solid #BFDBFE;border-radius:6px;padding:3px 9px;font-size:11.5px;font-family:system-ui,sans-serif;margin-top:6px;}
    .lsc-dl-section{border-top:1px solid ${MGRAY};margin-top:16px;padding-top:14px;}
    .lsc-dl-section label{display:block;font-size:12px;font-weight:600;color:${DGRAY};margin-bottom:6px;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;}
    .lsc-dl-select{width:100%;box-sizing:border-box;border:1.5px solid ${MGRAY};border-radius:10px;padding:10px 12px;font-size:13.5px;font-family:system-ui,sans-serif;color:${DARK};background:#fff;outline:none;}
    .lsc-dl-select:focus{border-color:${BLUE};}
    .lsc-dl-other{margin-top:8px;width:100%;box-sizing:border-box;border:1.5px solid ${MGRAY};border-radius:10px;padding:10px 12px;font-size:13.5px;font-family:system-ui,sans-serif;color:${DARK};outline:none;display:none;}
    .lsc-dl-other:focus{border-color:${BLUE};}
    .lsc-admin-section{background:${LGRAY};border:1px solid ${MGRAY};border-radius:12px;padding:16px;margin-top:18px;font-family:system-ui,sans-serif;}
    .lsc-admin-section h4{margin:0 0 12px;font-size:14px;color:${DARK};}
    .lsc-admin-row{display:flex;gap:8px;margin-bottom:8px;}
    .lsc-admin-row input{flex:1;border:1.5px solid ${MGRAY};border-radius:8px;padding:8px 10px;font-size:13px;outline:none;}
    .lsc-admin-row input:focus{border-color:${BLUE};}
    .lsc-admin-row button{padding:8px 14px;border-radius:8px;border:none;background:${BLUE};color:#fff;font-size:13px;font-weight:600;cursor:pointer;}
    .lsc-dl-chip{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid ${MGRAY};border-radius:20px;padding:4px 12px 4px 14px;font-size:12.5px;color:${DARK};margin:3px;}
    .lsc-dl-chip button{border:none;background:none;cursor:pointer;color:#9CA3AF;font-size:14px;line-height:1;padding:0;}
    .lsc-dl-chip button:hover{color:${RED};}
  `;
  document.head.appendChild(style);

  // ── Modal factory ────────────────────────────────────────────────────────
  function createOverlay() {
    const el = document.createElement('div');
    el.className = 'lsc-overlay';
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    return el;
  }

  // ── 1. REMARKS MODAL (when staff marks as Ready) ─────────────────────────
  let pendingReadyResolve = null;

  function showRemarksModal() {
    return new Promise(resolve => {
      pendingReadyResolve = resolve;
      const overlay = createOverlay();
      overlay.innerHTML = `
        <div class="lsc-modal">
          <h3>✅ Mark as Ready</h3>
          <p>Optionally add a note for the employee — e.g. a missing item, a stain that could not be removed, or any other information.</p>
          <label class="lsc-label">Remarks / Note for Employee <span style="color:${DGRAY};font-weight:400;text-transform:none">(optional)</span></label>
          <textarea id="lsc-remarks-input" placeholder="e.g. One shirt had a stain that could not be fully removed. Please check before collecting."></textarea>
          <div class="lsc-row">
            <button class="lsc-btn lsc-btn-cancel" id="lsc-remarks-cancel">Cancel</button>
            <button class="lsc-btn lsc-btn-primary" id="lsc-remarks-confirm">Mark as Ready</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      setTimeout(() => overlay.querySelector('#lsc-remarks-input').focus(), 50);
      overlay.querySelector('#lsc-remarks-confirm').addEventListener('click', () => {
        const val = overlay.querySelector('#lsc-remarks-input').value.trim();
        overlay.remove();
        resolve(val || null);
      });
      overlay.querySelector('#lsc-remarks-cancel').addEventListener('click', () => {
        overlay.remove();
        resolve(false); // false = cancelled, don't proceed
      });
    });
  }

  // ── 2. FETCH INTERCEPTOR ─────────────────────────────────────────────────
  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';

    // ── Intercept status → ready ───────────────────────────────────────────
    if (init?.method === 'PATCH' && /\/api\/laundry\/\d+\/status/.test(url) && init?.body) {
      try {
        const body = JSON.parse(init.body);
        if (body.status === 'ready') {
          const remarks = await showRemarksModal();
          if (remarks === false) {
            // User cancelled — return a fake "no-op" response so React doesn't error
            return new Response(JSON.stringify({ cancelled: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (remarks) body.staffNote = remarks;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (e) { /* passthrough */ }
    }

    // ── Attach selected delivery location to laundry submit ────────────────
    if (init?.method === 'POST' && /\/api\/laundry$/.test(url) && init?.body) {
      try {
        const body = JSON.parse(init.body);
        const dl = window.__lsc_deliveryLocation;
        if (dl) {
          body.deliveryLocation = dl;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (e) { /* passthrough */ }
    }

    return _origFetch(input, init);
  };

  // ── 3. DELIVERY LOCATION PICKER on Submit Page ───────────────────────────
  let dlLocations = [];
  let dlLoaded = false;
  window.__lsc_deliveryLocation = null;

  async function loadDeliveryLocations() {
    if (dlLoaded) return;
    dlLoaded = true;
    try {
      const r = await apiFetch('/api/delivery-locations');
      if (r.ok) dlLocations = await r.json();
    } catch (e) { /* ignore */ }
  }

  function injectDeliveryLocationPicker(form) {
    if (form.querySelector('#lsc-dl-section')) return;

    const section = document.createElement('div');
    section.id = 'lsc-dl-section';
    section.className = 'lsc-dl-section';
    section.innerHTML = `
      <label>Delivery / Pick-up Location <span style="color:${DGRAY};font-weight:400;font-size:11px">(optional — leave blank to collect from laundry room)</span></label>
      <select class="lsc-dl-select" id="lsc-dl-select">
        <option value="">— Collect from laundry room (default) —</option>
        ${dlLocations.map(l => `<option value="${l.name}">${l.name}</option>`).join('')}
        ${dlLocations.length > 0 ? '<option value="__other__">Other (specify below)</option>' : ''}
      </select>
      <input class="lsc-dl-other" id="lsc-dl-other" type="text" placeholder="Specify your pick-up / delivery location..." maxlength="200" />
    `;
    form.appendChild(section);

    const sel = section.querySelector('#lsc-dl-select');
    const other = section.querySelector('#lsc-dl-other');
    sel.addEventListener('change', () => {
      if (sel.value === '__other__') {
        other.style.display = 'block';
        other.focus();
        window.__lsc_deliveryLocation = other.value.trim() || null;
      } else {
        other.style.display = 'none';
        window.__lsc_deliveryLocation = sel.value || null;
      }
    });
    other.addEventListener('input', () => {
      window.__lsc_deliveryLocation = other.value.trim() || null;
    });
  }

  // ── 4. STAFF NOTE DISPLAY on Record Cards ────────────────────────────────
  const injectedNotes = new WeakSet();

  function injectStaffNotes() {
    // Find record detail / card elements that may contain staffNote data
    // We piggyback on the API response by patching the record fetch
  }

  // ── 5. Patch the record fetch to display staffNote ────────────────────────
  // We intercept GET /api/laundry responses and cache staffNotes
  const staffNoteCache = {}; // recordId → staffNote

  const _origFetch2 = window.fetch; // already patched above
  window.fetch = async function (input, init) {
    const resp = await _origFetch2(input, init);
    const url = typeof input === 'string' ? input : input?.url || '';

    if (/\/api\/laundry(\?|$)/.test(url) && (!init?.method || init.method === 'GET')) {
      try {
        const clone = resp.clone();
        clone.json().then(data => {
          const records = data?.records || (Array.isArray(data) ? data : []);
          records.forEach(r => {
            if (r.recordId && r.staffNote) staffNoteCache[r.recordId] = r.staffNote;
            if (r.recordId && r.deliveryLocation) window.__lsc_dlCache = window.__lsc_dlCache || {};
            if (r.recordId && r.deliveryLocation) window.__lsc_dlCache[r.recordId] = r.deliveryLocation;
          });
          scheduleNoteBadgeInjection();
        }).catch(() => {});
      } catch (e) { /* ignore */ }
    }
    return resp;
  };

  // ── Inject note badges next to record IDs ─────────────────────────────────
  let noteInjectionScheduled = false;
  function scheduleNoteBadgeInjection() {
    if (noteInjectionScheduled) return;
    noteInjectionScheduled = true;
    setTimeout(() => { noteInjectionScheduled = false; injectNoteBadges(); }, 400);
  }

  function injectNoteBadges() {
    document.querySelectorAll('[class*="font-mono"]').forEach(el => {
      const text = el.textContent?.trim();
      if (!text || !text.match(/^LDY-/)) return;
      if (injectedNotes.has(el)) return;
      const note = staffNoteCache[text];
      const dl = window.__lsc_dlCache?.[text];
      if (!note && !dl) return;
      injectedNotes.add(el);
      const parent = el.closest('div') || el.parentElement;
      if (!parent) return;
      const container = document.createElement('div');
      container.style.cssText = 'margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;';
      if (note) {
        const badge = document.createElement('span');
        badge.className = 'lsc-note-badge';
        badge.title = note;
        badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Note: ${note.length > 60 ? note.slice(0, 60) + '…' : note}`;
        container.appendChild(badge);
      }
      if (dl) {
        const dbadge = document.createElement('span');
        dbadge.className = 'lsc-note-badge';
        dbadge.style.cssText = 'background:#F0FDF4;color:#15803D;border-color:#BBF7D0;';
        dbadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${dl}`;
        container.appendChild(dbadge);
      }
      parent.appendChild(container);
    });
  }

  // ── 6. MutationObserver – detect page changes ────────────────────────────
  const observer = new MutationObserver(() => {
    const path = currentPath();

    // Submit page — inject delivery location picker
    if (path === '/submit' || path.includes('submit')) {
      loadDeliveryLocations().then(() => {
        // Find the general notes textarea, inject picker after the surrounding container
        const textareas = [...document.querySelectorAll('textarea')];
        const notesTA = textareas.find(t => t.placeholder?.toLowerCase().includes('note') || t.placeholder?.toLowerCase().includes('instruction') || t.placeholder?.toLowerCase().includes('additional'));
        if (notesTA) {
          const form = notesTA.closest('form') || notesTA.parentElement?.parentElement?.parentElement;
          if (form && !form.querySelector('#lsc-dl-section')) injectDeliveryLocationPicker(form);
        }
      });
      // Reset delivery location on navigation away
      if (!document.querySelector('#lsc-dl-select')) window.__lsc_deliveryLocation = null;
    }

    // Inject note badges on any record listing page
    if (Object.keys(staffNoteCache).length > 0 || (window.__lsc_dlCache && Object.keys(window.__lsc_dlCache).length > 0)) {
      injectNoteBadges();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ── 7. ADMIN: Delivery Locations management (injected into Admin panel) ───
  let adminSectionInjected = false;

  async function injectAdminDeliverySection() {
    if (adminSectionInjected) return;
    // Find a known admin section heading to anchor after
    const headings = [...document.querySelectorAll('h2,h3,h4,section,[class*="section"]')];
    const anchor = headings.find(h => h.textContent?.includes('Location') || h.textContent?.includes('location'));
    if (!anchor) return;
    const parent = anchor.closest('[class*="Card"]') || anchor.closest('[class*="card"]') || anchor.parentElement;
    if (!parent || parent.querySelector('#lsc-admin-dl')) return;
    adminSectionInjected = true;

    await loadDeliveryLocations();

    const section = document.createElement('div');
    section.id = 'lsc-admin-dl';
    section.className = 'lsc-admin-section';
    section.style.marginTop = '16px';
    renderAdminSection(section);
    parent.after(section);
  }

  function renderAdminSection(section) {
    section.innerHTML = `
      <h4 style="color:${DARK};font-family:system-ui,sans-serif">📍 Delivery / Pick-up Locations</h4>
      <div class="lsc-admin-row">
        <input id="lsc-dl-new-input" type="text" placeholder="Add new location name…" maxlength="100" />
        <button id="lsc-dl-add-btn">Add</button>
      </div>
      <div id="lsc-dl-chips">${renderChips()}</div>
    `;
    section.querySelector('#lsc-dl-add-btn').addEventListener('click', async () => {
      const inp = section.querySelector('#lsc-dl-new-input');
      const name = inp.value.trim();
      if (!name) return;
      const r = await apiFetch('/api/delivery-locations', { method: 'POST', body: JSON.stringify({ name }) });
      if (r.ok) {
        const loc = await r.json();
        dlLocations.push(loc);
        dlLocations.sort((a, b) => a.name.localeCompare(b.name));
        inp.value = '';
        section.querySelector('#lsc-dl-chips').innerHTML = renderChips();
        attachChipHandlers(section);
      } else {
        const err = await r.json();
        alert(err.error || 'Failed to add location');
      }
    });
    attachChipHandlers(section);
  }

  function renderChips() {
    if (!dlLocations.length) return `<p style="font-size:12.5px;color:${DGRAY};margin:8px 0 0;font-family:system-ui,sans-serif;">No delivery locations added yet.</p>`;
    return dlLocations.map(l => `<span class="lsc-dl-chip" data-id="${l.id}">${l.name}<button title="Remove" data-id="${l.id}">×</button></span>`).join('');
  }

  function attachChipHandlers(section) {
    section.querySelectorAll('.lsc-dl-chip button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm('Remove this delivery location?')) return;
        const r = await apiFetch('/api/delivery-locations/' + id, { method: 'DELETE' });
        if (r.ok) {
          dlLocations = dlLocations.filter(l => String(l.id) !== String(id));
          section.querySelector('#lsc-dl-chips').innerHTML = renderChips();
          attachChipHandlers(section);
        }
      });
    });
  }

  // Watch for admin panel
  const adminObserver = new MutationObserver(() => {
    const path = currentPath();
    if (path === '/admin' || path.includes('admin')) {
      injectAdminDeliverySection();
    }
    if (path !== '/admin' && !path.includes('admin')) adminSectionInjected = false;
  });
  adminObserver.observe(document.body, { childList: true, subtree: true });

  // ── Initial trigger ──────────────────────────────────────────────────────
  // Try to detect token from React's internal state / query key storage
  // The React app stores the auth token in localStorage under 'auth_token' key
  // We need to find where it's stored. Let's check common keys:
  function detectTokenKey() {
    for (const key of Object.keys(localStorage)) {
      try {
        const val = localStorage.getItem(key);
        if (val && val.startsWith('eyJ')) { window.__lsc_token_key = key; return val; }
      } catch (e) {}
    }
    return null;
  }

  // Override getToken to use detected key
  function getTokenReal() {
    if (window.__lsc_token_key) {
      return localStorage.getItem(window.__lsc_token_key);
    }
    const t = detectTokenKey();
    if (t) return t;
    // Fallback: check all storage
    for (const key of Object.keys(localStorage)) {
      const v = localStorage.getItem(key);
      if (v && typeof v === 'string' && v.length > 50 && v.startsWith('eyJ')) return v;
    }
    return null;
  }

  // Patch apiFetch to use real token
  window._lscApiFetch = function(path, opts) {
    const token = getTokenReal();
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts?.headers || {}) };
    return _origFetch(path, { ...opts, headers });
  };

  // Re-wire apiFetch to use the improved version
  const _origApiFetch = apiFetch;
  function apiFetch(path, opts) {
    return window._lscApiFetch(path, opts);
  }

  console.log('[LSC] Custom extensions loaded.');
})();
