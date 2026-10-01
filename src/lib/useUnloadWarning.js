import { useEffect } from "react";

/** Ask the browser to confirm before reloading or leaving with unsaved work. */
export function useUnloadWarning(shouldWarn) {
  useEffect(() => {
    if (!shouldWarn) return undefined;

    function confirmUnload(event) {
      event.preventDefault();
      // Required by current browsers to display their built-in confirmation.
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", confirmUnload);
    return () => window.removeEventListener("beforeunload", confirmUnload);
  }, [shouldWarn]);
}
