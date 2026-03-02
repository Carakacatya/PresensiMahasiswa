const BASE_URL = "https://script.google.com/macros/s/AKfycbyKMeZdNxWdlsjMVkeZEoSdUdLPh-NC1hv64coIYCkVhYcFbrCs5Y7CI181j8z2aAKb/exec";

/* ════════════════════════════════════════════════
   SOLUSI FINAL:
   Jangan pakai path setelah /exec → menyebabkan
   redirect yang diblokir CORS.

   Kirim endpoint sebagai parameter ?path=...
   GAS baca via e.parameter.path
   ════════════════════════════════════════════════ */

async function gasPost(path, payload) {
  // Hapus leading slash dari path
  const endpoint = path.replace(/^\//, '');
  
  const qs  = '?path=' + encodeURIComponent(endpoint)
            + '&data=' + encodeURIComponent(JSON.stringify(payload));
  const url = BASE_URL + qs;

  console.log('[gasPost] fetching:', url);

  const res  = await fetch(url, { redirect: 'follow' });
  const text = await res.text();

  console.log('[gasPost] response:', text);

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Bukan JSON: ' + text.substring(0, 150));
  return JSON.parse(match[0]);
}

async function gasGet(path, params = {}) {
  const endpoint = path.replace(/^\//, '');

  const extra = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => '&' + k + '=' + encodeURIComponent(v))
    .join('');

  const url = BASE_URL + '?path=' + encodeURIComponent(endpoint) + extra;

  console.log('[gasGet] fetching:', url);

  const res  = await fetch(url, { redirect: 'follow' });
  const text = await res.text();

  console.log('[gasGet] response:', text);

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Bukan JSON: ' + text.substring(0, 150));
  return JSON.parse(match[0]);
}