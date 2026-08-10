import React, { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "budget:install-dismissed";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const isIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  // iPadOS 13+ reports itself as a Mac, but only touch Macs are really iPads.
  (window.navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Chrome hands us a `beforeinstallprompt` event we can fire on demand.
 * Safari never does, so iOS gets the Share-sheet instructions instead.
 */
export default function InstallBar() {
  const [deferred, setDeferred] = useState(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isStandalone()) return;

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setDeferred(null);
      setShowIOSHint(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (isIOS()) setShowIOSHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Dismissal is a nicety; losing it just shows the bar again.
    }
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") dismiss();
  };

  if (dismissed || (!deferred && !showIOSHint)) return null;

  return (
    <div className="mx-5 mt-4 rounded-xl gold-card px-4 py-3 flex items-center gap-3 rise-in">
      <div className="flex-1 min-w-0">
        <div className="lg-sans text-[12.5px] font-semibold text-[#D8CBA5]">
          Keep the ledger on your home screen
        </div>
        {deferred ? (
          <div className="lg-sans text-[11.5px] text-[#8FA396] mt-0.5">
            Installs as an app — works offline, no browser chrome.
          </div>
        ) : (
          <div className="lg-sans text-[11.5px] text-[#8FA396] mt-0.5 flex items-center gap-1 flex-wrap">
            Tap
            <Share size={12} className="inline text-[#CBA135]" />
            Share, then “Add to Home Screen”.
          </div>
        )}
      </div>
      {deferred && (
        <button
          onClick={install}
          className="lg-sans shrink-0 text-[12px] font-semibold rounded-lg px-3 py-1.5"
          style={{ background: "linear-gradient(135deg,#E4C766,#CBA135)", color: "#1A1208" }}
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="shrink-0 text-[#8FA396] hover:text-[#D8CBA5]"
      >
        <X size={15} />
      </button>
    </div>
  );
}
