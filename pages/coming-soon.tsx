import Head from "next/head";
import Image from "next/image";
import { SubscribeForm } from "@/client/home/subscribe-form";

export default function ComingSoon() {
  return (
    <>
      <Head>
        <title>Coming Soon — Armani Katehano</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen flex flex-col items-center justify-center bg-ak-base px-6 py-12 gap-8">
        <Image
          src="/logohighres.png"
          alt="Armani Katehano"
          width={160}
          height={160}
          className="object-contain"
          priority
        />

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-bold tracking-widest text-ak-text uppercase">
            Coming Soon
          </h1>
          <div className="h-1 w-16 rounded bg-ak-red-bright" />
        </div>

        <p className="text-ak-gold text-lg font-semibold tracking-wide">
          Sunday, 3 May 2026
        </p>

        <div className="w-full max-w-sm">
          <SubscribeForm />
        </div>
      </main>
    </>
  );
}
