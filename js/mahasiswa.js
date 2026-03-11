/* ════════════════════════════════════════════════
   mahasiswa.js — Tab Mahasiswa

   3 cara input token:
   1. Scan kamera   → parse JSON otomatis
   2. Upload file   → decode pakai jsQR (lebih reliable)
   3. Token manual  → muncul field course & session
   ════════════════════════════════════════════════ */

(function initMahasiswa() {
  'use strict';

  const $ = (id) => document.getElementById(id);

  let html5QrScanner = null;
  let parsedQR = { token: '', course_id: '', session_id: '', isManual: false };

  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /* ══════════════════════════════════════════
     PARSE TEKS QR
  ══════════════════════════════════════════ */
  function handleScannedText(raw) {
    const text = (raw || '').trim();

    try {
      const obj = JSON.parse(text);
      if (obj.token) {
        parsedQR = {
          token     : obj.token.toUpperCase(),
          course_id : obj.course_id  || '',
          session_id: obj.session_id || '',
          isManual  : false
        };
        const ti = $('manualToken');
        if (ti) ti.value = parsedQR.token;
        setManualMode(false);
        updateQRInfo();
        return;
      }
    } catch (_) {}

    // Plain token — minta course & session manual
    parsedQR = { token: text.toUpperCase(), course_id: '', session_id: '', isManual: true };
    const ti = $('manualToken');
    if (ti) ti.value = parsedQR.token;
    setManualMode(true);
    updateQRInfo();
  }

  function setManualMode(show) {
    const row = $('manualCourseRow');
    if (!row) return;
    row.classList.toggle('hidden', !show);
    if (!show) {
      if ($('mhs_course_id'))  $('mhs_course_id').value  = '';
      if ($('mhs_session_id')) $('mhs_session_id').value = '';
    }
  }

  function updateQRInfo() {
    const el = $('qrInfo');
    if (!el) return;
    if (parsedQR.course_id && parsedQR.session_id) {
      el.textContent = '📘 ' + parsedQR.course_id + ' · ' + parsedQR.session_id;
      el.classList.remove('hidden');
    } else if (parsedQR.token && parsedQR.isManual) {
      el.textContent = '✏️ Token manual — isi Course ID & Session ID di bawah';
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  /* ══════════════════════════════════════════
     SCANNER KAMERA
  ══════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    if (e.target.closest('#startScan')) openScanner();
    if (e.target.closest('#stopScan'))  stopScanner();
  });

  async function openScanner() {
    const wrapper  = $('scannerWrapper');
    const startBtn = $('startScan');
    const stopBtn  = $('stopScan');
    const readerEl = $('reader');
    if (!wrapper || !readerEl) return;

    readerEl.innerHTML = '';
    wrapper.classList.remove('hidden');
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');

    html5QrScanner = new Html5Qrcode('reader');

    try {
      await html5QrScanner.start(
        { facingMode: isMobile() ? 'environment' : 'user' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleScannedText(decodedText);
          stopScanner();
          showResult('statusResult', '📷 QR berhasil discan!', 'success');
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

  window.stopScanner = stopScanner;

  /* ══════════════════════════════════════════
     UPLOAD FILE QR — pakai jsQR
     Html5Qrcode.scanFile tidak reliable untuk foto.
     jsQR decode langsung dari pixel ImageData.
  ══════════════════════════════════════════ */
  document.addEventListener('change', async function (e) {
    if (!e.target.closest('#qrFile')) return;

    const file = e.target.files[0];
    if (!file) return;

    const lbl = $('fileLabel');
    if (lbl) lbl.textContent = file.name;

    showResult('statusResult', '⏳ Membaca QR dari gambar...', 'success');

    try {
      const decoded = await decodeQRFromFile(file);
      handleScannedText(decoded);
      showResult('statusResult', '📁 QR dari gambar berhasil dibaca!', 'success');
    } catch (err) {
      console.error('QR file error:', err);
      showResult('statusResult',
        '❌ QR tidak terbaca. Pastikan gambar jelas, tidak blur, dan QR terlihat penuh.',
        'error'
      );
    }

    e.target.value = '';
  });

  /* Decode QR dari File menggunakan jsQR (via Canvas) */
  function decodeQRFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (ev) {
        const img = new Image();
        img.onload = function () {
          const canvas  = document.createElement('canvas');
          canvas.width  = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // jsQR decode
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code) {
            resolve(code.data);
          } else {
            // Coba dengan inverted
            const code2 = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'invertFirst'
            });
            if (code2) {
              resolve(code2.data);
            } else {
              reject(new Error('QR tidak ditemukan di gambar'));
            }
          }
        };
        img.onerror = () => reject(new Error('Gagal load gambar'));
        img.src = ev.target.result;
      };
      reader.onerror = () => reject(new Error('Gagal baca file'));
      reader.readAsDataURL(file);
    });
  }

  /* ── Input token manual → tampilkan field course/session ── */
  document.addEventListener('input', function (e) {
    if (!e.target.closest('#manualToken')) return;
    const val = e.target.value.trim().toUpperCase();
    if (val) {
      parsedQR = { token: val, course_id: '', session_id: '', isManual: true };
      setManualMode(true);
      updateQRInfo();
    } else {
      parsedQR = { token: '', course_id: '', session_id: '', isManual: false };
      setManualMode(false);
      updateQRInfo();
    }
  });

  /* ══════════════════════════════════════════
     CHECK IN
  ══════════════════════════════════════════ */
  document.addEventListener('click', async function (e) {
    if (!e.target.closest('#btnCheckin')) return;

    const btnCI    = $('btnCheckin');
    const userId   = ($('user_id')?.value   || '').trim();
    const deviceId = ($('device_id')?.value || '').trim();
    const token    = parsedQR.token || ($('manualToken')?.value || '').trim().toUpperCase();

    // Course & session: dari scan QR ATAU dari input manual
    const courseId  = parsedQR.course_id  || ($('mhs_course_id')?.value  || '').trim();
    const sessionId = parsedQR.session_id || ($('mhs_session_id')?.value || '').trim();

    if (!userId)   { showResult('statusResult', 'Harap isi NIM terlebih dahulu.', 'error'); return; }
    if (!deviceId) { showResult('statusResult', 'Harap isi Nama terlebih dahulu.', 'error'); return; }
    if (!token)    { showResult('statusResult', 'Harap scan QR atau masukkan token.', 'error'); return; }
    if (!courseId) { showResult('statusResult', 'Harap isi Course ID.', 'error'); return; }
    if (!sessionId){ showResult('statusResult', 'Harap isi Session ID.', 'error'); return; }

    setLoading(btnCI, true);

    try {
      const result = await gasPost('presence/checkin', {
        user_id   : userId,
        device_id : deviceId,
        course_id : courseId,
        session_id: sessionId,
        qr_token  : token,
        ts        : new Date().toISOString()
      });

      if (result.ok) {
        showResult(
          'statusResult',
          '✅ Check-in berhasil! <strong>' + userId + '</strong> — ' + deviceId +
          '<br>📘 ' + courseId + ' · ' + sessionId,
          'success'
        );
        if ($('manualToken')) $('manualToken').value = '';
        parsedQR = { token: '', course_id: '', session_id: '', isManual: false };
        setManualMode(false);
        updateQRInfo();
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

    const userId    = ($('user_id')?.value || '').trim();
    const courseId  = parsedQR.course_id  || ($('mhs_course_id')?.value  || '').trim();
    const sessionId = parsedQR.session_id || ($('mhs_session_id')?.value || '').trim();

    if (!userId) { showResult('statusResult', 'Harap isi NIM terlebih dahulu.', 'error'); return; }

    try {
      const result = await gasGet('presence/status', {
        user_id   : userId,
        course_id : courseId,
        session_id: sessionId
      });

      if (result.ok) {
        const d     = result.data;
        const hadir = d.status === 'checked_in';
        const detail = [d.course_id, d.session_id].filter(Boolean).join(' / ');
        showResult(
          'statusResult',
          (hadir ? '✅' : '⏳') + ' <strong>' + (hadir ? 'Sudah hadir' : 'Belum hadir') + '</strong>' +
          (detail ? ' — ' + detail : ''),
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