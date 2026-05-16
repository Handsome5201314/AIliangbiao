import test from "node:test";
import assert from "node:assert/strict";

import {
  appendAgentLiveEvent,
  applyAgentLiveControl,
  buildAssessmentLiveView,
  type AgentLiveState,
} from "../lib/agent/live";
import { parseAgentLiveSseBuffer } from "../lib/agent/live-stream";

test("appendAgentLiveEvent assigns increasing sequence numbers and preserves existing events", () => {
  const initial: AgentLiveState = {
    status: "idle",
    nextSeq: 2,
    events: [
      {
        seq: 1,
        type: "plan",
        message: "Plan created",
        createdAt: "2026-05-05T00:00:00.000Z",
      },
    ],
  };

  const next = appendAgentLiveEvent(initial, {
    type: "running",
    message: "Running current step",
    now: "2026-05-05T00:00:01.000Z",
  });

  assert.equal(next.nextSeq, 3);
  assert.equal(next.events.length, 2);
  assert.equal(next.events[1].seq, 2);
  assert.equal(next.events[1].type, "running");
  assert.equal(next.events[1].createdAt, "2026-05-05T00:00:01.000Z");
});

test("appendAgentLiveEvent can replay only events after a cursor", () => {
  const state = appendAgentLiveEvent(
    appendAgentLiveEvent(undefined, {
      type: "plan",
      message: "Plan created",
      now: "2026-05-05T00:00:00.000Z",
    }),
    {
      type: "action",
      message: "Selected an option",
      now: "2026-05-05T00:00:01.000Z",
    }
  );

  assert.deepEqual(
    state.events.filter((event) => event.seq > 1).map((event) => event.type),
    ["action"]
  );
});

test("applyAgentLiveControl records pause, takeover, and resume transitions", () => {
  const paused = applyAgentLiveControl(undefined, {
    action: "pause",
    actor: "user",
    now: "2026-05-05T00:00:00.000Z",
  });
  const takeover = applyAgentLiveControl(paused, {
    action: "takeover",
    actor: "user",
    now: "2026-05-05T00:00:01.000Z",
  });
  const resumed = applyAgentLiveControl(takeover, {
    action: "resume",
    actor: "user",
    now: "2026-05-05T00:00:02.000Z",
  });

  assert.equal(paused.status, "paused");
  assert.equal(takeover.status, "takeover");
  assert.equal(takeover.control?.takenOverBy, "user");
  assert.equal(resumed.status, "running");
  assert.equal(resumed.control?.takenOverBy, undefined);
  assert.deepEqual(resumed.events.map((event) => event.type), ["paused", "takeover", "resumed"]);
});

test("takeover state stays active across manual action events until resume", () => {
  const takeover = applyAgentLiveControl(undefined, {
    action: "takeover",
    actor: "user",
    now: "2026-05-05T00:00:00.000Z",
  });

  const progressed = appendAgentLiveEvent(takeover, {
    type: "action",
    message: "User completed the current step manually",
    now: "2026-05-05T00:00:01.000Z",
  });

  assert.equal(progressed.status, "takeover");
  assert.equal(progressed.control?.takenOverBy, "user");
});

test("buildAssessmentLiveView describes the active internal assessment page", () => {
  const view = buildAssessmentLiveView({
    sessionId: "session-1",
    scaleId: "GAD-7",
    interactionMode: "station",
    progress: { answered: 2, total: 7, ratio: 2 / 7 },
    currentQuestion: { id: 3, text: "Feeling nervous?", options: [] },
    result: null,
  });

  assert.equal(view.kind, "assessment");
  assert.equal(view.href, "/agent?liveSession=session-1");
  assert.equal(view.anchor, "agent-question-3");
  assert.equal(view.pendingAction, "answer_question");
  assert.equal(view.title, "GAD-7");
});

test("parseAgentLiveSseBuffer returns complete messages and keeps partial rest", () => {
  const parsed = parseAgentLiveSseBuffer(
    'event: agent-live\ndata: {"seq":1,"type":"plan"}\n\nevent: heartbeat\ndata: {"lastSeq":1}'
  );

  assert.equal(parsed.messages.length, 1);
  assert.equal(parsed.messages[0].event, "agent-live");
  assert.deepEqual(parsed.messages[0].data, { seq: 1, type: "plan" });
  assert.equal(parsed.rest, 'event: heartbeat\ndata: {"lastSeq":1}');
});
