import Head from "next/head";
import Image from "next/image";

export default function MaintenancePage() {
  return (
    <>
      <Head>
        <title>Under maintenance · Armani Katehano</title>
        <meta name="description" content="The site is briefly offline for maintenance. We'll be back shortly." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" type="image/png" href="/logo.png" />
      </Head>

      <main className="min-h-screen bg-ak-base text-ak-text flex flex-col">
        {/* Red top accent - mirrors the site's navbar */}
        <div className="h-[3px] bg-gradient-to-r from-ak-red via-ak-red-bright to-ak-red" />

        <div className="flex-1 flex items-center justify-center px-4 py-16 relative overflow-hidden">
          {/* Diagonal red texture, faded - same motif used by the homepage hero */}
          <div className="absolute inset-0 ak-hero-texture opacity-[0.06] pointer-events-none" />

          <div className="relative w-full max-w-[480px] rounded-2xl border border-ak-border bg-ak-surface px-8 py-10 sm:px-10 sm:py-12 text-center shadow-[0_24px_64px_rgba(0,0,0,0.45)] animate-slide-up">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-ak-surface2 border border-ak-border2">
              <Image
                src="/logo.png"
                alt="Armani Katehano"
                width={48}
                height={48}
                className="object-contain"
                priority
              />
            </div>

            <div className="mx-auto mb-7 h-12 w-12 rounded-full border-[3px] border-ak-border2 border-t-ak-red-bright animate-ak-spin" />

            <div className="text-[10px] font-black tracking-[0.18em] text-ak-red-text uppercase mb-3">
              Maintenance
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ak-text mb-4 uppercase">
              We&rsquo;ll be right back
            </h1>

            <p className="text-[13px] sm:text-sm text-ak-text-sub leading-relaxed">
              The site is briefly offline while we make some changes.
              <br />
              Thanks for your patience &mdash; check back in a few minutes.
            </p>

            <div className="mt-9 flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-ak-red-bright animate-ak-pulse" />
              <span className="text-[10px] font-black tracking-[0.2em] text-ak-text-dim uppercase">
                Armani Katehano
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-ak-red-bright animate-ak-pulse" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
