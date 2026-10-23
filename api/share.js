// Vercel Edge Function behind /s/<id>: link previews (LINE, Facebook, iMessage) read the og: tags here, people
// are sent straight on to the chat replaying that conversation. Everything on the page comes from the id itself
// (the badge number and the topics are decoded from it), so nothing anyone uploads can ever appear under the
// campaign's name. The preview picture is the site's own default picture.
export const config = { runtime: 'edge' };

import { CONFIG } from '../src/config.js';
import { replayChat } from '../src/chat/generate.js';
import { shortId } from '../src/chat/serial.js';
import { NVIDIA, PAST, FUTURE_A, FUTURE_B } from '../src/chat/script.js';
import { phaseAt, secondsToNextPhase } from '../src/chat/calendar.js';

const SITE = CONFIG.publicUrl;
const IMAGE = `${SITE}og-default.png`;
const TITLES = Object.fromEntries([NVIDIA, ...PAST, ...FUTURE_A, ...FUTURE_B].map(t => [t.id, t.title]));
const FUTURE = new Set([...FUTURE_A, ...FUTURE_B].map(t => t.id));

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async function handler(req) {
  const id = (new URL(req.url).searchParams.get('id') || '').toUpperCase();
  let chat = null;
  if (/^[0-9A-F]{8,80}$/.test(id)) { try { chat = replayChat(id); } catch (e) { chat = null; } }
  // only the one canonical spelling of each conversation gets a page (other spellings decode to the same chat)
  if (!chat || chat.id !== id) return Response.redirect(SITE, 302);
  const serial = shortId(id);
  const plans = chat.topics.filter(t => FUTURE.has(t)).map(t => TITLES[t]).filter(Boolean);
  // voting day: no invitation and no pitch, just the paused page; afterwards a thank-you, and the chat stays viewable
  const phase = phaseAt();
  const target = phase === 'vote' ? SITE : `${SITE}#c-${id}`;
  const title = phase === 'campaign' ? '我跟新北市長候選人李四川的對話' : '跟川伯聊天';
  const desc = phase === 'campaign'
    ? `新北事民徽章 No. ${serial}・聊到${plans.slice(0, 3).join('、')}${plans.length > 3 ? '…' : ''}。邀請你也來跟川伯聊天`
    : phase === 'vote' ? '今天是投票日，這個網頁暫停一天。' : '謝謝你陪川伯聊天。';
  // a cached copy must never outlive the day it was made for
  const keep = Math.min(604800, secondsToNextPhase());
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(IMAGE)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(`${SITE}s/${id}`)}"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body><a href="${esc(target)}">${esc(title)}</a><script>location.replace(${JSON.stringify(target)})</script></body></html>`;
  return new Response(html, { headers: {
    'content-type': 'text/html; charset=utf-8',
    // the page depends only on the id, so the CDN can keep it
    'cache-control': `public, max-age=${Math.min(3600, keep)}, s-maxage=${keep}`,
    'x-robots-tag': 'noindex',
  } });
}
