import test from "node:test";
import assert from "node:assert/strict";

test("patient agent entry card should render only one self-service entry", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("components/PatientAgentEntryCard.tsx", "utf8");

  const selfServiceLinks = source.match(/href(?:=|:)\s*["']\/agent\?mode=self_service["']/g) ?? [];

  assert.equal(selfServiceLinks.length, 1);
  assert.doesNotMatch(source, /lg:grid-cols-2/);
});
