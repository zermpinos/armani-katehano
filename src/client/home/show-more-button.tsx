import React from "react";
import Link from "next/link";

export function ShowMoreButton({ href, onClick, children, className }: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const cls = `${className ?? ""} bg-transparent border-0 text-[11px] font-bold text-ak-text-dim hover:text-ak-text-sub cursor-pointer tracking-[0.1em] uppercase transition-colors duration-150 py-1 px-0 no-underline inline-block`;
  if (href) {
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return <button className={cls} onClick={onClick}>{children}</button>;
}
