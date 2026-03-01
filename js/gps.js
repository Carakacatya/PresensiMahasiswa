/* ════════════════════════════════════════════════
   gps.js — Modul 3: GPS Tracking + Peta
   - Baca GPS dari browser Geolocation API
   - POST tiap 5 detik ke GAS
   - Tampil Leaflet Map: marker posisi terbaru + polyline history
   ════════════════════════════════════════════════ */

(function initGps() {
  'use strict';

  const $ = id => document.getElementById(id);

  /* ── STATE ─────────────────────────────────── */
  let isRunning    = false;
  let watchId      = null;
  let map          = null;
  let marker       = null;
  let polyline     = null;
  let pathPoints   = [];
  let lastSent     = 0;
  const SEND_INTERVAL_MS = 5000;

  /* ── INIT MAP ──────────────────────────────── */
  function initMap(lat, lng) {
    if (map) return;

    map = L.map('leafletMap', { zoomControl: true }).setView([lat, lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Custom marker icon
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:18px;height:18px;
        background:linear-gradient(135deg,#4f46e5,#7c3aed);
        border:3px solid #fff;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(109,40,217,0.5);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    marker   = L.marker([lat, lng], { icon }).addTo(map);
    polyline = L.polyline([], { color: '#7c3aed', weight: 3, opacity: 0.7 }).addTo(map);
  }

  function updateMap(lat, lng) {
    if (!map) { initMap(lat, lng); return; }

    marker.setLatLng([lat, lng]);
    pathPoints.push([lat, lng]);
    polyline.setLatLngs(pathPoints);
    map.setView([lat, lng], map.getZoom());
  }

  /* ── UPDATE UI COORDS ──────────────────────── */
  function updateCoordsUI(lat, lng, acc) {
    if ($('gpsLat')) $('gpsLat').textContent = lat.toFixed(6);
    if ($('gpsLng')) $('gpsLng').textContent = lng.toFixed(6);
    if ($('gpsAcc')) $('gpsAcc').textContent = acc ? acc.toFixed(1) + 'm' : '—';
  }

  /* ── KIRIM KE SERVER ───────────────────────── */
  async function sendGps(lat, lng, accuracy) {
    const deviceId = ($('gps_device_id')?.value || '').trim();
    if (!deviceId) return;

    try {
      await gasPost('telemetry/gps', {
        device_id : deviceId,
        ts        : new Date().toISOString(),
        lat       : lat,
        lng       : lng,
        accuracy_m: accuracy || null
      });
    } catch (err) {
      console.warn('GPS send error:', err.message);
    }
  }

  /* ── GEOLOCATION CALLBACK ──────────────────── */
  function onPosition(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const acc = pos.coords.accuracy;

    updateCoordsUI(lat, lng, acc);
    updateMap(lat, lng);

    // Throttle pengiriman ke server
    const now = Date.now();
    if (now - lastSent >= SEND_INTERVAL_MS) {
      lastSent = now;
      sendGps(lat, lng, acc);
    }
  }

  function onGpsError(err) {
    showResult('gpsResult', '❌ GPS error: ' + err.message, 'error');
    stopGps();
  }

  /* ── MULAI / STOP ──────────────────────────── */
  function startGps() {
    const deviceId = ($('gps_device_id')?.value || '').trim();
    if (!deviceId) {
      showResult('gpsResult', 'Isi Device ID dulu!', 'error'); return;
    }

    if (!navigator.geolocation) {
      showResult('gpsResult', '❌ Browser tidak support GPS.', 'error'); return;
    }

    const btn = $('btnStartGps');
    setLoading(btn, true);

    navigator.geolocation.getCurrentPosition(pos => {
      setLoading(btn, false);
      isRunning = true;

      onPosition(pos);

      watchId = navigator.geolocation.watchPosition(onPosition, onGpsError, {
        enableHighAccuracy: true,
        timeout           : 10000,
        maximumAge        : 0
      });

      $('btnStartGps').classList.add('hidden');
      $('btnStopGps').classList.remove('hidden');
      showResult('gpsResult', '📍 GPS tracking aktif — mengirim ke server tiap 5 detik...', 'success', 0);

    }, err => {
      setLoading(btn, false);
      showResult('gpsResult', '❌ Tidak bisa akses GPS: ' + err.message, 'error');
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  function stopGps() {
    isRunning = false;
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    $('btnStartGps').classList.remove('hidden');
    $('btnStopGps').classList.add('hidden');
    showResult('gpsResult', '⏹ Tracking dihentikan.', 'success');
  }

  window.stopGps = stopGps;

  /* ── EVENT LISTENERS ───────────────────────── */
  document.addEventListener('click', e => {
    if (e.target.closest('#btnStartGps')) startGps();
    if (e.target.closest('#btnStopGps'))  stopGps();
    if (e.target.closest('#btnFetchGps')) fetchHistory();
  });

  /* ── FETCH HISTORY + RENDER MAP ────────────── */
  async function fetchHistory() {
    const deviceId = ($('gps_fetch_device')?.value || $('gps_device_id')?.value || '').trim();
    if (!deviceId) {
      showResult('gpsResult', 'Isi Device ID untuk fetch!', 'error'); return;
    }

    const btn = $('btnFetchGps');
    setLoading(btn, true);

    try {
      const result = await gasGet('telemetry/gps/history', { device_id: deviceId, limit: 200 });

      if (result.ok) {
        const items = result.data.items || [];
        if (items.length === 0) {
          showResult('gpsResult', '⚠️ Belum ada data GPS untuk device ini.', 'error'); return;
        }

        // Render peta dari history
        const points = items.map(i => [i.lat, i.lng]);
        const latest = points[points.length - 1];

        if (!map) initMap(latest[0], latest[1]);

        // Reset path
        pathPoints = points;
        polyline.setLatLngs(points);
        marker.setLatLng(latest);
        map.fitBounds(polyline.getBounds(), { padding: [24, 24] });

        showResult(
          'gpsResult',
          `✅ <strong>${items.length} titik</strong> ditampilkan di peta untuk <strong>${deviceId}</strong>`,
          'success', 0
        );
      } else {
        showResult('gpsResult', '❌ ' + (result.error || 'Gagal fetch'), 'error');
      }
    } catch (err) {
      showResult('gpsResult', '❌ Koneksi gagal: ' + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  }

})();