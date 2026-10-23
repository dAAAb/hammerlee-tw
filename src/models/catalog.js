// What the script can ask for. Model files implement these ids; the script (src/chat/content/*) only uses
// ids listed here, and tools/charset.mjs collects every text below into the font subset.

// Inline 3D emoji, written [name] in message text. Each is a chunky little object lying on the bubble.
export const EMOJI = [
  'heart', 'sparkle', 'smile', 'laugh', 'thumb', 'star', 'party', 'flower', 'sun', 'train', 'hospital', 'house',
  'chip', 'ball', 'bridge', 'bottle', 'dog', 'cat', 'tooth', 'gift', 'check', 'hammer', 'helmet', 'clock',
  'mountain', 'wave', 'game', 'balloon', 'pineapple', 'tea', 'coin', 'bike', 'book', 'drone', 'cake', 'muscle',
  'clap', 'rainbow', 'bus', 'pray',
];

// Stickers: a big 3D figure + a text plate. who = 'chuan' (mini 川哥 in a pose) or 'me' (the citizen mascot 小新).
export const STICKERS = {
  c_thumb:  { who: 'chuan', text: '讚啦！',   pose: 'thumbsUp' },
  c_fist:   { who: 'chuan', text: '拚了！',   pose: 'fistPump' },
  c_heart:  { who: 'chuan', text: '愛你喔',   pose: 'fingerHeart' },
  c_ok:     { who: 'chuan', text: '沒問題',   pose: 'okSign' },
  c_hammer: { who: 'chuan', text: '交給我！', pose: 'hammerUp' },
  c_bow:    { who: 'chuan', text: '感恩',     pose: 'bow' },
  c_salute: { who: 'chuan', text: '收到！',   pose: 'salute' },
  c_hello:  { who: 'chuan', text: '哈囉～',   pose: 'wave' },
  c_bye:    { who: 'chuan', text: '掰掰～',   pose: 'wave' },
  c_shovel: { who: 'chuan', text: '開工囉！', pose: 'shovelDig' },
  c_think:  { who: 'chuan', text: '說實在…', pose: 'think' },
  c_run:    { who: 'chuan', text: '馬上辦！', pose: 'run' },
  c_cheer:  { who: 'chuan', text: '加油！',   pose: 'cheer' },
  c_thanks: { who: 'chuan', text: '辛苦了',   pose: 'bow' },
  c_vote:   { who: 'chuan', text: '11/28 見！', pose: 'wave' },
  m_wow:    { who: 'me', text: '哇～' },
  m_love:   { who: 'me', text: '好期待！' },
  m_clap:   { who: 'me', text: '拍拍手' },
  m_thumb:  { who: 'me', text: '讚！' },
  m_tea:    { who: 'me', text: '呷茶～' },
  m_flower: { who: 'me', text: '送你花' },
  m_laugh:  { who: 'me', text: '哈哈哈' },
  m_ok:     { who: 'me', text: 'OK 啦' },
  m_cheer:  { who: 'me', text: '川伯加油！' },
  m_moved:  { who: 'me', text: '好感動' },
};

// Poses the mini 川哥 rig must support (stickers use a pose; the running mascot uses the motions).
export const POSES = ['idle', 'wave', 'thumbsUp', 'fistPump', 'fingerHeart', 'okSign', 'hammerUp', 'bow', 'salute',
  'shovelDig', 'think', 'run', 'cheer'];
export const MOTIONS = ['walk', 'run', 'trip', 'jump', 'idle'];
