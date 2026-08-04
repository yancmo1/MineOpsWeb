import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { initWebVitals } from "./utils/webVitals";
import { initErrorBeacon } from "./utils/errorBeacon";

// Performance mark for hydration start
performance.mark('hydration-start');

// Initialize performance monitoring
initWebVitals();
initErrorBeacon();

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

const root = createRoot(document.getElementById("root")!);
root.render(<StrictMode><App /></StrictMode>);

// Performance mark for hydration complete
performance.mark('hydration-end');
performance.measure('hydration', 'hydration-start', 'hydration-end');
