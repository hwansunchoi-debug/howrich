// 서버(Edge Function)에서 한국 시간 라벨을 만들기 위한 헬퍼.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 해당 시각이 속한 "정시" 버킷의 시작 시각 */
export function hourBucket(date: Date): Date {
  const bucket = new Date(date.getTime());
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}

/** 2026-08-29T05:00:00Z -> "8월 29일 오후 2시" (KST) */
export function kstLabel(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hour24 = kst.getUTCHours();
  const meridiem = hour24 < 12 ? "오전" : "오후";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${month}월 ${day}일 ${meridiem} ${hour12}시`;
}
