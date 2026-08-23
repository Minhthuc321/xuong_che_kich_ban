import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_PROMPT_CHARS = 140000;
const MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS || 3500);
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 90000);
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE || 12);
const RATE_WINDOW_MS = 60_000;
const buckets = new Map();

function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim();
}

function isRateLimited(ip) {
  const now = Date.now();
  const current = buckets.get(ip);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    buckets.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

async function callAnthropic(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Máy chủ chưa cấu hình ANTHROPIC_API_KEY."), { status: 503 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Anthropic API lỗi ${response.status}`;
      throw Object.assign(new Error(message), { status: response.status });
    }

    const text = Array.isArray(data?.content)
      ? data.content.filter((b) => b?.type === "text").map((b) => b.text || "").join("\n").trim()
      : "";
    if (!text) throw Object.assign(new Error("AI không trả về nội dung."), { status: 502 });
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request) {
  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Bạn thao tác quá nhanh. Hãy thử lại sau ít giây." }, { status: 429 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Prompt đang trống." }, { status: 400 });
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: "Nội dung quá dài. Hãy rút gọn transcript." }, { status: 413 });
  }

  try {
    const text = await callAnthropic(prompt);
    return NextResponse.json({ text, model: MODEL });
  } catch (error) {
    const aborted = error?.name === "AbortError";
    const status = aborted ? 504 : Number(error?.status) || 500;
    const safeMessage = aborted
      ? "AI phản hồi quá lâu. Hãy chạy lại."
      : status === 401 || status === 403
        ? "API key Anthropic không hợp lệ hoặc chưa có quyền dùng model."
        : status === 429
          ? "Anthropic đang giới hạn lượt gọi. Hãy thử lại sau."
          : status >= 500
            ? "Dịch vụ AI đang lỗi. Hãy thử lại sau."
            : error?.message || "Không gọi được AI.";

    console.error("/api/generate", { status, message: error?.message });
    return NextResponse.json({ error: safeMessage }, { status });
  }
}
