/* ════════════════════════════════════════════════
   accel.js — Modul 2: Accelerometer Telemetry
   - Baca sensor real (HP) atau simulasi (laptop)
   - Kumpul batch tiap 3 detik → POST ke GAS
   - GET latest dari server
   - Tampil grafik real-time Chart.js
   ════════════════════════════════════════════════ */

(function initAccel() {
  'use strict';

  const $ = id => document.getElementById(id);

  /* ── STATE ─────────────────────────────────── */
  let isRunning   = false;
  let sensorData  = { x: 0, y: 0, z: 9.8 };
  let batchBuffer = [];
  let sendInterval = null;
  let chart        = null;
  const MAX_POINTS = 40;
  const chartData  = { labels: [], x: [], y: [], z: [] };

  /* ── CHART SETUP ───────────────────────────── */
  function initChart() {
    const canvas = $('accelChart');
    if (!canvas || chart) return;

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [
          { label: 'X', data: chartData.x, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true },
          { label: 'Y', data: chartData.y, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)',  borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true },
          { label: 'Z', data: chartData.z, borderColor: '#6d28d9', backgroundColor: 'rgba(109,40,217,0.1)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { labels: { color: getComputedStyle(document.body).getPropertyValue('--text') || '#333', font: { size: 11 } } } },
        scales: {
          x: { display: false },
          y: {
            ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-2') || '#666', font: { size: 10 } },
            grid:  { color: 'rgba(109,40,217,0.08)' }
          }
        }
      }
    });
  }

  function pushToChart(x, y, z) {
    const ts = new Date().toLocaleTimeString('id', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    chartData.labels.push(ts);
    chartData.x.push(+x.toFixed(3));
    chartData.y.push(+y.toFixed(3));
    chartData.z.push(+z.toFixed(3));

    if (chartData.labels.length > MAX_POINTS) {
      chartData.labels.shift();
      chartData.x.shift();
      chartData.y.shift();
      chartData.z.shift();
    }
    if (chart) chart.update('none');
  }

  /* ── SENSOR REAL (HP) ──────────────────────── */
  function startRealSensor() {
    if (typeof DeviceMotionEvent === 'undefined') return false;

    // iOS 13+ butuh permission
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(state => {
        if (state === 'granted') listenMotion();
        else $('sensorHint').textContent = '⚠️ Izin sensor ditolak.';
      });
    } else {
      listenMotion();
    }
    return true;
  }

  function listenMotion() {
    $('sensorHint').textContent = '📱 Sensor real aktif!';
    window.addEventListener('devicemotion', onMotion);
  }

  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    sensorData.x = +(a.x || 0).toFixed(4);
    sensorData.y = +(a.y || 0).toFixed(4);
    sensorData.z = +(a.z || 0).toFixed(4);
    updateLiveUI();
  }

  /* ── SIMULASI (Laptop) ─────────────────────── */
  let simInterval = null;
  function startSimulation() {
    $('sensorHint').textContent = '💻 Mode simulasi (buka di HP untuk sensor real)';
    simInterval = setInterval(() => {
      sensorData.x = +(Math.random() * 0.4 - 0.2).toFixed(4);
      sensorData.y = +(Math.random() * 0.4 - 0.2).toFixed(4);
      sensorData.z = +(9.7 + Math.random() * 0.2).toFixed(4);
      updateLiveUI();
    }, 300);
  }

  function stopSimulation() {
    if (simInterval) { clearInterval(simInterval); simInterval = null; }
  }

  /* ── UI Live ───────────────────────────────── */
  function updateLiveUI() {
    if ($('liveX')) $('liveX').textContent = sensorData.x.toFixed(3);
    if ($('liveY')) $('liveY').textContent = sensorData.y.toFixed(3);
    if ($('liveZ')) $('liveZ').textContent = sensorData.z.toFixed(3);
    batchBuffer.push({
      t: new Date().toISOString(),
      x: sensorData.x,
      y: sensorData.y,
      z: sensorData.z
    });
    pushToChart(sensorData.x, sensorData.y, sensorData.z);
  }

  /* ── KIRIM BATCH KE SERVER ─────────────────── */
  async function sendBatch() {
    if (batchBuffer.length === 0) return;

    const deviceId = ($('accel_device_id')?.value || '').trim();
    if (!deviceId) return;

    const samples = batchBuffer.splice(0, batchBuffer.length);

    try {
      const result = await gasPost('telemetry/accel', {
        device_id: deviceId,
        ts       : new Date().toISOString(),
        samples  : samples
      });
      if (result.ok) {
        const cnt = $('accelSentCount');
        if (cnt) cnt.textContent = (+( cnt.textContent || 0) + samples.length);
      }
    } catch (err) {
      console.warn('Accel send error:', err.message);
    }
  }

  /* ── MULAI / STOP ──────────────────────────── */
  function startAccel() {
    const deviceId = ($('accel_device_id')?.value || '').trim();
    if (!deviceId) {
      showResult('accelResult', 'Isi Device ID dulu!', 'error'); return;
    }

    initChart();
    isRunning = true;

    const hint = $('sensorHint');

    // Tidak ada sensor sama sekali → simulasi
    if (typeof DeviceMotionEvent === 'undefined') {
      startSimulation();
      finishStart();
      return;
    }

    // iOS 13+ → minta izin (HARUS dari user gesture = klik tombol)
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission()
        .then(state => {
          if (state === 'granted') {
            if (hint) hint.textContent = '📱 Sensor iOS aktif!';
            window.addEventListener('devicemotion', onMotion);
          } else {
            if (hint) hint.textContent = '⚠️ Izin ditolak, pakai simulasi';
            startSimulation();
          }
          finishStart();
        })
        .catch(() => {
          startSimulation();
          finishStart();
        });
    } else {
      // Android → langsung pasang listener
      if (hint) hint.textContent = '📱 Sensor Android aktif!';
      window.addEventListener('devicemotion', onMotion);
      finishStart();
    }
  }

  function finishStart() {
    sendInterval = setInterval(sendBatch, 4000);
    $('btnStartAccel').classList.add('hidden');
    $('btnStopAccel').classList.remove('hidden');
    showResult('accelResult', '📡 Streaming ke server tiap 4 detik...', 'success', 0);
  }
  
  function stopAccel() {
    isRunning = false;
    stopSimulation();
    window.removeEventListener('devicemotion', onMotion);
    if (sendInterval) { clearInterval(sendInterval); sendInterval = null; }
    // Kirim sisa buffer
    if (batchBuffer.length > 0) sendBatch();

    $('btnStartAccel').classList.remove('hidden');
    $('btnStopAccel').classList.add('hidden');
    showResult('accelResult', '⏹ Stream dihentikan.', 'success');
  }

  window.stopAccel = stopAccel;

  /* ── EVENT LISTENERS ───────────────────────── */
  document.addEventListener('click', e => {
    if (e.target.closest('#btnStartAccel')) startAccel();
    if (e.target.closest('#btnStopAccel'))  stopAccel();
    if (e.target.closest('#btnFetchAccel')) fetchLatest();
  });

  /* ── FETCH LATEST ──────────────────────────── */
  async function fetchLatest() {
    const deviceId = ($('accel_fetch_device')?.value || $('accel_device_id')?.value || '').trim();
    if (!deviceId) {
      showResult('accelResult', 'Isi Device ID untuk fetch!', 'error'); return;
    }

    const btn = $('btnFetchAccel');
    setLoading(btn, true);

    try {
      const result = await gasGet('telemetry/accel/latest', { device_id: deviceId });
      if (result.ok && result.data) {
        const d = result.data;
        const x = (d.x !== undefined) ? Number(d.x).toFixed(4) : '—';
        const y = (d.y !== undefined) ? Number(d.y).toFixed(4) : '—';
        const z = (d.z !== undefined) ? Number(d.z).toFixed(4) : '—';
        const t = d.t || d.ts || '—';
        showResult(
          'accelResult',
          `✅ Latest <strong>${deviceId}</strong><br>` +
          `X: <strong>${x}</strong> &nbsp; Y: <strong>${y}</strong> &nbsp; Z: <strong>${z}</strong><br>` +
          `<small style="opacity:.7">${t}</small>`,
          'success', 0
        );
      } else {
        showResult('accelResult', '❌ ' + (result.error || 'Data tidak ditemukan. Pastikan sudah Mulai Kirim dulu!'), 'error');
      }
    } catch (err) {
      showResult('accelResult', '❌ Koneksi gagal: ' + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  }

})();