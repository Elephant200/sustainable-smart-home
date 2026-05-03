/**
 * Defensive JSON fetch for client components.
 *
 * Plain `await response.json()` throws "Unexpected token '<', '<!DOCTYPE'..."
 * whenever the server returns HTML (Next.js dev error overlay page, a proxy
 * timeout page, a 502 from infra, etc.). That JSON.parse error is opaque,
 * surfaces in the Next.js dev error popup as an unhandled rejection, and
 * tells the user nothing about what actually failed.
 *
 * fetchJson():
 *   - Always returns a typed object on 2xx with a JSON body.
 *   - On non-2xx OR non-JSON content-type, throws a FetchJsonError carrying
 *     the HTTP status, status text, content-type, and a short body excerpt.
 *   - Never throws "Unexpected token '<'..." into the dev overlay.
 */

export class FetchJsonError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly contentType: string | null;
  readonly bodyExcerpt: string;
  readonly url: string;

  constructor(opts: {
    status: number;
    statusText: string;
    contentType: string | null;
    bodyExcerpt: string;
    url: string;
    message: string;
  }) {
    super(opts.message);
    this.name = 'FetchJsonError';
    this.status = opts.status;
    this.statusText = opts.statusText;
    this.contentType = opts.contentType;
    this.bodyExcerpt = opts.bodyExcerpt;
    this.url = opts.url;
  }
}

export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    throw new FetchJsonError({
      status: 0,
      statusText: 'Network Error',
      contentType: null,
      bodyExcerpt: '',
      url: typeof input === 'string' ? input : input.toString(),
      message: err instanceof Error ? err.message : 'Network request failed',
    });
  }

  const contentType = response.headers.get('content-type');
  const isJson = !!contentType && contentType.toLowerCase().includes('application/json');

  // Read the body as text first so we can include an excerpt in errors and
  // so non-JSON responses don't blow up JSON.parse with an opaque message.
  const text = await response.text().catch(() => '');

  if (!response.ok) {
    let serverMessage: string | undefined;
    if (isJson && text) {
      try {
        const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
        if (typeof parsed.error === 'string') serverMessage = parsed.error;
        else if (typeof parsed.message === 'string') serverMessage = parsed.message;
      } catch {
        // fall through to body excerpt
      }
    }
    throw new FetchJsonError({
      status: response.status,
      statusText: response.statusText,
      contentType,
      bodyExcerpt: text.slice(0, 200),
      url: response.url,
      message:
        serverMessage ??
        `Request failed with HTTP ${response.status} ${response.statusText}`,
    });
  }

  // Empty success body (204 No Content, 205 Reset Content, or any 2xx with no
  // body) is not a parse error — return undefined so callers can opt in to
  // void responses without crashing the fetch helper.
  if (
    response.status === 204 ||
    response.status === 205 ||
    response.headers.get('content-length') === '0' ||
    text === ''
  ) {
    return undefined as T;
  }

  if (!isJson) {
    throw new FetchJsonError({
      status: response.status,
      statusText: response.statusText,
      contentType,
      bodyExcerpt: text.slice(0, 200),
      url: response.url,
      message: `Expected JSON response but received ${contentType ?? 'no content-type'}`,
    });
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new FetchJsonError({
      status: response.status,
      statusText: response.statusText,
      contentType,
      bodyExcerpt: text.slice(0, 200),
      url: response.url,
      message: err instanceof Error ? err.message : 'Failed to parse JSON',
    });
  }
}
