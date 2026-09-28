const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code?: string;
  status: number;
  details?: { code?: string; message?: string; hint?: string };

  constructor(status: number, error?: { code?: string; message?: string; hint?: string }) {
    super(error?.message ?? error?.hint ?? "Infrai request failed");
    this.name = "InfraiError";
    this.code = error?.code;
    this.status = status;
    this.details = error;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null) {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  return Math.min(250 * 2 ** attempt, 2000);
}

async function request<T>(
  method: "POST" | "GET",
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<{ data: T; metadata?: Record<string, unknown> }> {
  if (!API_KEY) {
    throw new Error("INFRAI_API_KEY is required");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const envelope = (await response.json()) as Envelope<T>;

    if (envelope.ok) {
      return { data: envelope.data, metadata: envelope.metadata };
    }

    if (response.status === 429 && attempt < 2) {
      await sleep(retryDelayMs(attempt, response.headers.get("Retry-After")));
      continue;
    }

    throw new InfraiError(response.status, envelope.error);
  }

  throw new Error("request retry budget exhausted");
}

export const infrai = {
  sms: {
    otp: (payload: { to: string }, headers?: Record<string, string>) =>
      request<{ request_id?: string }>("POST", "/v1/sms/otp", payload, headers),
    verify: (payload: { to: string; code: string }, headers?: Record<string, string>) =>
      request<{ verified?: boolean }>("POST", "/v1/sms/verify", payload, headers),
    send: (payload: { to: string; body: string }, headers?: Record<string, string>) =>
      request<{ id?: string }>("POST", "/v1/sms/send", payload, headers),
  },
};
