export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 px-6 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl backdrop-blur-md">
        
        <div className="mx-auto mb-8 h-14 w-14 animate-spin rounded-full border-4 border-white/20 border-t-sky-400" />

        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Under Construction
        </h1>

        <p className="text-base text-slate-300 sm:text-lg">
          We’re working on something great.
          <br />
          We’ll be with you shortly.
        </p>
      </div>
    </main>
  );
}
