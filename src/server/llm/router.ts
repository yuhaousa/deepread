// 模型路由网关。
// quick 档：回忆关键点判定、导师提示（小模型）；deep 档：摘要与迁移量表、申诉复评（大模型）。
// 按部署区域限制可用提供方（中国区只用境内备案模型），任何失败或超时都返回 null，
// 由调用方降级到规则评分 / 内置提示，保证训练闭环不中断。

export type Tier = "quick" | "deep";
export type Provider = "anthropic" | "openai" | "deepseek" | "qwen" | "none";
export type Purpose = "RECALL" | "RUBRIC" | "TUTOR" | "GUARDRAIL";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  purpose: Purpose;
  tier: Tier;
  system?: string;
  messages: ChatMessage[];
  json?: boolean;
  maxTokens?: number;
  userHash?: string;
}

export interface LlmResult {
  text: string;
  provider: Provider;
  model: string;
}

export interface CallLog {
  purpose: Purpose;
  provider: string;
  model: string;
  userHash?: string;
  inputTok?: number;
  outputTok?: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

/** 中国区只允许境内模型；海外区不限制 */
const REGION_PROVIDERS: Record<string, Provider[]> = {
  cn: ["deepseek", "qwen"],
  intl: ["anthropic", "openai", "deepseek", "qwen"],
};

const OPENAI_COMPATIBLE: Record<string, { base: string; keyEnv: string; baseEnv: string }> = {
  openai: { base: "https://api.openai.com/v1", keyEnv: "OPENAI_API_KEY", baseEnv: "OPENAI_BASE_URL" },
  deepseek: { base: "https://api.deepseek.com/v1", keyEnv: "DEEPSEEK_API_KEY", baseEnv: "DEEPSEEK_BASE_URL" },
  qwen: { base: "https://dashscope.aliyuncs.com/compatible-mode/v1", keyEnv: "DASHSCOPE_API_KEY", baseEnv: "DASHSCOPE_BASE_URL" },
};
const ANTHROPIC_BASE = "https://api.anthropic.com";

export interface RouteConfig {
  provider: Provider;
  model: string;
  apiKey: string | undefined;
  /** 可通过 *_BASE_URL 覆盖（企业网关、代理或私有部署） */
  baseUrl: string;
  timeoutMs: number;
  region: string;
}

export function resolveRoute(tier: Tier, env: NodeJS.ProcessEnv = process.env): RouteConfig | { error: string } {
  const prefix = tier === "quick" ? "LLM_QUICK" : "LLM_DEEP";
  const provider = (env[`${prefix}_PROVIDER`] ?? "none") as Provider;
  const model = env[`${prefix}_MODEL`] ?? "";
  const region = env.DEPLOY_REGION ?? "intl";
  if (provider === "none" || !model) return { error: "未配置模型" };
  if (!(REGION_PROVIDERS[region] ?? []).includes(provider)) {
    return { error: `区域 ${region} 不允许使用 ${provider}（数据驻留）` };
  }
  const keyEnv = provider === "anthropic" ? "ANTHROPIC_API_KEY" : OPENAI_COMPATIBLE[provider]?.keyEnv;
  const apiKey = keyEnv ? env[keyEnv] : undefined;
  if (!apiKey) return { error: `缺少 ${keyEnv}` };
  const baseUrl =
    provider === "anthropic" ? (env.ANTHROPIC_BASE_URL ?? ANTHROPIC_BASE) : (env[OPENAI_COMPATIBLE[provider].baseEnv] ?? OPENAI_COMPATIBLE[provider].base);
  return { provider, model, apiKey, baseUrl: baseUrl.replace(/\/$/, ""), timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 8000), region };
}

type Logger = (log: CallLog) => void | Promise<void>;
let logger: Logger = () => {};
export function setCallLogger(fn: Logger) {
  logger = fn;
}

export async function callLlm(req: LlmRequest, fetchImpl: typeof fetch = fetch): Promise<LlmResult | null> {
  const route = resolveRoute(req.tier);
  if ("error" in route) return null;
  const started = Date.now();
  const maxTokens = req.maxTokens ?? (req.tier === "quick" ? 400 : 700);
  try {
    let text = "";
    let inputTok: number | undefined;
    let outputTok: number | undefined;

    if (route.provider === "anthropic") {
      const res = await fetchImpl(`${route.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": route.apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: route.model, max_tokens: maxTokens, system: req.system, messages: req.messages }),
        signal: AbortSignal.timeout(route.timeoutMs),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
      inputTok = data.usage?.input_tokens;
      outputTok = data.usage?.output_tokens;
    } else {
      const messages = [...(req.system ? [{ role: "system", content: req.system }] : []), ...req.messages];
      const res = await fetchImpl(`${route.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${route.apiKey}` },
        body: JSON.stringify({
          model: route.model,
          messages,
          max_tokens: maxTokens,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(route.timeoutMs),
      });
      if (!res.ok) throw new Error(`${route.provider} ${res.status}`);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      text = data.choices?.[0]?.message?.content ?? "";
      inputTok = data.usage?.prompt_tokens;
      outputTok = data.usage?.completion_tokens;
    }

    await safeLog({ purpose: req.purpose, provider: route.provider, model: route.model, userHash: req.userHash, inputTok, outputTok, latencyMs: Date.now() - started, ok: true });
    return text ? { text, provider: route.provider, model: route.model } : null;
  } catch (e) {
    await safeLog({
      purpose: req.purpose,
      provider: route.provider,
      model: route.model,
      userHash: req.userHash,
      latencyMs: Date.now() - started,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function safeLog(log: CallLog) {
  try {
    await logger(log);
  } catch {
    /* 日志失败不影响训练 */
  }
}
