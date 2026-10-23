// Voting day is 2026-11-28. Campaigning isn't allowed on voting day, so on that day (Taiwan time) the page pauses
// and share links stop inviting people to chat; from the next day on, the page says thank you first and the chat
// can still be looked back on. Used by the page (src/main.js) and the link previews (api/share.js).
export const VOTING_DAY = '2026-11-28';
const TW = 8 * 3600e3;                                   // Taiwan is UTC+8 all year
const DAY_START = Date.parse(`${VOTING_DAY}T00:00:00+08:00`);
const DAY_END = DAY_START + 24 * 3600e3;

// 'campaign' before voting day, 'vote' on it, 'after' from the next day
export function phaseAt(ms = Date.now()) {
  const day = new Date(ms + TW).toISOString().slice(0, 10);
  return day < VOTING_DAY ? 'campaign' : day === VOTING_DAY ? 'vote' : 'after';
}

// seconds until the phase can next change (for how long a page may be cached)
export function secondsToNextPhase(ms = Date.now()) {
  const next = ms < DAY_START ? DAY_START : ms < DAY_END ? DAY_END : Infinity;
  return Math.max(0, Math.floor((next - ms) / 1000));
}
