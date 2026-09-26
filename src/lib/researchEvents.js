const RESEARCH_DATA_CHANGED_EVENT = "csdrepoai:research-data-changed";
const RESEARCH_DATA_CHANGED_STORAGE_KEY = "csdrepoai:research-data-changed-at";

export function notifyResearchDataChanged() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(RESEARCH_DATA_CHANGED_EVENT));
  try {
    window.localStorage.setItem(RESEARCH_DATA_CHANGED_STORAGE_KEY, String(Date.now()));
  } catch {
    // The same-tab event still refreshes analytics when storage is unavailable.
  }
}

export function subscribeToResearchDataChanges(callback) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event) => {
    if (event.key === RESEARCH_DATA_CHANGED_STORAGE_KEY) callback();
  };

  window.addEventListener(RESEARCH_DATA_CHANGED_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(RESEARCH_DATA_CHANGED_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}
