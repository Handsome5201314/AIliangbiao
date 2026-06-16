const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

async function requestJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return data;
}

async function requestText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return text;
}

async function main() {
  const health = await requestJson('/api/health');
  if (health?.status !== 'ok') {
    throw new Error('Health payload did not report ok');
  }

  const scales = await requestJson('/api/scales');
  if (!Array.isArray(scales?.scales) || scales.scales.length === 0) {
    throw new Error('Scale catalog smoke check returned no scales');
  }

  const agentHtml = await requestText('/agent');
  if (!agentHtml.includes('<title>AI量表系统 - 智能心理评估平台</title>')) {
    throw new Error('/agent did not render the expected HTML shell');
  }

  const adminChannelsHtml = await requestText('/admin/channels');
  if (!adminChannelsHtml.includes('<title>AI量表系统 - 智能心理评估平台</title>')) {
    throw new Error('/admin/channels did not render the expected HTML shell');
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        checks: ['health', 'scales', 'agent shell', 'admin channels shell'],
        status: 'ok',
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
