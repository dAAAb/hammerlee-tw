// Google Analytics 4, on the public site only (never inside the claude.ai artifact or on a dev machine).
// It counts visits and what people do — how far they chat, which topics they reach, whether they share —
// with Google signals and ad personalisation off, and stops the moment someone turns it off in 設定.
// `?ga-dry` sets up the queue on any host without loading Google's script, to check events locally.
import { CONFIG, onPublicSite } from '../config.js';

let on = false;
const off = () => !!window[`ga-disable-${CONFIG.gaId}`];

export function initAnalytics(allowed, { dry = false } = {}) {
  const id = CONFIG.gaId;
  if (on || !id || !allowed || !(onPublicSite || dry)) return;
  on = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  // the #c-… replay id and a ?pair= room code stay out of page URLs; arriving from a friend's link is its own event
  const page = new URL(location.href);
  page.hash = '';
  page.searchParams.delete('pair');
  window.gtag('config', id, {
    page_location: page.href,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  if (dry) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.append(s);
}

// turning it off in 設定 stops sending right away; turning it back on starts (or resumes) it
export function setAnalytics(allowed) {
  if (!CONFIG.gaId) return;
  window[`ga-disable-${CONFIG.gaId}`] = !allowed;
  if (allowed) initAnalytics(true);
}

export function track(name, params = {}) {
  if (on && !off()) window.gtag('event', name, params);
}

// for a tap that reloads the page: give the event a moment to leave first
export function trackThen(name, params, done) {
  if (!on || off()) return done();
  let called = false;
  const go = () => { if (!called) { called = true; done(); } };
  window.gtag('event', name, { ...params, event_callback: go });
  setTimeout(go, 800);
}
