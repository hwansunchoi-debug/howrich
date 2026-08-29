import Anthropic from "npm:@anthropic-ai/sdk@0.122.0";

const DEFAULT_MODEL = "claude-opus-5";
const DEFAULT_EFFORT = "low";

/**
 * 뉴스 분류/요약은 짧은 입력과 짧은 출력을 반복하는 작업이라
 * 기본 effort 를 low 로 두고, 품질을 더 올리고 싶으면
 * NEWS_AI_EFFORT=medium|high 로 바꾸면 된다.
 */
function effort(): "low" | "medium" | "high" | "xhigh" | "max" {
  const value = (Deno.env.get("NEWS_AI_EFFORT") ?? DEFAULT_EFFORT).toLowerCase();
  const allowed = ["low", "medium", "high", "xhigh", "max"] as const;
  return (allowed as readonly string[]).includes(value)
    ? (value as "low" | "medium" | "high" | "xhigh" | "max")
    : DEFAULT_EFFORT;
}

/**
 * effort 를 받는 모델과 그렇지 않은 모델이 있다.
 * Haiku 4.5 처럼 지원하지 않는 모델에 effort 를 보내면 요청이 거부되므로,
 * 지원하는 모델에만 붙인다.
 */
function supportsEffort(modelId: string): boolean {
  return /(fable-5|mythos-5|opus-5|opus-4-8|opus-4-7|opus-4-6|sonnet-5|sonnet-4-6)/.test(
    modelId,
  );
}

function model(): string {
  return Deno.env.get("NEWS_AI_MODEL") ?? DEFAULT_MODEL;
}

export function hasAnthropicKey(): boolean {
  return Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
}

function client(): Anthropic {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 가 설정되어 있지 않습니다. " +
        "supabase secrets set ANTHROPIC_API_KEY=... 로 등록해 주세요.",
    );
  }
  return new Anthropic({ apiKey });
}

/** 응답 텍스트에서 JSON 부분만 추출한다. (```json 코드펜스 등 방어) */
export function extractJson<T>(text: string): T {
  let body = text.trim();

  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();

  if (!body.startsWith("{") && !body.startsWith("[")) {
    const objStart = body.indexOf("{");
    const arrStart = body.indexOf("[");
    const start = objStart === -1
      ? arrStart
      : arrStart === -1
      ? objStart
      : Math.min(objStart, arrStart);
    if (start === -1) throw new Error(`JSON 응답을 찾을 수 없습니다: ${text.slice(0, 200)}`);
    const endChar = body[start] === "{" ? "}" : "]";
    const end = body.lastIndexOf(endChar);
    body = body.slice(start, end + 1);
  }

  return JSON.parse(body) as T;
}

interface AskOptions {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface Usage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AskResult<T> {
  value: T;
  usage: Usage;
}

/**
 * 100만 토큰당 요금(달러). 모델을 바꿀 때 함께 고친다.
 * 출처: Anthropic 공개 가격표.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5": { input: 5, output: 25 },
};

/** 사용량을 달러로 환산한다. 모르는 모델이면 0 을 돌려준다. */
export function estimateCostUsd(modelId: string, usage: Usage): number {
  const key = Object.keys(PRICING).find((name) => modelId.startsWith(name));
  if (!key) return 0;
  const price = PRICING[key];
  return (
    (usage.inputTokens / 1_000_000) * price.input +
    (usage.outputTokens / 1_000_000) * price.output
  );
}

export function currentModel(): string {
  return model();
}

export function emptyUsage(): Usage {
  return { calls: 0, inputTokens: 0, outputTokens: 0 };
}

export function addUsage(total: Usage, next: Usage): Usage {
  return {
    calls: total.calls + next.calls,
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
  };
}

/**
 * Claude 에 질문하고 JSON 으로 파싱된 결과를 돌려준다. (일시적 오류는 1회 재시도)
 * 요금 확인을 위해 사용한 토큰 수도 함께 돌려준다.
 */
export async function askForJson<T>({
  system,
  user,
  maxTokens = 8000,
}: AskOptions): Promise<AskResult<T>> {
  const anthropic = client();
  let lastError: unknown;
  const usage: Usage = emptyUsage();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const modelId = model();
      const response = await anthropic.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        ...(supportsEffort(modelId) ? { output_config: { effort: effort() } } : {}),
        system,
        messages: [{ role: "user", content: user }],
      });

      usage.calls += 1;
      usage.inputTokens += response.usage.input_tokens ?? 0;
      usage.outputTokens += response.usage.output_tokens ?? 0;

      if (response.stop_reason === "refusal") {
        throw new Error("모델이 응답을 거부했습니다.");
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      return { value: extractJson<T>(text), usage };
    } catch (error) {
      lastError = error;
      const retryable = error instanceof Anthropic.RateLimitError ||
        (error instanceof Anthropic.APIError && error.status !== undefined &&
          error.status >= 500) ||
        error instanceof Anthropic.APIConnectionError;
      if (!retryable || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
