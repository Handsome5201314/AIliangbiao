import { NextRequest } from 'next/server';

import {
  getAgentLiveExecution,
  getEventsAfterCursor,
} from '@/lib/agent/live-service';
import { extractBearerToken, verifyAgentSessionToken } from '@/lib/assessment-skill/auth';

const encoder = new TextEncoder();

function encodeSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function parseLastEventId(request: NextRequest) {
  const fromHeader = request.headers.get('last-event-id') || request.headers.get('Last-Event-ID');
  const fromQuery = request.nextUrl.searchParams.get('after');
  const parsed = Number(fromQuery || fromHeader || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ executionId: string }> }
) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    const { executionId } = await context.params;
    let lastSeq = parseLastEventId(request);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const sendEvents = async () => {
          const execution = await getAgentLiveExecution({ session, executionId });
          const events = getEventsAfterCursor(execution, lastSeq);
          for (const event of events) {
            lastSeq = event.seq;
            controller.enqueue(encodeSse('agent-live', event));
          }
        };

        await sendEvents();
        const heartbeat = setInterval(() => {
          controller.enqueue(encodeSse('heartbeat', { lastSeq, at: new Date().toISOString() }));
          void sendEvents().catch((error) => {
            controller.enqueue(encodeSse('error', {
              message: error instanceof Error ? error.message : 'Failed to stream live events',
            }));
          });
        }, 1000);

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to open live stream' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
