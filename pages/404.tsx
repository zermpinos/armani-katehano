import Link from "next/link";
import Layout from "../components/Layout";

export default function Custom404() {
  return (
    <Layout title="404 — Page Not Found">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-[96px] font-black text-ak-border leading-none">404</div>
          <div className="text-base font-bold text-ak-text-dim mt-2">Page not found</div>
          <Link href="/" className="inline-block mt-5 px-5 py-[9px] rounded-lg bg-ak-red text-ak-text font-black text-[13px] tracking-[0.12em] uppercase">← HOME</Link>
        </div>
      </div>
    </Layout>
  );
}
