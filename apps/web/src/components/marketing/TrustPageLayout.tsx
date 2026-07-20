import type { ReactNode } from "react";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export interface TrustPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

/** Shared layout for the four trust pages (/privacy, /methodology, /data-governance, /accessibility). */
export function TrustPageLayout({ title, lastUpdated, children }: TrustPageLayoutProps) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-10">
        <h1 className="font-sans text-3xl font-bold text-on-surface">{title}</h1>
        <p className="mt-2 font-mono text-xs text-on-surface-variant">
          Terakhir diperbarui: {lastUpdated}
        </p>
        <div className="mt-8 flex flex-col gap-6 font-sans text-sm leading-7 text-on-surface [&_h2]:mt-4 [&_h2]:font-sans [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-on-surface [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
          {children}
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
