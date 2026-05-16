export type AgentLiveStreamMessage = {
  event: string;
  data: unknown;
};

export function parseAgentLiveSseBuffer(buffer: string) {
  const blocks = buffer.split(/\n\n/);
  const rest = buffer.endsWith('\n\n') ? '' : blocks.pop() || '';
  const messages: AgentLiveStreamMessage[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      continue;
    }

    let event = 'message';
    const dataLines: string[] = [];

    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim() || event;
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }

    const rawData = dataLines.join('\n');
    if (!rawData) {
      messages.push({ event, data: null });
      continue;
    }

    try {
      messages.push({ event, data: JSON.parse(rawData) });
    } catch {
      messages.push({ event, data: rawData });
    }
  }

  return { messages, rest };
}
