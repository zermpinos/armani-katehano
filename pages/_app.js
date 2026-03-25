import "../styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="google-site-verification" content="jLrtMQ8j8j_KaFR2e4nhtIpZ0DCSMtekcD2kbY4n2mc" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
