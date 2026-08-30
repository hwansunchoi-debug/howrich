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

/** 한 번 누르면 이만큼까지 이어서 돌린다. 요금이 무한정 나가지 않도록 막는다. */
const MAX_ROUNDS = 8;

export default function RunAnalysis() {
  const [adminKey, setAdminKey] = useState(readKey);
  const [result, setResult] = useState<RunResult | null>(null);
  const [progress, setProgress] = useState<{ round: number; done: boolean } | null>(
    null,
  );
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

  /**
   * 밀린 기사가 남아 있으면 비워질 때까지 이어서 돌린다.
   * 한 번의 실행으로 처리할 수 있는 양이 정해져 있어, 며칠 만에 분석하면
   * 여러 번 눌러야 했다.
   */
  const run = useMutation({
    mutationFn: async () => {
      const key = adminKey.trim();
      const totals: RunResult = {
        ok: true,
        steps: { cluster: {}, timeline: {} },
        usage: { calls: 0, inputTokens: 0, outputTokens: 0, model: "", costUsd: 0 },
        errors: [],
      };

      for (let round = 1; round <= MAX_ROUNDS; round++) {
        setProgress({ round, done: false });
        const data = await runPipeline(key);

        // 회차별 결과를 합친다.
        const cluster = data.steps?.cluster ?? {};
        const timeline = data.steps?.timeline ?? {};
        totals.steps!.cluster = {
          processed: (totals.steps!.cluster?.processed ?? 0) + (cluster.processed ?? 0),
          tooOld: (totals.steps!.cluster?.tooOld ?? 0) + (cluster.tooOld ?? 0),
          assigned: (totals.steps!.cluster?.assigned ?? 0) + (cluster.assigned ?? 0),
          created: (totals.steps!.cluster?.created ?? 0) + (cluster.created ?? 0),
          skipped: (totals.steps!.cluster?.skipped ?? 0) + (cluster.skipped ?? 0),
        };
        totals.steps!.timeline = {
          issuesUpdated:
            (totals.steps!.timeline?.issuesUpdated ?? 0) + (timeline.issuesUpdated ?? 0),
          eventsWritten:
            (totals.steps!.timeline?.eventsWritten ?? 0) + (timeline.eventsWritten ?? 0),
        };
        if (data.usage) {
          totals.usage = {
            calls: totals.usage!.calls + data.usage.calls,
            inputTokens: totals.usage!.inputTokens + data.usage.inputTokens,
            outputTokens: totals.usage!.outputTokens + data.usage.outputTokens,
            model: data.usage.model,
            costUsd: Number((totals.usage!.costUsd + data.usage.costUsd).toFixed(6)),
          };
        }
        totals.errors = [...(totals.errors ?? []), ...(data.errors ?? [])];
        totals.ok = totals.ok && data.ok;

        setResult({ ...totals });

        // 더 분석할 기사가 없으면 멈춘다.
        const remaining = await fetchPipelineStatus();
        if (remaining.pendingArticles === 0) break;
      }

      setProgress((current) => (current ? { ...current, done: true } : null));
      return totals;
    },
    onSuccess: () => {
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
            setProgress(null);
            run.mutate();
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {run.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              분석 중… {progress ? `${progress.round}회차` : ""} (밀린 기사가 많으면
              여러 번 이어서 돕니다)
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
              {Boolean(cluster?.tooOld) && (
                <li>오래된 기사 {cluster?.tooOld}건은 건너뜀 (48시간 지남)</li>
              )}
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

        {status && status.pendingArticles > 0 && !run.isPending && (
          <p className="mt-4 text-xs text-muted-foreground">
            버튼을 한 번 누르면 대기 기사가 없어질 때까지 이어서 돕니다.
            요금이 한꺼번에 나가지 않도록 최대 {MAX_ROUNDS}회까지만 돌고 멈춥니다.
            48시간이 지난 기사는 분석하지 않고 대기열에서 뺍니다.
          </p>
        )}
      </main>
    </div>
  );
}
