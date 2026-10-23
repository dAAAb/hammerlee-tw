// The short number printed on the 新北事民 badge: a 64-bit hash of the conversation id, as XXXX-XXXX-XXXX-XXXX.
// Kept apart from the badge model so the link-preview function can compute it without three.js.
import { hashString } from './dsl.js';

export function shortId(id) {
  const [a, b] = hashString('serial:' + id);
  const hex = (a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')).toUpperCase();
  return hex.match(/.{4}/g).join('-');
}
