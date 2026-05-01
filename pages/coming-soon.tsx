import Head from "next/head";
import Image from "next/image";

export default function ComingSoon() {
  return (
    <>
      <Head>
        <title>Coming Soon -- Armani Katehano</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen flex flex-col items-center justify-center bg-ak-base px-6 gap-0">
        {/* Logo */}
        <div className="mb-10 animate-fade-in">
          <Image
            src="/logohighres.png"
            alt="Armani Katehano"
            width={128}
            height={128}
            className="object-contain"
            priority
          />
        </div>

        {/* Name */}
        <p className="text-[11px] font-black tracking-[0.22em] uppercase text-ak-red-bright mb-4 animate-fade-in">
          Armani Katehano
        </p>

        {/* Headline */}
        <h1 className="text-[44px] font-black tracking-[0.1em] uppercase leading-none text-ak-text animate-fade-in">
          Coming Soon
        </h1>

        {/* Red bar */}
        <div className="mt-5 h-[3px] w-14 rounded-full bg-gradient-to-r from-ak-red to-ak-red-bright animate-fade-in" />

        {/* Launch date */}
        <p className="mt-8 text-ak-gold text-[13px] font-semibold tracking-[0.18em] uppercase animate-fade-in">
          Launching 3 May 2026
        </p>
      </main>
    </>
  );
}
