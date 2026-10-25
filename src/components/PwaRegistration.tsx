"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    void navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: `${basePath || "/"}/` }).catch(() => {
      // Offline mode is optional on browsers that reject service workers.
    });
  }, []);
  return null;
}
