import "../styles/globals.css";
import Head from "next/head";
import type { AppProps } from "next/app";

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
