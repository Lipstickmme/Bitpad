import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DOCS, type DocPage } from "@/content/docs";
import { Markdown, headings } from "./Markdown";

/** One docs page: breadcrumb, title, body, prev/next, and "On this page" on wide screens. */
export function DocArticle({ page }: { page: DocPage }) {
  const idx = DOCS.findIndex((d) => d.slug === page.slug);
  const prev = DOCS[idx - 1];
  const next = DOCS[idx + 1];
  const toc = headings(page.body);
  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_200px]">
      <article className="min-w-0 max-w-3xl">
        <div className="text-xs font-medium uppercase tracking-wider text-brand">{page.group}</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{page.title}</h1>
        <p className="mt-2 text-base text-ink-2">{page.description}</p>
        <div className="mt-2">
          <Markdown md={page.body} />
        </div>
        <div className="mt-12 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className="card group flex items-center gap-3 p-4 hover:border-line-strong">
              <ChevronLeft className="size-4 text-muted group-hover:text-ink" />
              <div><div className="text-xs text-muted">Previous</div><div className="text-sm font-medium">{prev.title}</div></div>
            </Link>
          ) : <span />}
          {next && (
            <Link href={`/docs/${next.slug}`} className="card group flex items-center justify-end gap-3 p-4 text-right hover:border-line-strong">
              <div><div className="text-xs text-muted">Next</div><div className="text-sm font-medium">{next.title}</div></div>
              <ChevronRight className="size-4 text-muted group-hover:text-ink" />
            </Link>
          )}
        </div>
      </article>
      {toc.length > 0 && (
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">On this page</div>
            <ul className="space-y-1.5 border-l border-line text-sm">
              {toc.map((h) => (
                <li key={h.id}><a href={`#${h.id}`} className={`-ml-px block border-l border-transparent text-ink-2 hover:border-ink-2 hover:text-ink ${h.level === 3 ? "pl-6" : "pl-3"}`}>{h.text}</a></li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
