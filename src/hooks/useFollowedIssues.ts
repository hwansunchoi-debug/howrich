import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "news:followed-issues";

/** 브라우저에 저장된 팔로우 목록을 읽는다. 저장이 막힌 환경에서도 화면은 동작해야 한다. */
function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* 저장에 실패해도 이번 세션 동안은 정상 동작한다 */
  }
}

/**
 * 관심 이슈 팔로우.
 * 로그인 없이 이 브라우저에만 저장한다. 팔로우한 이슈는 순위가 밀려도
 * 메인 화면 맨 위에서 계속 확인할 수 있다.
 */
export function useFollowedIssues() {
  const [followedIds, setFollowedIds] = useState<string[]>(read);

  // 다른 탭에서 바꾼 내용도 반영한다.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setFollowedIds(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleFollow = useCallback((issueId: string) => {
    setFollowedIds((current) => {
      const next = current.includes(issueId)
        ? current.filter((id) => id !== issueId)
        : [issueId, ...current];
      write(next);
      return next;
    });
  }, []);

  const isFollowed = useCallback(
    (issueId: string) => followedIds.includes(issueId),
    [followedIds],
  );

  return { followedIds, toggleFollow, isFollowed };
}
