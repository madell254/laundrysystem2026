/* ─────────────────────────────────────────────────────────────────────────
   Al Bateen Beach Palace — Laundry Management System  v2.9.0
   ─ Pickup Location (required free-text) replaces the predefined dropdown
   ─ Delivery Location (optional free-text) added alongside pickup
   ─ Remarks modal when staff marks laundry as "Ready"
   ─ Clickable stat cards (admin/staff) → records modal with filter + PDF
   ─ Note / delivery badges on record cards
   ─ Mobile-safe layout (no overlapping text or buttons)
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Auth helpers ───────────────────────────────────────────────────────── */
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
    const hdrs = { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(opts?.headers || {}) };
    return fetch(path, { ...opts, headers: hdrs });
  }

  /* ── Global state ───────────────────────────────────────────────────────── */
  const S = {
    pickup: '',          // pickup location typed by user
    delivery: '',        // delivery location typed by user
    noteCache: {},       // recordId → staffNote
    dlCache: {},         // recordId → deliveryLocation
    notedEls: new WeakSet(),
    statCards: new WeakSet()
  };

  /* ── Styles ─────────────────────────────────────────────────────────────── */
  const STYLE = `
    /* ---- Modals ---- */
    .lsc-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;padding:8px;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;}
    .lsc-modal{background:#fff;border-radius:14px;width:100%;max-width:560px;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;font-family:system-ui,-apple-system,sans-serif;}
    .lsc-modal.lsc-wide{max-width:820px;}
    .lsc-mhdr{background:#1E293B;color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;}
    .lsc-mhdr h3{margin:0;font-size:15px;font-weight:700;line-height:1.4;flex:1;min-width:0;}
    .lsc-mbody{padding:18px;overflow-y:auto;max-height:calc(100svh - 160px);}
    .lsc-mfoot{padding:10px 18px 16px;display:flex;flex-wrap:wrap;gap:8px;border-top:1px solid #E2E8F0;flex-shrink:0;}
    .lsc-xbtn{background:rgba(255,255,255,.15);border:none;color:#fff;font-size:22px;line-height:1;width:32px;height:32px;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0;}
    .lsc-xbtn:hover{background:rgba(255,255,255,.3);}
    /* ---- Form fields ---- */
    .lsc-fld{margin-bottom:14px;}
    .lsc-fld:last-child{margin-bottom:0;}
    .lsc-lbl{display:block;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;line-height:1.4;}
    .lsc-req{color:#DC2626;margin-left:2px;}
    .lsc-sub{font-weight:400;text-transform:none;letter-spacing:0;color:#94A3B8;font-size:11px;margin-left:4px;}
    .lsc-inp,.lsc-ta{width:100%;box-sizing:border-box;border:1.5px solid #CBD5E1;border-radius:10px;padding:10px 13px;font-size:14px;font-family:inherit;color:#1E293B;background:#fff;outline:none;-webkit-appearance:none;appearance:none;display:block;}
    .lsc-inp:focus,.lsc-ta:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.12);}
    .lsc-inp.err{border-color:#DC2626;background:#FFF5F5;}
    .lsc-hint{font-size:12px;color:#94A3B8;margin-top:5px;line-height:1.5;}
    .lsc-hint.err{color:#DC2626;font-weight:700;}
    .lsc-ta{resize:vertical;min-height:76px;}
    /* ---- Buttons ---- */
    .lsc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 20px;border-radius:10px;border:none;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;transition:opacity .15s;white-space:nowrap;min-height:44px;box-sizing:border-box;-webkit-appearance:none;}
    .lsc-btn:hover{opacity:.85;}
    .lsc-btn:disabled{opacity:.45;cursor:not-allowed;}
    .lsc-btn-p{background:#2563EB;color:#fff;flex:1;}
    .lsc-btn-g{background:#F1F5F9;color:#334155;border:1.5px solid #CBD5E1;}
    .lsc-btn-grn{background:#16A34A;color:#fff;flex:1;}
    .lsc-btn-red{background:#DC2626;color:#fff;}
    /* ---- Location section on submit page ---- */
    .lsc-loc-wrap{background:#fff;border-radius:14px;border:1.5px solid #CBD5E1;overflow:hidden;margin-bottom:16px;}
    .lsc-loc-hdr{background:#F8FAFC;border-bottom:1.5px solid #E2E8F0;padding:12px 16px;display:flex;align-items:center;gap:8px;}
    .lsc-loc-hdr-txt{font-size:13px;font-weight:800;color:#1E293B;}
    .lsc-loc-body{padding:16px;}
    .lsc-loc-row{display:grid;grid-template-columns:1fr;gap:14px;}
    @media(min-width:540px){.lsc-loc-row{grid-template-columns:1fr 1fr;}}
    .lsc-err-banner{background:#FFF5F5;border:1.5px solid #FECACA;border-radius:10px;padding:10px 14px;color:#DC2626;font-size:13px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:7px;}
    /* ---- Stats modal ---- */
    .lsc-pills{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;}
    .lsc-pill{background:#F1F5F9;border-radius:20px;padding:5px 13px;font-size:13px;color:#475569;border:1px solid #E2E8F0;}
    .lsc-pill b{color:#1E293B;}
    .lsc-frow{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:flex-end;}
    .lsc-sel{border:1.5px solid #CBD5E1;border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;background:#fff;outline:none;-webkit-appearance:none;appearance:none;cursor:pointer;color:#1E293B;}
    .lsc-sel:focus{border-color:#2563EB;}
    .lsc-tw{overflow-x:auto;border-radius:10px;border:1px solid #E2E8F0;max-height:380px;overflow-y:auto;}
    .lsc-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}
    .lsc-tbl th{background:#F8FAFC;color:#475569;font-weight:700;padding:8px 10px;text-align:left;border-bottom:2px solid #E2E8F0;position:sticky;top:0;white-space:nowrap;}
    .lsc-tbl td{padding:7px 10px;border-bottom:1px solid #F1F5F9;color:#1E293B;vertical-align:top;}
    .lsc-tbl tr:hover td{background:#F8FAFC;}
    .lsc-sbadge{display:inline-block;border-radius:12px;padding:2px 10px;font-size:11px;font-weight:700;text-transform:capitalize;white-space:nowrap;}
    .lsc-s-pending{background:#FEF9C3;color:#854D0E;}
    .lsc-s-washing{background:#DBEAFE;color:#1D4ED8;}
    .lsc-s-drying{background:#EDE9FE;color:#6D28D9;}
    .lsc-s-ready{background:#DCFCE7;color:#15803D;}
    .lsc-s-collected{background:#D1FAE5;color:#065F46;}
    .lsc-s-cancelled{background:#FEE2E2;color:#991B1B;}
    /* ---- Badges on record cards ---- */
    .lsc-badge{display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:3px 9px;font-size:11.5px;margin:2px 2px 2px 0;vertical-align:middle;word-break:break-word;}
    .lsc-badge-n{background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;}
    .lsc-badge-d{background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;}
    /* ---- Stat card hover ---- */
    .lsc-card-click{cursor:pointer!important;transition:box-shadow .15s,transform .15s!important;}
    .lsc-card-click:hover{transform:translateY(-2px)!important;box-shadow:0 8px 24px rgba(37,99,235,.2)!important;}
    /* ---- Print ---- */
    @media print{body>*:not(#lsc-pr){display:none!important;}#lsc-pr{display:block!important;}}
    /* ---- Mobile tweaks ---- */
    @media(max-width:480px){
      .lsc-mbody{padding:12px;}
      .lsc-btn{font-size:13px;padding:10px 14px;}
      .lsc-tbl th,.lsc-tbl td{padding:6px 7px;font-size:11.5px;}
      .lsc-mhdr h3{font-size:13px;}
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  /* ── Modal helpers ──────────────────────────────────────────────────────── */
  function makeOverlay(closeOnBackdrop) {
    const ov = document.createElement('div');
    ov.className = 'lsc-ov';
    if (closeOnBackdrop) ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    return ov;
  }

  function closeBtn(ov) {
    const b = document.createElement('button');
    b.className = 'lsc-xbtn';
    b.type = 'button';
    b.textContent = '×';
    b.onclick = () => ov.remove();
    return b;
  }

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (_) { return iso || ''; } }

  /* ────────────────────────────────────────────────────────────────────────
     FEATURE 1: Remarks modal when staff marks laundry "Ready"
     ──────────────────────────────────────────────────────────────────────── */
  function showRemarksModal() {
    return new Promise(resolve => {
      const ov = makeOverlay(false);
      const modal = document.createElement('div');
      modal.className = 'lsc-modal';
      modal.innerHTML = `
        <div class="lsc-mhdr">
          <h3>✅ Mark as Ready — Add Staff Note (Optional)</h3>
        </div>
        <div class="lsc-mbody">
          <div class="lsc-fld">
            <label class="lsc-lbl">Note for the employee <span class="lsc-sub">(optional)</span></label>
            <textarea id="lrm-ta" class="lsc-ta" rows="3"
              placeholder="e.g. One shirt had a stain that could not be fully removed. Please inspect before collecting."></textarea>
            <p class="lsc-hint">This note will appear in the employee's notification and on their record.</p>
          </div>
        </div>
        <div class="lsc-mfoot">
          <button class="lsc-btn lsc-btn-g" id="lrm-cancel" type="button" style="flex:0 0 auto;">Cancel</button>
          <button class="lsc-btn lsc-btn-grn" id="lrm-ok" type="button">✓ Confirm — Mark as Ready</button>
        </div>`;
      modal.querySelector('.lsc-mhdr').appendChild(closeBtn(ov));
      modal.querySelector('#lrm-cancel').onclick = () => { ov.remove(); resolve(false); };
      modal.querySelector('#lrm-ok').onclick = () => {
        const note = modal.querySelector('#lrm-ta').value.trim();
        ov.remove();
        resolve(note || '');
      };
      ov.appendChild(modal);
      document.body.appendChild(ov);
      setTimeout(() => { try { modal.querySelector('#lrm-ta').focus(); } catch (_) {} }, 80);
    });
  }

  /* ────────────────────────────────────────────────────────────────────────
     FEATURE 2: Pickup & Delivery Location on Submit Form
     Strategy:
       a) Inject two free-text inputs into the form
       b) Hide the existing predefined Location dropdown
       c) Auto-satisfy React's !u check by selecting first valid option
          in the hidden dropdown (so the form's internal validation passes)
       d) Our fetch interceptor replaces body.location with the actual
          pickup text the user typed
     ──────────────────────────────────────────────────────────────────────── */

  /** Find the Location select managed by React on the submit page */
  function findLocationSelect() {
    return [...document.querySelectorAll('select')].find(sel => {
      const opts = [...sel.options].map(o => o.text.toLowerCase()).join(' ');
      return opts.includes('select location') || opts.includes('collect from');
    });
  }

  /** Set a React-controlled select's value so React's state is updated */
  function setReactSelectValue(sel, val) {
    try {
      // Ensure the option exists (add temporarily if not)
      let opt = [...sel.options].find(o => o.value === val);
      if (!opt) {
        opt = new Option(val, val, false, true);
        opt.setAttribute('data-lsc-tmp', '1');
        sel.appendChild(opt);
      }
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      nativeSetter.call(sel, val);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  /** Make React think a valid location is selected so the form doesn't block submit */
  function satisfyReactLocationCheck() {
    const sel = findLocationSelect();
    if (!sel) return;
    // Use first non-empty predefined option as the hidden "dummy" value
    const firstOpt = [...sel.options].find(o => o.value && !o.getAttribute('data-lsc-tmp'));
    if (firstOpt) {
      setReactSelectValue(sel, firstOpt.value);
    } else {
      // Fallback: inject a dummy option
      setReactSelectValue(sel, '__lsc_pickup__');
    }
  }

  function clearReactLocationCheck() {
    const sel = findLocationSelect();
    if (sel) setReactSelectValue(sel, '');
  }

  function injectLocSection(anchorEl) {
    if (document.getElementById('lsc-loc-wrap')) return;

    const box = document.createElement('div');
    box.id = 'lsc-loc-wrap';
    box.className = 'lsc-loc-wrap';
    box.innerHTML = `
      <div class="lsc-loc-hdr">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" style="flex-shrink:0;margin-top:1px"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span class="lsc-loc-hdr-txt">Pickup &amp; Delivery Locations</span>
      </div>
      <div class="lsc-loc-body">
        <div id="lsc-err-banner" class="lsc-err-banner" style="display:none;">
          ⚠ Please enter your pickup location before submitting.
        </div>
        <div class="lsc-loc-row">
          <div class="lsc-fld">
            <label class="lsc-lbl" for="lsc-pickup">
              Pickup Location <span class="lsc-req">*</span>
              <span class="lsc-sub">— where we collect your laundry from</span>
            </label>
            <input id="lsc-pickup" class="lsc-inp" type="text"
              placeholder="e.g. Tower A Room 212, Block 3, Reception…"
              autocomplete="off" maxlength="200" inputmode="text" />
            <p id="lsc-pickup-hint" class="lsc-hint">Required — enter your room, floor, or accommodation block.</p>
          </div>
          <div class="lsc-fld">
            <label class="lsc-lbl" for="lsc-delivery">
              Delivery Location <span class="lsc-sub">— optional</span>
            </label>
            <input id="lsc-delivery" class="lsc-inp" type="text"
              placeholder="e.g. Manager's Office, same room, Floor 3…"
              autocomplete="off" maxlength="200" inputmode="text" />
            <p class="lsc-hint">Leave blank to collect from the laundry room when ready.</p>
          </div>
        </div>
      </div>`;

    anchorEl.before(box);

    const pickupInp = document.getElementById('lsc-pickup');
    const deliveryInp = document.getElementById('lsc-delivery');
    const errBanner = document.getElementById('lsc-err-banner');
    const pickupHint = document.getElementById('lsc-pickup-hint');

    // Restore previous values (if user navigated away and back)
    if (S.pickup) pickupInp.value = S.pickup;
    if (S.delivery) deliveryInp.value = S.delivery;

    pickupInp.addEventListener('input', function () {
      S.pickup = this.value.trim();
      this.classList.remove('err');
      if (errBanner) errBanner.style.display = 'none';
      if (pickupHint) { pickupHint.textContent = 'Required — enter your room, floor, or accommodation block.'; pickupHint.className = 'lsc-hint'; }
      if (S.pickup) {
        satisfyReactLocationCheck();
      } else {
        clearReactLocationCheck();
      }
    });

    deliveryInp.addEventListener('input', function () {
      S.delivery = this.value.trim();
    });

    // If we already have a pickup value, satisfy React immediately
    if (S.pickup) satisfyReactLocationCheck();
  }

  function hideExistingLocationDropdown() {
    // Find the container of the "Location *" label+select and hide it
    const labels = [...document.querySelectorAll('label:not([id])')]
      .filter(l => !l.closest('#lsc-loc-wrap'));
    const locLabel = labels.find(l => /^Location\s*\*?\s*$/.test(l.textContent.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()));
    if (locLabel) {
      const container = locLabel.closest('div');
      if (container) container.style.display = 'none';
    }
  }

  function tryInjectForm() {
    if (document.getElementById('lsc-loc-wrap')) {
      // Already injected — keep location dropdown hidden and React state happy
      hideExistingLocationDropdown();
      if (S.pickup) satisfyReactLocationCheck();
      return;
    }

    const path = location.pathname;
    if (!path.includes('submit')) return;

    // Strategy 1: inject before the Notes textarea card
    const ta = [...document.querySelectorAll('textarea')]
      .find(t => /additional|special|note|instruct/i.test(t.placeholder || ''));
    if (ta) {
      const card = ta.closest('.bg-white') || ta.closest('[class*="rounded"]') || ta.parentElement?.parentElement;
      if (card) {
        injectLocSection(card);
        hideExistingLocationDropdown();
        return;
      }
    }

    // Strategy 2: inject before the Submit button
    const submitBtn = [...document.querySelectorAll('button[type="submit"], button')]
      .find(b => /submit laundry/i.test(b.textContent || ''));
    if (submitBtn) {
      const card = submitBtn.closest('.bg-white') || submitBtn.closest('[class*="rounded"]') || submitBtn.parentElement;
      if (card) {
        injectLocSection(card);
        hideExistingLocationDropdown();
        return;
      }
    }

    // Strategy 3: any form element
    const form = document.querySelector('form');
    if (form?.lastElementChild) {
      injectLocSection(form.lastElementChild);
      hideExistingLocationDropdown();
    }
  }

  /* ── Submit button click intercept — show our own error if pickup is empty */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button[type="submit"], button');
    if (!btn || !/submit laundry/i.test(btn.textContent || '')) return;
    if (!location.pathname.includes('submit')) return;

    const pickup = (S.pickup || '').trim();
    if (pickup) return; // pickup is filled → let React handle normally

    // Pickup is empty — prevent form submission and show error
    e.stopImmediatePropagation();
    e.preventDefault();

    const inp = document.getElementById('lsc-pickup');
    const hint = document.getElementById('lsc-pickup-hint');
    const banner = document.getElementById('lsc-err-banner');
    if (inp) { inp.classList.add('err'); inp.focus(); inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (hint) { hint.textContent = '⚠ Pickup location is required before submitting.'; hint.className = 'lsc-hint err'; }
    if (banner) banner.style.display = 'flex';
  }, true); // capture phase — fires before React's click handler

  /* ────────────────────────────────────────────────────────────────────────
     FEATURE 3: Fetch interceptor
     ─ Intercept PATCH /status → show remarks modal for "ready"
     ─ Intercept POST /api/laundry → inject pickup + delivery location
     ─ Cache staffNote + deliveryLocation from GET /api/laundry
     ──────────────────────────────────────────────────────────────────────── */
  const _originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = (typeof input === 'string' ? input : (input && input.url)) || '';

    /* ── Remarks modal on status → ready ── */
    if (init?.method === 'PATCH' && /\/api\/laundry\/\d+\/status/.test(url) && init?.body) {
      try {
        const body = JSON.parse(init.body);
        if (body.status === 'ready') {
          const result = await showRemarksModal();
          if (result === false) {
            // Cancelled — return a no-op response so React doesn't crash
            return new Response(JSON.stringify({ cancelled: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (result) body.staffNote = result;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (_) {}
    }

    /* ── Inject location on laundry submit ── */
    if (init?.method === 'POST' && /\/api\/laundry(\?|$)/.test(url) && init?.body) {
      try {
        const body = JSON.parse(init.body);
        const pickup = (S.pickup || '').trim();
        const delivery = (S.delivery || '').trim();

        if (pickup) {
          body.location = pickup;
          if (delivery) body.deliveryLocation = delivery;
          init = { ...init, body: JSON.stringify(body) };
        }
        // If pickup is empty the click interceptor will have already blocked this —
        // but if somehow it gets through we still allow the request to proceed
        // (server will return a validation error)
      } catch (_) {}
    }

    const resp = await _originalFetch(input, init);

    /* ── Cache notes + delivery for badges ── */
    if (/\/api\/laundry(\?|$)/.test(url) && (!init?.method || init.method === 'GET')) {
      resp.clone().json().then(data => {
        const recs = data?.records || (Array.isArray(data) ? data : []);
        recs.forEach(r => {
          if (r.recordId) {
            if (r.staffNote) S.noteCache[r.recordId] = r.staffNote;
            if (r.deliveryLocation) S.dlCache[r.recordId] = r.deliveryLocation;
          }
        });
        schedBadges();
      }).catch(() => {});
    }

    return resp;
  };

  /* ────────────────────────────────────────────────────────────────────────
     FEATURE 4: Clickable stat cards → Records modal (admin / staff)
     ──────────────────────────────────────────────────────────────────────── */
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  function dateRangeForLabel(label) {
    const n = new Date(), y = n.getFullYear(), m = n.getMonth(), d = n.getDate();
    if (/today/i.test(label)) {
      return { from: new Date(y,m,d), to: new Date(y,m,d+1), title: 'Today — ' + n.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) };
    }
    if (/this week/i.test(label)) {
      const mon = new Date(y,m,d - ((n.getDay()+6)%7));
      const sun = new Date(y,m,d - ((n.getDay()+6)%7) + 7);
      return { from: mon, to: sun, title: 'This Week' };
    }
    if (/this year|ytd/i.test(label)) {
      return { from: new Date(y,0,1), to: new Date(y+1,0,1), title: 'Year ' + y };
    }
    // default: this month
    return { from: new Date(y,m,1), to: new Date(y,m+1,1), title: MONTHS[m] + ' ' + y };
  }

  async function fetchRecords(from, to) {
    try {
      const p = new URLSearchParams({ dateFrom: from.toISOString(), dateTo: to.toISOString(), limit: '500' });
      const r = await apiFetch('/api/laundry?' + p);
      if (!r.ok) return [];
      return (await r.json()).records || [];
    } catch (_) { return []; }
  }

  function statusBadge(s) {
    return `<span class="lsc-sbadge lsc-s-${s||'pending'}">${esc(s||'pending')}</span>`;
  }

  async function showStatsModal(cardLabel) {
    let range = dateRangeForLabel(cardLabel);

    const ov = makeOverlay(true);
    const modal = document.createElement('div');
    modal.className = 'lsc-modal lsc-wide';

    const curY = new Date().getFullYear();
    const yearOpts = Array.from({length:6}, (_,i) => curY-i)
      .map(y => `<option value="${y}"${y===range.from.getFullYear()?'selected':''}>${y}</option>`).join('');
    const monthOpts = MONTHS
      .map((n,i) => `<option value="${i}"${i===range.from.getMonth()?'selected':''}>${n}</option>`).join('');

    modal.innerHTML = `
      <div class="lsc-mhdr">
        <h3 id="lsc-sm-ttl">📋 Records — ${esc(range.title)}</h3>
      </div>
      <div class="lsc-mbody">
        <div class="lsc-frow">
          <div>
            <label style="display:block;font-size:11px;font-weight:700;color:#64748B;margin-bottom:4px;">YEAR</label>
            <select class="lsc-sel" id="lsc-sm-yr">${yearOpts}</select>
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:700;color:#64748B;margin-bottom:4px;">MONTH</label>
            <select class="lsc-sel" id="lsc-sm-mo">${monthOpts}</select>
          </div>
          <button class="lsc-btn lsc-btn-g" id="lsc-sm-go" type="button" style="height:42px;">🔍 Search</button>
        </div>
        <div id="lsc-sm-pills" class="lsc-pills"></div>
        <div class="lsc-tw">
          <table class="lsc-tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Record ID</th>
                <th>Employee</th>
                <th>Pickup Location</th>
                <th>Deliver To</th>
                <th>Items</th>
                <th>Status</th>
                <th>Date</th>
                <th>Staff Note</th>
              </tr>
            </thead>
            <tbody id="lsc-sm-body">
              <tr><td colspan="9" style="text-align:center;padding:28px;color:#94A3B8;">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="lsc-mfoot">
        <button class="lsc-btn lsc-btn-g" id="lsc-sm-close" type="button" style="flex:0 0 auto;">Close</button>
        <button class="lsc-btn lsc-btn-red" id="lsc-sm-pdf" type="button" style="flex:0 0 auto;">🖨 Export PDF</button>
      </div>`;

    modal.querySelector('.lsc-mhdr').appendChild(closeBtn(ov));
    ov.appendChild(modal);
    document.body.appendChild(ov);

    document.getElementById('lsc-sm-close').onclick = () => ov.remove();

    async function render() {
      const tbody = document.getElementById('lsc-sm-body');
      const pills = document.getElementById('lsc-sm-pills');
      if (!tbody) return;

      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:28px;color:#94A3B8;">Loading…</td></tr>';
      pills.innerHTML = '';

      const recs = await fetchRecords(range.from, range.to);
      const counts = {};
      let totalItems = 0;
      recs.forEach(r => { counts[r.status] = (counts[r.status]||0)+1; totalItems += (r.totalItems||0); });

      pills.innerHTML = `
        <span class="lsc-pill"><b>${recs.length}</b> Submissions</span>
        <span class="lsc-pill"><b>${totalItems}</b> Total Items</span>
        ${Object.entries(counts).sort().map(([st,n]) =>
          `<span class="lsc-pill"><b>${n}</b> ${st.charAt(0).toUpperCase()+st.slice(1)}</span>`).join('')}`;

      if (!recs.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:#94A3B8;">No records found for this period.</td></tr>';
        return;
      }

      tbody.innerHTML = recs.map((r, i) => `
        <tr>
          <td style="color:#94A3B8;font-size:11px;">${i+1}</td>
          <td style="font-family:monospace;font-size:11.5px;white-space:nowrap;">${esc(r.recordId)}</td>
          <td>
            ${esc(r.employeeName||'—')}
            <div style="color:#94A3B8;font-size:11px;">${esc(r.employeeCode||'')}</div>
          </td>
          <td style="font-size:12px;max-width:130px;">${esc(r.location||'—')}</td>
          <td style="font-size:12px;max-width:130px;">${esc(r.deliveryLocation||'—')}</td>
          <td style="text-align:center;font-weight:700;">${r.totalItems||0}</td>
          <td>${statusBadge(r.status)}</td>
          <td style="font-size:11.5px;white-space:nowrap;">${fmtDate(r.submittedAt)}</td>
          <td style="font-size:11.5px;max-width:150px;word-break:break-word;">${r.staffNote ? `<span style="color:#1D4ED8;">📝 ${esc(r.staffNote.slice(0,60))}${r.staffNote.length>60?'…':''}</span>` : ''}</td>
        </tr>`).join('');
    }

    document.getElementById('lsc-sm-go').onclick = () => {
      const y = +document.getElementById('lsc-sm-yr').value;
      const mo = +document.getElementById('lsc-sm-mo').value;
      range = { from: new Date(y,mo,1), to: new Date(y,mo+1,1), title: MONTHS[mo]+' '+y };
      const ttl = document.getElementById('lsc-sm-ttl');
      if (ttl) ttl.textContent = '📋 Records — ' + range.title;
      render();
    };

    document.getElementById('lsc-sm-pdf').onclick = () => {
      let pr = document.getElementById('lsc-pr');
      if (!pr) { pr = document.createElement('div'); pr.id = 'lsc-pr'; document.body.appendChild(pr); }
      const summaryHtml = document.getElementById('lsc-sm-pills')?.innerHTML || '';
      const rows = [...document.querySelectorAll('#lsc-sm-body tr')].map((tr, i) =>
        `<tr style="background:${i%2===0?'#F8FAFC':'#fff'}">
          <td style="padding:5px 8px;border-bottom:1px solid #E2E8F0;">${i+1}</td>
          ${[...tr.querySelectorAll('td')].slice(1).map(td => `<td style="padding:5px 8px;border-bottom:1px solid #E2E8F0;">${td.innerHTML}</td>`).join('')}
        </tr>`).join('');
      pr.innerHTML = `
        <div style="font-family:system-ui,sans-serif;padding:24px;max-width:960px;margin:auto;">
          <div style="border-bottom:2px solid #1E293B;padding-bottom:12px;margin-bottom:16px;">
            <h1 style="margin:0;font-size:17px;color:#1E293B;">Al Bateen Beach Palace — Laundry Records</h1>
            <p style="margin:4px 0 0;color:#64748B;font-size:12px;">${esc(range.title)} &nbsp;|&nbsp; Exported: ${new Date().toLocaleString()}</p>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">${summaryHtml}</div>
          <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
            <thead>
              <tr style="background:#1E293B;color:#fff;">
                <th style="padding:7px 8px;text-align:left;">#</th>
                <th style="padding:7px 8px;text-align:left;">Record ID</th>
                <th style="padding:7px 8px;text-align:left;">Employee</th>
                <th style="padding:7px 8px;text-align:left;">Pickup Location</th>
                <th style="padding:7px 8px;text-align:left;">Deliver To</th>
                <th style="padding:7px 8px;text-align:center;">Items</th>
                <th style="padding:7px 8px;text-align:left;">Status</th>
                <th style="padding:7px 8px;text-align:left;">Date</th>
                <th style="padding:7px 8px;text-align:left;">Staff Note</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:18px;font-size:10.5px;color:#94A3B8;text-align:center;">Al Bateen Beach Palace Hotel — Laundry Management System</p>
        </div>`;
      window.print();
    };

    render();
  }

  /* ── Wire stat cards (dashboard) ───────────────────────────────────────── */
  function wireStatCards() {
    const role = getRole();
    if (!role || !['admin', 'staff'].includes(role)) return;

    document.querySelectorAll('[class]').forEach(el => {
      if (S.statCards.has(el)) return;
      const txt = el.textContent || '';
      if (!/\b(today|this week|this month|this year)\b/i.test(txt)) return;
      // Only target leaf-ish containers (not the body or large wrappers)
      if (el.children.length > 8 || txt.length > 300) return;
      const card = el.closest('[class*="card"]') || el.closest('[class*="Card"]') || el.closest('[class*="rounded"]') || el.parentElement;
      if (!card || S.statCards.has(card)) return;
      const lbl = txt.match(/\b(today|this week|this month|this year)\b/i)?.[0] || 'this month';
      S.statCards.add(el);
      S.statCards.add(card);
      card.classList.add('lsc-card-click');
      card.title = 'Click to view records';
      card.addEventListener('click', () => showStatsModal(lbl));
    });
  }

  /* ────────────────────────────────────────────────────────────────────────
     FEATURE 5: Badges on record cards (staff note + delivery location)
     ──────────────────────────────────────────────────────────────────────── */
  function injectBadges() {
    document.querySelectorAll('*').forEach(el => {
      if (S.notedEls.has(el)) return;
      const txt = (el.textContent || '').trim();
      if (!txt.startsWith('LDY-') || txt.length > 20) return;
      const note = S.noteCache[txt], dl = S.dlCache[txt];
      if (!note && !dl) return;
      S.notedEls.add(el);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;';
      if (note) {
        const b = document.createElement('span');
        b.className = 'lsc-badge lsc-badge-n';
        b.title = note;
        b.innerHTML = `📝 ${esc(note.length > 55 ? note.slice(0,55)+'…' : note)}`;
        wrap.appendChild(b);
      }
      if (dl) {
        const b = document.createElement('span');
        b.className = 'lsc-badge lsc-badge-d';
        b.innerHTML = `📍 Deliver: ${esc(dl)}`;
        wrap.appendChild(b);
      }
      (el.closest('div') || el.parentElement)?.appendChild(wrap);
    });
  }

  let badgeTmr = 0;
  function schedBadges() { clearTimeout(badgeTmr); badgeTmr = setTimeout(injectBadges, 400); }

  /* ────────────────────────────────────────────────────────────────────────
     MAIN LOOP — polling every 500ms keeps things alive through React renders
     ──────────────────────────────────────────────────────────────────────── */
  setInterval(() => {
    const path = location.pathname;
    if (path.includes('submit')) {
      tryInjectForm();
    } else {
      // Reset location state when leaving submit page
      S.pickup = '';
      S.delivery = '';
    }
    wireStatCards();
    if (Object.keys(S.noteCache).length || Object.keys(S.dlCache).length) {
      injectBadges();
    }
  }, 500);

  // Also react immediately to DOM changes
  new MutationObserver(() => {
    if (location.pathname.includes('submit')) tryInjectForm();
    wireStatCards();
  }).observe(document.body, { childList: true, subtree: true });

  console.log('[LSC v2.9.0] Loaded ✓');
})();
