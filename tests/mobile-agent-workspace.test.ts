import test from "node:test";
import assert from "node:assert/strict";

test("mobile assistant stage helper should support collapsed half full transitions", async () => {
  const mobileAssistant = await import("../lib/agent/mobile-assistant");

  assert.deepEqual(mobileAssistant.MOBILE_ASSISTANT_STAGES, [
    "collapsed",
    "half",
    "full",
  ]);
  assert.equal(
    mobileAssistant.resolveMobileAssistantStage("collapsed", "open"),
    "half"
  );
  assert.equal(
    mobileAssistant.resolveMobileAssistantStage("half", "expand"),
    "full"
  );
  assert.equal(
    mobileAssistant.resolveMobileAssistantStage("full", "collapse"),
    "half"
  );
  assert.equal(
    mobileAssistant.resolveMobileAssistantStage("half", "close"),
    "collapsed"
  );
});

test("mobile agent workspace should compose launcher drawer and fullscreen shells", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("components/MobileAgentWorkspace.tsx", "utf8");

  assert.match(source, /AiAssistantLauncher/);
  assert.match(source, /AiAssistantDrawer/);
  assert.match(source, /AiAssistantFullScreen/);
  assert.match(source, /resolveMobileAssistantStage/);
  assert.doesNotMatch(source, /return <AgentWorkspace mobile \/>/);
});

test("agent workspace should expose embedded mobile shell mode and sticky mobile action bar", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("components/AgentWorkspace.tsx", "utf8");

  assert.match(source, /mobileShellMode/);
  assert.match(source, /onRequestExpand/);
  assert.match(source, /onRequestCollapse/);
  assert.match(source, /sticky bottom-0/);
});
