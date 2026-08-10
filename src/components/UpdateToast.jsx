import React from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Once installed, the app runs from the service worker cache, so a new
 * deploy only lands after the worker is told to take over. `registerType:
 * "prompt"` means that never happens behind the user's back mid-edit.
 */
export default function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-xl gold-card px-4 py-3 flex items-center gap-3 rise-in">
      <div className="flex-1 lg-sans text-[12.5px] text-[#D8CBA5]">
        A new version of the ledger is ready.
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        className="lg-sans shrink-0 text-[12px] font-semibold rounded-lg px-3 py-1.5"
        style={{ background: "linear-gradient(135deg,#E4C766,#CBA135)", color: "#1A1208" }}
      >
        Reload
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="lg-sans shrink-0 text-[12px] text-[#8FA396] hover:text-[#D8CBA5]"
      >
        Later
      </button>
    </div>
  );
}
