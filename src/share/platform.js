// Where the page runs decides how saving, sharing and storing work:
//  - inside a claude.ai Artifact: saves go through the `downloads` capability, records through `db`
//    (the sandbox blocks other hosts, so Supabase is not reachable from there);
//  - on its own site (production): Web Share with the picture, plain downloads, and Supabase.
import { CONFIG, onPublicSite } from '../config.js';

export const inArtifact = typeof window !== 'undefined' && !!window.claude?.use;
const use = name => (inArtifact ? window.claude.use(name).catch(() => null) : Promise.resolve(null));

// On the public site a link goes through /s/<id> so LINE and Facebook show the share card as its preview;
// elsewhere the id rides in the #c- anchor and the page replays it directly.
export function shareUrl(chatId) {
  if (CONFIG.publicUrl && (onPublicSite || !inArtifact)) return `${CONFIG.publicUrl.replace(/\/?$/, '/')}s/${chatId}`;
  const base = inArtifact ? CONFIG.artifactUrl : location.origin + location.pathname;
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
// which topics came up (the table stamps the time). In production the Supabase table enforces that each id is
// unique, and the public key can only add rows: it can't read, change or delete any.
export async function recordChat(rec) {
  const row = { id: rec.id, serial: rec.serial, topics: rec.topics, script: rec.script };
  try {
    if (CONFIG.supabaseUrl && onPublicSite) {
      const r = await fetch(`${CONFIG.supabaseUrl}/rest/v1/chats`, {
        method: 'POST',
        headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${CONFIG.supabaseAnonKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
      return r.ok ? 'supabase' : 'error';
    }
    const db = await use('db');
    if (db) { await db.collection('chats').doc(rec.serial.replace(/-/g, '')).set({ ...row, finished_at: new Date().toISOString() }); return 'artifact-db'; }
  } catch (e) { console.warn('record', e); }
  try { localStorage.setItem('hl:lastChat', JSON.stringify(row)); return 'local'; } catch (e) { return 'none'; }
}
