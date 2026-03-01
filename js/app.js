/* ════════════════════════════════════════════════
   app.js — Shared utilities
   4 tab: Dosen | Mahasiswa | Accel | GPS
   ════════════════════════════════════════════════ */

/* ── THEME TOGGLE ──────────────────────────────── */
(function initTheme() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  if (prefersDark) document.body.classList.add('dark');
  btn.addEventListener('click', () => document.body.classList.toggle('dark'));
})();


/* ── PAGE SWITCHING ────────────────────────────── */
(function initPageSwitch() {
  const tabs = [
    { btn: 'btnDosen',     page: 'dosenPage'     },
    { btn: 'btnMahasiswa', page: 'mahasiswaPage'  },
    { btn: 'btnAccel',     page: 'accelPage'      },
    { btn: 'btnGps',       page: 'gpsPage'        },
  ];

  const indicator = document.getElementById('segIndicator');

  tabs.forEach((tab, idx) => {
    const btn = document.getElementById(tab.btn);
    if (!btn) return;
    btn.addEventListener('click', () => switchTo(idx));
  });

  function switchTo(activeIdx) {
    tabs.forEach((tab, idx) => {
      const btn  = document.getElementById(tab.btn);
      const page = document.getElementById(tab.page);
      if (!btn || !page) return;

      if (idx === activeIdx) {
        btn.classList.add('active');
        page.classList.add('active-page');
      } else {
        btn.classList.remove('active');
        page.classList.remove('active-page');
      }
    });

    // Geser indicator
    if (indicator) {
      const positions = ['', 'right', 'right2', 'right3'];
      indicator.className = 'seg-indicator ' + (positions[activeIdx] || '');
    }

    // Stop scanner kalau pindah dari mahasiswa
    if (activeIdx !== 1 && typeof window.stopScanner === 'function') {
      window.stopScanner();
    }
    // Stop accel kalau pindah dari accel
    if (activeIdx !== 2 && typeof window.stopAccel === 'function') {
      window.stopAccel();
    }
    // Stop GPS kalau pindah dari gps
    if (activeIdx !== 3 && typeof window.stopGps === 'function') {
      window.stopGps();
    }
  }
})();


/* ── HELPER: SET LOADING ───────────────────────── */
function setLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.classList.add('is-loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('is-loading');
    btn.disabled = false;
  }
}


/* ── HELPER: SHOW RESULT BOX ───────────────────── */
function showResult(elementId, msg, type, autohide = 7000) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const iconOk  = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  const iconErr = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none"/></svg>`;

  el.className = `result-box ${type}`;
  el.innerHTML = (type === 'success' ? iconOk : iconErr) + `<span>${msg}</span>`;
  el.classList.remove('hidden');

  clearTimeout(el._timer);
  if (autohide > 0) {
    el._timer = setTimeout(() => el.classList.add('hidden'), autohide);
  }
}