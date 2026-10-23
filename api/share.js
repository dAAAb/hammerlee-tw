// Vercel Edge Function behind /s/<id>: link previews (LINE, Facebook, iMessage) read the og: tags here, people
// are sent straight on to the chat replaying that conversation. The preview picture is the share card the
// page uploaded to Supabase Storage when it was shared; until it exists, the campaign's default picture.
export const config = { runtime: 'edge' };

import { CONFIG } from '../src/config.js';

// the anon key is public by design (row-level security guards the table); env vars can override for staging
const SITE = process.env.PUBLIC_URL || CONFIG.publicUrl;
const SUPABASE_URL = process.env.SUPABASE_URL || CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || CONFIG.supabaseAnonKey;
const FALLBACK_IMAGE = process.env.FALLBACK_OG || `${SITE}og-default.png`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async function handler(req) {
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').toUpperCase();
  if (!/^[0-9A-F]{8,80}$/.test(id)) return Response.redirect(SITE, 302);
  let image = FALLBACK_IMAGE, serial = '';
  if (SUPABASE_URL) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/chats?id=eq.${id}&select=serial,og_image`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    }).catch(() => null);
    const row = r && r.ok ? (await r.json())[0] : null;
    if (row) { serial = row.serial; if (row.og_image) image = row.og_image; }
  }
  const target = `${SITE}#c-${id}`;
  const title = '我跟未來新北市長李四川的對話';
  const desc = serial ? `新北事民徽章 No. ${serial} ・ 邀請你也來跟川伯聊天` : '邀請你也來跟川伯聊天，每個人的對話都不一樣';
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(url.href)}"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body><a href="${esc(target)}">${esc(title)}</a><script>location.replace(${JSON.stringify(target)})</script></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
