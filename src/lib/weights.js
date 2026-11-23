// 삼성헬스 '개인 데이터 다운로드'의 몸무게 파일(com.samsung.health.weight.*.csv) 읽기
// - 1행: 파일 정보, 2행: 열 이름 (버전에 따라 앞에 com.samsung.health.weight. 이 붙을 수 있음)
// - start_time 은 UTC, time_offset(예: UTC+0900)으로 현지 날짜를 계산한다
// - 하루에 여러 번 잰 날(대부분 블루투스 재시도)은 그날 첫 측정값만 쓴다

function splitCsv(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const pad = (n) => String(n).padStart(2, '0');

// 결과: { 'YYYY-MM-DD': { kg, time: 'HH:MM' } }
export function parseSamsungWeightCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const clean = (h) => h.trim().replace(/^com\.samsung\.health\.weight\./, '');
  const hi = lines.findIndex((l) => {
    const cols = splitCsv(l).map(clean);
    return cols.includes('weight') && cols.includes('start_time');
  });
  if (hi < 0) throw new Error('삼성헬스 몸무게 파일이 아니에요 (weight 가 들어간 파일을 골라 주세요)');
  const header = splitCsv(lines[hi]).map(clean);
  const iw = header.indexOf('weight');
  const it = header.indexOf('start_time');
  const io = header.indexOf('time_offset');

  const byDay = {};
  for (const line of lines.slice(hi + 1)) {
    const r = splitCsv(line);
    const kg = parseFloat(r[iw]);
    const ts = r[it];
    if (!(kg > 0) || !ts) continue;
    const m = /UTC([+-])(\d{2})(\d{2})/.exec(io >= 0 ? r[io] || '' : '');
    const offMin = m ? (m[1] === '+' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3])) : 540;
    const utc = Date.parse(ts.trim().replace(' ', 'T') + 'Z');
    if (Number.isNaN(utc)) continue;
    const t = new Date(utc + offMin * 60000);
    const date = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
    const time = `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
    const cur = byDay[date];
    if (!cur || time < cur.time) byDay[date] = { kg: Math.round(kg * 10) / 10, time };
  }
  return byDay;
}

// 기존 기록에 합친다. 직접 입력한 값은 덮어쓰지 않는다. 결과: { added, updated }
export function mergeWeights(existing, imported) {
  let added = 0;
  let updated = 0;
  for (const [date, v] of Object.entries(imported)) {
    const e = existing[date];
    if (!e) {
      existing[date] = { ...v, source: 'samsung' };
      added++;
    } else if (e.source !== 'manual' && (!e.time || v.time < e.time || (v.time === e.time && v.kg !== e.kg))) {
      existing[date] = { ...v, source: 'samsung' };
      updated++;
    }
  }
  return { added, updated };
}
