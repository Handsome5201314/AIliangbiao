import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ROOT_HOME_VIEW_STORAGE_KEY,
  normalizeRootHomeViewMode,
  resolveRootHomeView,
} from "../lib/root-home-view";

test("root home defaults to mobile on phone-width viewports", () => {
  assert.equal(
    resolveRootHomeView({
      queryView: null,
      storedView: "auto",
      isMobileViewport: true,
    }),
    "mobile"
  );
});

test("root home defaults to desktop on desktop-width viewports", () => {
  assert.equal(
    resolveRootHomeView({
      queryView: null,
      storedView: "auto",
      isMobileViewport: false,
    }),
    "desktop"
  );
});

test("query view=desktop overrides mobile viewport and is a persisted mode", () => {
  assert.equal(normalizeRootHomeViewMode("desktop"), "desktop");
  assert.equal(
    resolveRootHomeView({
      queryView: "desktop",
      storedView: "mobile",
      isMobileViewport: true,
    }),
    "desktop"
  );
});

test("query view=mobile overrides desktop viewport and is a persisted mode", () => {
  assert.equal(normalizeRootHomeViewMode("mobile"), "mobile");
  assert.equal(
    resolveRootHomeView({
      queryView: "mobile",
      storedView: "desktop",
      isMobileViewport: false,
    }),
    "mobile"
  );
});

test("invalid root view preferences fall back to auto responsive behavior", () => {
  assert.equal(normalizeRootHomeViewMode("tablet"), "auto");
  assert.equal(normalizeRootHomeViewMode(null), "auto");
  assert.equal(
    resolveRootHomeView({
      queryView: "tablet",
      storedView: "desktop",
      isMobileViewport: true,
    }),
    "desktop"
  );
  assert.equal(
    resolveRootHomeView({
      queryView: null,
      storedView: "tablet",
      isMobileViewport: true,
    }),
    "mobile"
  );
});

test("root home uses the documented localStorage key", () => {
  assert.equal(ROOT_HOME_VIEW_STORAGE_KEY, "ai-scale-root-view");
});

test("Next root home production path does not depend on prototype mocks", async () => {
  const pageSource = await readFile("app/page.tsx", "utf8");
  const viewHelperSource = await readFile("lib/root-home-view.ts", "utf8");

  for (const source of [pageSource, viewHelperSource]) {
    assert.doesNotMatch(source, /session-mock/);
    assert.doesNotMatch(source, /mockData/);
    assert.doesNotMatch(source, /mobile-h5-prototype/);
  }
});
