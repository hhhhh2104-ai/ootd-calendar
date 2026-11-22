// 날짜 계산과 한국식 날짜 표시

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toDateStr(parseDateStr(s)) === s;
}

// b - a (일 수)
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function addDays(s, n) {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// 2025년 1월 31일 (금)
export function formatKoreanDate(s) {
  const d = parseDateStr(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

// 1월 31일
export function formatMonthDay(s) {
  const d = parseDateStr(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ----- 월 단위 -----

export function monthKey({ y, m }) {
  return `${y}-${pad(m)}`;
}

export function parseMonthKey(k) {
  const mm = /^(\d{4})-(\d{2})$/.exec(k || '');
  if (!mm) return null;
  const y = Number(mm[1]);
  const m = Number(mm[2]);
  if (m < 1 || m > 12) return null;
  return { y, m };
}

export function currentMonth() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export function shiftMonth({ y, m }, delta) {
  const t = y * 12 + (m - 1) + delta;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}

// 26년 11월
export function formatMonthShort({ y, m }) {
  return `${String(y).slice(-2)}년 ${m}월`;
}

// 2025년 1월
export function formatMonthLong({ y, m }) {
  return `${y}년 ${m}월`;
}

// 일요일 시작 달력 칸 (빈칸은 null)
export function buildMonthCells({ y, m }) {
  const lead = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    cells.push({ date: `${y}-${pad(m)}-${pad(d)}`, day: d, weekday: (lead + d - 1) % 7 });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}
