export const ROOT_HOME_VIEW_STORAGE_KEY = "ai-scale-root-view";

export type RootHomeViewMode = "auto" | "mobile" | "desktop";
export type ResolvedRootHomeView = Exclude<RootHomeViewMode, "auto">;

export function normalizeRootHomeViewMode(value: unknown): RootHomeViewMode {
  return value === "mobile" || value === "desktop" || value === "auto" ? value : "auto";
}

export function resolveRootHomeView({
  queryView,
  storedView,
  isMobileViewport,
}: {
  queryView: unknown;
  storedView: unknown;
  isMobileViewport: boolean;
}): ResolvedRootHomeView {
  const queryMode = normalizeRootHomeViewMode(queryView);
  if (queryMode === "mobile" || queryMode === "desktop") {
    return queryMode;
  }

  const storedMode = normalizeRootHomeViewMode(storedView);
  if (storedMode === "mobile" || storedMode === "desktop") {
    return storedMode;
  }

  return isMobileViewport ? "mobile" : "desktop";
}
