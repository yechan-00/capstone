const EXPECTED_HOST = 'regret-wallet-images.regret-wallet-3db60.workers.dev';
const PROBE_TIMEOUT_MS = 12_000;
let probeStarted = false;

export type ImageEventFlags = {
  loadStart: boolean;
  load: boolean;
  error: boolean;
  loadEnd: boolean;
};

function sanitize(value: string): string {
  return value
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/token=[^&\s]+/gi, 'token=[redacted]');
}

function describeUri(uri: string): {
  host: string;
  path: string;
  hasToken: boolean;
  hostOk: boolean;
} {
  try {
    const parsed = new URL(uri.trim());
    return {
      host: parsed.hostname,
      path: parsed.pathname,
      hasToken: parsed.searchParams.has('token'),
      hostOk: parsed.hostname === EXPECTED_HOST,
    };
  } catch {
    return { host: 'invalid', path: '', hasToken: false, hostOk: false };
  }
}

function prefix(info: ReturnType<typeof describeUri>): string {
  return `host=${info.host} path=${info.path} hasToken=${info.hasToken} hostOk=${info.hostOk}`;
}

export function logExpenseImageStart(uri: string): void {
  if (!__DEV__) return;
  console.log(`[r2-image] start ${prefix(describeUri(uri))}`);
}

export function logExpenseImageLoadStart(uri: string): void {
  if (!__DEV__) return;
  console.log(`[r2-image] onLoadStart ${prefix(describeUri(uri))}`);
}

export function logExpenseImageLoad(uri: string): void {
  if (!__DEV__) return;
  console.log(`[r2-image] onLoad ${prefix(describeUri(uri))}`);
}

export function logExpenseImageLoadEnd(uri: string): void {
  if (!__DEV__) return;
  console.log(`[r2-image] onLoadEnd ${prefix(describeUri(uri))}`);
}

export function logExpenseImageError(uri: string, rawMessage?: string): void {
  if (!__DEV__) return;
  const message = rawMessage ? sanitize(String(rawMessage)) : 'none';
  console.warn(`[r2-image] onError ${prefix(describeUri(uri))} message=${message}`);
}

export function logExpenseImageEventsNone(uri: string, flags: ImageEventFlags): void {
  if (!__DEV__) return;
  console.warn(
    `[r2-image] events-none ${prefix(describeUri(uri))} loadStart=${flags.loadStart} onLoad=${flags.load} onError=${flags.error} onLoadEnd=${flags.loadEnd} waitedMs=${PROBE_TIMEOUT_MS}`,
  );
}

export function probeExpenseImageOnce(uri: string): void {
  if (!__DEV__) return;
  const key = uri.trim();
  if (!key || probeStarted) return;
  probeStarted = true;

  const info = describeUri(key);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  void (async () => {
    let gotHeaders = false;
    try {
      const response = await fetch(key, { method: 'GET', signal: controller.signal });
      gotHeaders = true;
      console.log(
        `[r2-image] probe ${prefix(info)} status=${response.status} contentType=${response.headers.get('Content-Type') ?? 'none'} contentLength=${response.headers.get('Content-Length') ?? 'none'} ms=${Date.now() - started}`,
      );
      try {
        controller.abort();
      } catch {
        // 본문 미수신. abort 실패해도 진단은 헤더로 끝냅니다.
      }
    } catch (error) {
      if (gotHeaders) return;
      const name = error instanceof Error ? error.name : 'unknown';
      console.warn(`[r2-image] probe-fail ${prefix(info)} type=${name} ms=${Date.now() - started}`);
    } finally {
      clearTimeout(timer);
    }
  })();
}
