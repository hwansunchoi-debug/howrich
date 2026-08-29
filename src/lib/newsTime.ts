// 서비스는 대한민국 뉴스를 다루므로, 사용자의 기기 시간대와 무관하게
// 항상 한국 시간(KST) 기준으로 표시한다.
const KST = "Asia/Seoul";

const hourFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  hour: "numeric",
  hour12: true,
});

const dayFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  month: "long",
  day: "numeric",
});

const clockFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** KST 기준 날짜 문자열 (YYYY-MM-DD) - 날짜가 바뀌었는지 비교할 때 사용 */
export function kstDateKey(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KST }).format(toDate(value));
}

/** "오후 2시" */
export function formatHour(value: string | Date): string {
  return hourFormatter.format(toDate(value));
}

/** "8월 29일" */
export function formatDay(value: string | Date): string {
  return dayFormatter.format(toDate(value));
}

/** "14:32" */
export function formatClock(value: string | Date): string {
  return clockFormatter.format(toDate(value));
}

/** "8월 29일 16:32" — 오늘이면 "오늘 16:32" */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = toDate(value);
  const isToday = kstDateKey(date) === kstDateKey(new Date());
  return isToday
    ? `오늘 ${formatClock(date)}`
    : `${formatDay(date)} ${formatClock(date)}`;
}

/** "2026년 8월 29일 16:32" — 화면 상단의 기준 시각처럼 정확히 보여줄 때 */
export function formatFullDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = toDate(value);
  const stamp = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  return `${stamp} ${formatClock(date)}`;
}

/** 오늘이면 "오후 2시", 아니면 "8월 28일 오후 2시" */
export function formatHourWithDay(value: string | Date): string {
  const date = toDate(value);
  const isToday = kstDateKey(date) === kstDateKey(new Date());
  return isToday ? formatHour(date) : `${formatDay(date)} ${formatHour(date)}`;
}

/** "방금 전", "12분 전", "3시간 전", "2일 전" */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = toDate(value);
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 0) return "방금 전";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;

  return formatDay(date);
}

/** 시간대 버킷의 시작 시각(정시) ISO 문자열 */
export function hourBucketKey(value: string | Date): string {
  const date = toDate(value);
  const bucket = new Date(date.getTime());
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}
