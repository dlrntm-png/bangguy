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
