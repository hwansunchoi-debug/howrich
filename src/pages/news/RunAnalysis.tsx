import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import {
  fetchPipelineStatus,
  fetchUsageSummary,
  runPipeline,
  type RunResult,
} from "@/services/newsService";
import { formatRelative } from "@/lib/newsTime";

const KEY_STORAGE = "news:admin-key";

function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export default function RunAnalysis() {
  const [adminKey, setAdminKey] = useState(readKey);
  const [result, setResult] = useState<RunResult | null>(null);
  const queryClient = useQueryClient();

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["news", "pipeline-status"],
    queryFn: fetchPipelineStatus,
    refetchInterval: 60_000,
  });

  const { data: usage, refetch: refetchUsage } = useQuery({
    queryKey: ["news", "ai-usage"],
    queryFn: fetchUsageSummary,
    refetchInterval: 60_000,
  });

  const run = useMutation({
    mutationFn: () => runPipeline(adminKey.trim()),
    onSuccess: (data) => {
      setResult(data);
      try {
        localStorage.setItem(KEY_STORAGE, adminKey.trim());
      } catch {
        /* 저장이 막혀 있어도 이번 실행은 정상이다 */
      }
      refetchStatus();
      refetchUsage();
      queryClient.invalidateQueries({ queryKey: ["news", "issues"] });
    },
  });

  const cluster = result?.steps?.cluster;
  const timeline = result?.steps?.timeline;

  // 달러를 원화로 어림잡아 보여준다. 정확한 청구액은 Anthropic 콘솔 기준이다.
  const USD_TO_KRW = 1400;
  const won = (usd: number) => Math.round(usd * USD_TO_KRW).toLocaleString("ko-KR");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link
            to="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
            aria-label="이슈 목록으로"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="truncate text-sm font-medium text-muted-foreground">
            AI 분석 실행
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          지금 분석하기
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          기사 수집은 15분마다 자동으로 돕니다. 요금이 드는 것은 AI가 기사를 이슈로
          묶고 시간대별 요약을 만드는 단계뿐이라, 이 버튼을 누를 때만 실행합니다.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">분석 대기 중인 기사</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {status ? status.pendingArticles : "–"}
              <span className="ml-1 text-sm font-normal text-muted-foreground">건</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">마지막 분석</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {status?.lastAnalyzedAt ? formatRelative(status.lastAnalyzedAt) : "없음"}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label
            htmlFor="admin-key"
            className="text-sm font-medium text-foreground"
          >
            관리자 열쇠
          </label>
          <input
            id="admin-key"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="설정해 둔 열쇠를 입력하세요"
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            한 번 입력하면 이 브라우저에 저장됩니다. 다른 사람이 요금을 발생시키지
            못하게 막는 용도입니다.
          </p>
        </div>

        <button
          type="button"
          disabled={!adminKey.trim() || run.isPending}
          onClick={() => {
            setResult(null);
            run.mutate();
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {run.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              분석 중… 1~2분 걸립니다
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              지금 분석하기
            </>
          )}
        </button>

        {run.isError && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-foreground">
              {run.error instanceof Error ? run.error.message : "실행에 실패했습니다."}
            </p>
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Check className="h-4 w-4 text-success" />
              분석 완료
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>기사 {cluster?.processed ?? 0}건 분석</li>
              <li>새 이슈 {cluster?.created ?? 0}개 생성</li>
              <li>기존 이슈에 {cluster?.assigned ?? 0}건 추가</li>
              <li>시간대 요약 {timeline?.eventsWritten ?? 0}개 작성</li>
            </ul>

            {result.usage && result.usage.calls > 0 && (
              <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs">
                <p className="font-medium text-foreground">이번 실행에 쓴 AI</p>
                <p className="mt-1 text-muted-foreground">
                  AI 호출 {result.usage.calls}회 · 입력{" "}
                  {result.usage.inputTokens.toLocaleString("ko-KR")} 토큰 · 출력{" "}
                  {result.usage.outputTokens.toLocaleString("ko-KR")} 토큰
                </p>
                <p className="mt-1 font-medium text-foreground">
                  약 {won(result.usage.costUsd)}원 (${result.usage.costUsd.toFixed(4)})
                </p>
              </div>
            )}
            {result.errors && result.errors.length > 0 && (
              <p className="mt-3 text-xs text-destructive">
                일부 단계 실패: {result.errors.join(" / ")}
              </p>
            )}
            <Link
              to="/"
              className="mt-4 inline-block text-sm font-medium text-primary underline"
            >
              이슈 목록 보기
            </Link>
          </div>
        )}

        {usage && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">AI 사용량</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">최근 24시간</p>
                <p className="mt-0.5 text-lg font-bold text-foreground">
                  약 {won(usage.dayCostUsd)}원
                </p>
                <p className="text-xs text-muted-foreground">
                  {(usage.dayInputTokens + usage.dayOutputTokens).toLocaleString("ko-KR")}{" "}
                  토큰
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">이번 달</p>
                <p className="mt-0.5 text-lg font-bold text-foreground">
                  약 {won(usage.monthCostUsd)}원
                </p>
                <p className="text-xs text-muted-foreground">
                  {(usage.monthInputTokens + usage.monthOutputTokens).toLocaleString(
                    "ko-KR",
                  )}{" "}
                  토큰
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              공개된 요금표로 계산한 어림값입니다. 1달러를 {USD_TO_KRW.toLocaleString("ko-KR")}
              원으로 환산했습니다. 실제 청구액은 Anthropic 콘솔에서 확인하세요.
            </p>
          </div>
        )}

        {status && status.pendingArticles > 200 && (
          <p className="mt-4 text-xs text-muted-foreground">
            대기 기사가 200건을 넘습니다. 한 번에 200건씩 처리하니, 다 비우려면
            버튼을 여러 번 눌러주세요.
          </p>
        )}
      </main>
    </div>
  );
}
