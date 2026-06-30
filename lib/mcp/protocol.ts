export const MCP_PROTOCOL_VERSIONS = [
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

export const DEFAULT_MCP_PROTOCOL_VERSION = MCP_PROTOCOL_VERSIONS[0];

export function negotiateMcpProtocolVersion(requestedVersion: unknown) {
  if (
    typeof requestedVersion === 'string' &&
    MCP_PROTOCOL_VERSIONS.includes(
      requestedVersion as (typeof MCP_PROTOCOL_VERSIONS)[number]
    )
  ) {
    return requestedVersion;
  }

  return DEFAULT_MCP_PROTOCOL_VERSION;
}

export function getMcpResponseProtocolVersion(response: unknown) {
  if (!response || typeof response !== 'object' || !('result' in response)) {
    return null;
  }

  const result = (response as { result?: unknown }).result;
  if (!result || typeof result !== 'object' || !('protocolVersion' in result)) {
    return null;
  }

  const protocolVersion = (result as { protocolVersion?: unknown }).protocolVersion;
  return typeof protocolVersion === 'string' ? protocolVersion : null;
}
