import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTopIssues, splitIssuesByCoverage } from "@/services/newsService";
import { formatRelative } from "@/lib/newsTime";
import { issueEmoji } from "@/lib/issueEmoji";
import { SCORE_PARTS, scoreBreakdown } from "@/lib/issueScore";

export default function ScoreGuide() {
  const [showTable, setShowTable] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["news", "issues"],
    queryFn: () => fetchTopIssues(60),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const rows = splitIssuesByCoverage(data ?? [])
    .confirmed.slice(0, 20)
    .map((issue) => ({
    issue,
      parts: scoreBreakdown(issue),
    }));

  // 막대 길이는 가장 높은 점수를 기준으로 맞춘다.
  const maxTotal = Math.max(
    1,
    ...rows.map((row) => row.parts.volume + row.parts.velocity + row.parts.freshness),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link
            to="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
            aria-label="이슈 목록으로"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="truncate text-sm font-medium text-muted-foreground">
            이슈 점수 설명
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          이슈 점수는 이렇게 정합니다
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          세 가지를 더해서 순위를 매깁니다. 많이 보도됐는지, 지금 갑자기 늘고 있는지,
          소식이 얼마나 최근인지입니다.
        </p>

        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
          <h2 className="text-sm font-semibold text-foreground">
            무엇을 이슈로 보나요
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            <b className="font-medium text-foreground/80">
              서로 다른 언론사 2곳 이상이 다룬 사건
            </b>
            만 목록에 올립니다. 한 곳이 단발로 쓴 기사는 &ldquo;관찰 중&rdquo;으로
            두고, 다른 언론사가 받아쓰면 그때 목록에 들어옵니다.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            AI 도 기사를 묶을 때 광고·부고·인사·시황·행사 안내·개별 기업 홍보·연예
            가십·칼럼처럼 사건이 아닌 글은 제외합니다.
          </p>
        </div>

        {/* 세 가지 요소 설명 */}
        <div className="mt-5 space-y-3">
          {SCORE_PARTS.map((part) => (
            <div key={part.key} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ background: part.color }}
                  aria-hidden
                />
                <h2 className="text-sm font-semibold text-foreground">{part.label}</h2>
                <span className="text-xs text-muted-foreground">· {part.short}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {part.detail}
              </p>
            </div>
          ))}
        </div>

        {/* 지금 순위 */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            지금 순위와 점수 구성
          </h2>
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            {showTable ? "막대로 보기" : "표로 보기"}
          </button>
        </div>

        {/* 범례 */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {SCORE_PARTS.map((part) => (
            <span key={part.key} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: part.color }}
                aria-hidden
              />
              {part.label}
            </span>
          ))}
        </div>

        {isLoading && (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-foreground">
              {error instanceof Error ? error.message : "이슈를 불러오지 못했습니다."}
            </p>
          </div>
        )}

        {!isLoading && !isError && showTable && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">이슈</th>
                  <th className="px-3 py-2 text-right font-medium">기사량</th>
                  <th className="px-3 py-2 text-right font-medium">증가속도</th>
                  <th className="px-3 py-2 text-right font-medium">최신성</th>
                  <th className="px-3 py-2 text-right font-medium">합계</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ issue, parts }, index) => (
                  <tr key={issue.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground">{index + 1}. </span>
                      {issue.title}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {parts.volume.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {parts.velocity.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {parts.freshness.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {parts.total.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !isError && !showTable && (
          <ol className="mt-4 space-y-3">
            {rows.map(({ issue, parts }, index) => {
              const positives = [
                { ...SCORE_PARTS[0], value: parts.volume },
                { ...SCORE_PARTS[1], value: Math.max(0, parts.velocity) },
                { ...SCORE_PARTS[2], value: parts.freshness },
              ].filter((part) => part.value > 0.05);

              return (
                <li
                  key={issue.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to={`/issue/${issue.id}`}
                      className="min-w-0 flex-1 text-sm font-medium text-foreground hover:underline"
                    >
                      <span className="tabular-nums text-muted-foreground">
                        {index + 1}.
                      </span>{" "}
                      <span aria-hidden>{issueEmoji(issue)}</span> {issue.title}
                    </Link>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                      {parts.total.toFixed(1)}
                    </span>
                  </div>

                  {/* 누적 막대 */}
                  <div className="mt-2.5 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
                    {positives.map((part) => (
                      <span
                        key={part.key}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        style={{
                          background: part.color,
                          width: `${(part.value / maxTotal) * 100}%`,
                        }}
                        title={`${part.label} ${part.value.toFixed(1)}점`}
                      />
                    ))}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {SCORE_PARTS.map((part) => (
                      <span key={part.key} className="inline-flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ background: part.color }}
                          aria-hidden
                        />
                        {part.label}{" "}
                        <span className="tabular-nums text-foreground/80">
                          {parts[part.key].toFixed(1)}
                        </span>
                      </span>
                    ))}
                  </div>

                  <p className="mt-1.5 text-xs text-muted-foreground">
                    최근 24시간 {issue.recent_article_count}건 · 최근 1시간{" "}
                    {issue.last_hour_count}건 · 직전 1시간 {issue.prev_hour_count}건 ·{" "}
                    {formatRelative(issue.last_article_at)} 업데이트
                    {parts.velocity < 0 && " · 기사가 줄어 증가속도가 마이너스입니다"}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
          점수는 기사를 수집할 때마다(15분 간격) 다시 계산합니다.
          <br />
          화면에 보이는 값은 지금 시각 기준으로 다시 계산한 것이라, 저장된 점수와
          소수점이 조금 다를 수 있습니다.
        </p>
      </main>
    </div>
  );
}
