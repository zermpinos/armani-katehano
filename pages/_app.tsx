import "../styles/globals.css";
import Head from "next/head";
import type { AppProps, NextWebVitalsMetric } from "next/app";

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (metric.label !== "web-vital") return;
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  const m = metric as NextWebVitalsMetric & { rating?: string };
  // Blob carries an application/json content-type so the api route body-parses
  // it; a bare sendBeacon string arrives as text/plain and would not parse.
  const blob = new Blob(
    [JSON.stringify({ name: m.name, value: m.value, id: m.id, rating: m.rating, path: window.location.pathname })],
    { type: "application/json" },
  );
  navigator.sendBeacon("/api/vitals", blob);
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="google-site-verification" content="jLrtMQ8j8j_KaFR2e4nhtIpZ0DCSMtekcD2kbY4n2mc" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
