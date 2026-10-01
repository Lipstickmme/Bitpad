"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, BookOpen } from "lucide-react";

export interface NavGroup { group: string; pages: { slug: string; title: string }[] }

/** GitBook-style sidebar: grouped pages, active page highlighted; collapsible on phones. */
export function DocsNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.pages).find((p) => path === `/docs/${p.slug}` || (path === "/docs" && p.slug === "introduction"));
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="card flex w-full items-center gap-2 px-4 py-3 text-sm font-medium lg:hidden" aria-expanded={open}>
        <BookOpen className="size-4 text-brand" /> {current?.title ?? "Docs"}
        <ChevronDown className={`ml-auto size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <nav className={`${open ? "block" : "hidden"} mt-2 lg:mt-0 lg:block`} aria-label="Docs">
        {groups.map((g) => (
          <div key={g.group} className="mb-5">
            <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.group}</div>
            <ul className="space-y-0.5">
              {g.pages.map((p) => {
                const on = current?.slug === p.slug;
                return (
                  <li key={p.slug}>
                    <Link href={`/docs/${p.slug}`} onClick={() => setOpen(false)} className={`block rounded-md border-l-2 px-3 py-1.5 text-sm transition-colors ${on ? "border-brand bg-surface-2 font-medium text-ink" : "border-transparent text-ink-2 hover:bg-surface-2/60 hover:text-ink"}`}>
                      {p.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
