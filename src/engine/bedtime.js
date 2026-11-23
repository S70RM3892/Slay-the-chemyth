// Sleep guard (睡眠ガード): warn between bedtime (default 23:00) and wake time (05:00).

export const BEDTIME_MESSAGE = '寝ろ。記憶の定着は睡眠中に起こる。進行は自動保存済み。';

/** 'HH:MM' -> minutes after midnight (NaN if invalid). */
export function parseHHMM(s) {
  const m = /^\s*(\d{1,2})[:：](\d{2})\s*$/.exec(String(s ?? ''));
  if (!m) return NaN;
  const h = Number(m[1]); const mi = Number(m[2]);
  if (h > 24 || mi > 59) return NaN;
  return (h % 24) * 60 + mi;
}

/**
 * Should the bedtime banner be shown at `date` (local time)?
 * The window is [bedtime, wakeTime) and wraps midnight when bedtime > wakeTime.
 */
export function isBedtime(date, bedtime = '23:00', wakeTime = '05:00') {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  let b = parseHHMM(bedtime); let w = parseHHMM(wakeTime);
  if (Number.isNaN(b)) b = 23 * 60;
  if (Number.isNaN(w)) w = 5 * 60;
  const t = d.getHours() * 60 + d.getMinutes();
  if (b === w) return false;
  return b < w ? t >= b && t < w : t >= b || t < w;
}

/** Convenience: returns the message or null. settings = meta.settings */
export function bedtimeWarning(date, settings = {}) {
  return isBedtime(date, settings.bedtime, settings.wakeTime) ? BEDTIME_MESSAGE : null;
}
