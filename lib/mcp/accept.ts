export function shouldOpenMcpSseGet(acceptHeader: string | null | undefined) {
  const acceptedTypes = String(acceptHeader ?? '')
    .split(',')
    .map((entry) => entry.split(';', 1)[0]?.trim().toLowerCase())
    .filter(Boolean);

  if (!acceptedTypes.includes('text/event-stream')) {
    return false;
  }

  // Some external platforms reuse the same mixed Accept header for both JSON-RPC
  // POST and GET probe requests. Treat those GET probes as JSON so they do not
  // hang on an SSE stream during connection tests.
  return !acceptedTypes.some((type) => type === 'application/json' || type === '*/*');
}
