const KST_OFFSET_HOURS = 9;
const MS_PER_HOUR = 60 * 60 * 1000;

export function getKoreaDate() {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcTime + KST_OFFSET_HOURS * MS_PER_HOUR);
}

export function getKoreaISOString() {
  const koreaDate = getKoreaDate();
  return koreaDate.toISOString().replace('Z', '+09:00');
}

export function getNextMonthStartKstISO(baseISO) {
  const base = baseISO ? new Date(baseISO) : new Date();
  const baseInKst = new Date(base.getTime() + KST_OFFSET_HOURS * MS_PER_HOUR);
  const year = baseInKst.getUTCFullYear();
  const month = baseInKst.getUTCMonth();
  const nextMonthUtc = Date.UTC(year, month + 1, 1, -KST_OFFSET_HOURS, 0, 0);
  const nextDate = new Date(nextMonthUtc);
  return nextDate.toISOString();
}

export function getPreviousMonthPeriodKst(baseISO) {
  const base = baseISO ? new Date(baseISO) : new Date();
  const baseInKst = new Date(base.getTime() + KST_OFFSET_HOURS * MS_PER_HOUR);
  const currentYear = baseInKst.getUTCFullYear();
  const currentMonthIdx = baseInKst.getUTCMonth(); // 0-based

  const prevMonthIdx = currentMonthIdx - 1;
  const prevYear = prevMonthIdx < 0 ? currentYear - 1 : currentYear;
  const normalizedPrevIdx = (prevMonthIdx + 12) % 12;

  const periodStartUtc = Date.UTC(prevYear, normalizedPrevIdx, 1, -KST_OFFSET_HOURS, 0, 0);
  const periodEndUtc = Date.UTC(currentYear, currentMonthIdx, 1, -KST_OFFSET_HOURS, 0, 0);

  const start = new Date(periodStartUtc).toISOString();
  const end = new Date(periodEndUtc).toISOString();
  const label = `${prevYear}-${String(normalizedPrevIdx + 1).padStart(2, '0')}`;

  return {
    start,
    end,
    label
  };
}