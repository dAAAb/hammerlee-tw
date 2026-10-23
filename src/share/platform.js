// Where the page runs decides how saving, sharing and storing work:
//  - inside a claude.ai Artifact: saves go through the `downloads` capability, records through `db`
//    (the sandbox blocks other hosts, so Supabase is not reachable from there);
//  - on its own site (production): Web Share with the picture, plain downloads, and Supabase.
import { CONFIG } from '../config.js';

export const inArtifact = typeof window !== 'undefined' && !!window.claude?.use;
const use = name => (inArtifact ? window.claude.use(name).catch(() => null) : Promise.resolve(null));

export function shareUrl(chatId) {
  const base = CONFIG.publicUrl || (inArtifact ? CONFIG.artifactUrl : location.origin + location.pathname);
  return `${base}#c-${chatId}`;
}

export async function canvasBlob(canvas, type = 'image/png', q) {
  return new Promise(res => canvas.toBlob(res, type, q));
}

// Offer a file to save. Resolves 'saved' | 'declined' | 'unavailable'.
export async function saveFile(filename, blob) {
  const dl = await use('downloads');
  if (dl) {
    try { await dl.save({ filename, data: blob }); return 'saved'; }
    catch (e) { return e?.code === 'declined' ? 'declined' : 'unavailable'; }
  }
  if (inArtifact) return 'unavailable';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'saved';
}

// Native share sheet with the picture when the browser has one (phones, outside the artifact).
export async function shareFiles({ title, text, url, files = [] }) {
  if (inArtifact || !navigator.share) return false;
  const data = { title, text, url };
  if (files.length && navigator.canShare?.({ files })) data.files = files;
  try { await navigator.share(data); return true; } catch (e) { return e?.name === 'AbortError'; }
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }
}

export function lineShareLink(url, text) {
  return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

// --- storing the finished conversation ------------------------------------------------------------
// One record per finished chat: its id (= the whole conversation), the short serial on the badge,
// which topics came up, and when. In production the Supabase table enforces that each id is unique.
export async function recordChat(rec) {
  const row = { id: rec.id, serial: rec.serial, topics: rec.topics, script: rec.script, finished_at: new Date().toISOString() };
  try {
    if (CONFIG.supabaseUrl && !inArtifact) {
      const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/chats`, {
        method: 'POST',
        headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${CONFIG.supabaseAnonKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(row),
      });
      return r.ok ? 'supabase' : 'error';
    }
    const db = await use('db');
    if (db) { await db.collection('chats').doc(rec.serial.replace(/-/g, '')).set(row); return 'artifact-db'; }
  } catch (e) { console.warn('record', e); }
  try { localStorage.setItem('hl:lastChat', JSON.stringify(row)); return 'local'; } catch (e) { return 'none'; }
}

// Upload the share picture so the link preview (og:image) can show it. Production only.
export async function uploadShareImage(serial, blob) {
  if (!CONFIG.supabaseUrl || inArtifact) return null;
  const path = `og/${serial}.png`;
  const r = await fetch(`${CONFIG.supabaseUrl}/storage/v1/object/${path}`, {
    method: 'POST',
    headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${CONFIG.supabaseAnonKey}`, 'Content-Type': 'image/png', 'x-upsert': 'false' },
    body: blob,
  }).catch(() => null);
  return r && (r.ok || r.status === 409) ? `${CONFIG.supabaseUrl}/storage/v1/object/public/${path}` : null;
}
