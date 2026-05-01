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
        <div className="mb-10 animate-fade-in [animation-delay:0ms]">
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
        <p className="text-[11px] font-black tracking-[0.22em] uppercase text-ak-red-bright mb-4 animate-fade-in [animation-delay:150ms]">
          Armani Katehano
        </p>

        {/* Headline */}
        <h1 className="text-[44px] font-black tracking-[0.1em] uppercase leading-none text-ak-text animate-fade-in [animation-delay:300ms]">
          Coming Soon
        </h1>

        {/* Red bar */}
        <div className="mt-5 h-[3px] w-14 rounded-full bg-gradient-to-r from-ak-red to-ak-red-bright animate-fade-in [animation-delay:450ms]" />

        {/* Launch date */}
        <p className="mt-8 text-ak-gold text-[13px] font-semibold tracking-[0.18em] uppercase animate-fade-in [animation-delay:600ms]">
          Launching 3 May 2026
        </p>

        {/* Social */}
        <div className="mt-10 animate-fade-in [animation-delay:750ms]">
          <a
            href="https://www.instagram.com/armanikatehano_b.c/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[11px] font-black tracking-[0.08em] text-ak-text-dim transition-colors duration-150 hover:text-ak-text border border-[#c0392b30] rounded-lg px-3 py-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            @armanikatehano_b.c
          </a>
        </div>
      </main>
    </>
  );
}
