export function getKoreaISOString() {
  const now = new Date();
  const koreaString = now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
  const koreaDate = new Date(koreaString);
  return koreaDate.toISOString();
}
