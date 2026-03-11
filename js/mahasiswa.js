/* ════════════════════════════════════════════════
   mahasiswa.js — Tab Mahasiswa
   - user_id  = NIM
   - device_id = Nama mahasiswa
   - Scan kamera (env di HP, user di laptop)
   - Upload file QR
   - Manual token input
   - Check In (kirim user_id + device_id + qr_token)
   - Cek Status
   ════════════════════════════════════════════════ */

(function initMahasiswa() {
  'use strict';

  /* ── STATE ─────────────────────────────── */
  let html5QrScanner = null;

  /* ── HELPER: safe getElementById ──────── */
  const $ = (id) => document.getElementById(id);

  /* ── DETECT MOBILE ─────────────────────── */
  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /* ── HELPER: extract plain token dari string / JSON ── */
  function parseToken(raw) {
    const s = (raw || '').trim();
    try {
      const obj = JSON.parse(s);
      // Support berbagai bentuk: {token}, {TOKEN}, {qr_token}
      const t = obj.token || obj.TOKEN || obj.qr_token || obj.QR_TOKEN;
      if (t) return String(t).toUpperCase();
    } catch(_) {}
    return s.toUpperCase();
  }

  /* ══════════════════════════════════════════
     AUTO-SAVE NIM → sync ke Accel & GPS
     Dijalankan SAAT HALAMAN LOAD
  ══════════════════════════════════════════ */
  function syncNimToDevices(nim) {
    const accelDev = document.getElementById('accel_device_id');
    const gpsDev   = document.getElementById('gps_device_id');
    if (accelDev) accelDev.value = nim;
    if (gpsDev)   gpsDev.value   = nim;
  }

  (function initNimSync() {
    const nimInput = document.getElementById('user_id');
    if (!nimInput) return;

    // Load NIM tersimpan saat halaman pertama dibuka
    const saved = localStorage.getItem('nim') || '';
    if (saved) {
      nimInput.value = saved;
      syncNimToDevices(saved);
    }

    // Simpan + sync setiap kali NIM diketik
    nimInput.addEventListener('input', () => {
      const val = nimInput.value.trim();
      localStorage.setItem('nim', val);
      syncNimToDevices(val);
    });
  })();

  /* ══════════════════════════════════════════
     SCANNER KAMERA
     Pakai event delegation agar tidak masalah
     saat elemen belum visible waktu load
  ══════════════════════════════════════════ */

  document.addEventListener('click', function handler(e) {
    if (e.target.closest('#startScan')) openScanner();
    if (e.target.closest('#stopScan'))  stopScanner();
  });

  async function openScanner() {
    const wrapper  = $('scannerWrapper');
    const startBtn = $('startScan');
    const stopBtn  = $('stopScan');
    const readerEl = $('reader');

    if (!wrapper || !readerEl) return;

    // Reset reader element agar tidak konflik
    readerEl.innerHTML = '';

    wrapper.classList.remove('hidden');
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');

    html5QrScanner = new Html5Qrcode('reader');

    try {
      await html5QrScanner.start(
        { facingMode: isMobile() ? 'environment' : 'user' },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decodedText) => {
          const tokenInput = $('manualToken');
          if (tokenInput) tokenInput.value = decodedText.toUpperCase();
          stopScanner();
          showResult('statusResult', '📷 Token berhasil discan!', 'success');
        }
      );
    } catch (err) {
      stopScanner();
      alert('Tidak bisa membuka kamera:\n' + err);
    }
  }

  function stopScanner() {
    if (html5QrScanner) {
      html5QrScanner.stop().catch(() => {});
      html5QrScanner = null;
    }
    const wrapper  = $('scannerWrapper');
    const startBtn = $('startScan');
    const stopBtn  = $('stopScan');
    if (wrapper)  wrapper.classList.add('hidden');
    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn)  stopBtn.classList.add('hidden');
  }

  // Expose ke global agar app.js bisa panggil saat pindah tab
  window.stopScanner = stopScanner;


  /* ══════════════════════════════════════════
     FILE QR SCAN
  ══════════════════════════════════════════ */

  document.addEventListener('change', async function (e) {
    if (!e.target.closest('#qrFile')) return;

    const file = e.target.files[0];
    if (!file) return;

    const lbl = $('fileLabel');
    if (lbl) lbl.textContent = file.name;

    // Buat container tersembunyi untuk scanFile
    let tempDiv = $('_qrTemp');
    if (!tempDiv) {
      tempDiv = document.createElement('div');
      tempDiv.id = '_qrTemp';
      Object.assign(tempDiv.style, {
        position: 'absolute', width: '1px', height: '1px',
        overflow: 'hidden', opacity: '0', pointerEvents: 'none'
      });
      document.body.appendChild(tempDiv);
    } else {
      tempDiv.innerHTML = '';
    }

    try {
      const scanner = new Html5Qrcode('_qrTemp');
      const decoded = await scanner.scanFile(file, false);
      const ti = $('manualToken');
      if (ti) ti.value = decoded.toUpperCase();
      showResult('statusResult', '📁 QR dari gambar berhasil dibaca!', 'success');
    } catch {
      showResult('statusResult', 'Tidak bisa membaca QR dari gambar ini.', 'error');
    }
  });


  /* ══════════════════════════════════════════
     CHECK IN
     Payload: user_id + device_id + qr_token + ts
  ══════════════════════════════════════════ */

  document.addEventListener('click', async function (e) {
    if (!e.target.closest('#btnCheckin')) return;

    const btnCI    = $('btnCheckin');
    const userId   = ($('user_id')?.value   || '').trim();
    const deviceId = ($('device_id')?.value || '').trim();
    const token    = parseToken($('manualToken')?.value || '');

    // Validasi
    if (!userId) {
      showResult('statusResult', 'Harap isi NIM (User ID) terlebih dahulu.', 'error');
      return;
    }
    if (!deviceId) {
      showResult('statusResult', 'Harap isi Nama (Device ID) terlebih dahulu.', 'error');
      return;
    }
    if (!token) {
      showResult('statusResult', 'Harap scan QR atau masukkan token terlebih dahulu.', 'error');
      return;
    }

    setLoading(btnCI, true);

    try {
      const res = await fetch(`${BASE_URL}/presence/checkin`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          user_id  : userId,
          device_id: deviceId,
          qr_token : token,
          ts       : new Date().toISOString()
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      if (result.ok) {
        const status = result.data?.status || 'checked_in';
        showResult(
          'statusResult',
          `✅ Check-in berhasil! &nbsp;<strong>${userId}</strong> &mdash; ${deviceId} &mdash; status: <strong>${status}</strong>`,
          'success'
        );
        // Reset token setelah checkin berhasil
        const ti = $('manualToken');
        if (ti) ti.value = '';
      } else {
        showResult('statusResult', '❌ Gagal: ' + (result.error || 'Token tidak valid atau expired.'), 'error');
      }

    } catch (err) {
      showResult('statusResult', '❌ Koneksi gagal: ' + err.message, 'error');
    } finally {
      setLoading(btnCI, false);
    }
  });


  /* ══════════════════════════════════════════
     CEK STATUS
  ══════════════════════════════════════════ */

  document.addEventListener('click', async function (e) {
    if (!e.target.closest('#btnStatus')) return;

    const userId    = ($('user_id')?.value    || '').trim();
    const courseId  = ($('course_id')?.value  || '').trim();
    const sessionId = ($('session_id')?.value || '').trim();

    if (!userId) {
      showResult('statusResult', 'Harap isi NIM (User ID) terlebih dahulu.', 'error');
      return;
    }

    try {
      const params = new URLSearchParams({ user_id: userId });
      if (courseId)  params.append('course_id', courseId);
      if (sessionId) params.append('session_id', sessionId);

      const res    = await fetch(`${BASE_URL}/presence/status?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      if (result.ok) {
        const d      = result.data;
        const hadir  = d.status === 'checked_in';
        const icon   = hadir ? '✅' : '⏳';
        const label  = hadir ? 'Sudah hadir' : 'Belum hadir';
        const detail = [d.course_id || courseId, d.session_id || sessionId]
          .filter(Boolean).join(' / ');

        showResult(
          'statusResult',
          `${icon} <strong>${label}</strong>${detail ? ' &mdash; ' + detail : ''}`,
          hadir ? 'success' : 'error'
        );
      } else {
        showResult('statusResult', '⏳ Belum ada data presensi. ' + (result.error || ''), 'error');
      }

    } catch (err) {
      showResult('statusResult', '❌ Koneksi gagal: ' + err.message, 'error');
    }
  });

})();