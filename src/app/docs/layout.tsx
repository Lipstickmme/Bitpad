import { DOC_GROUPS, DOCS } from "@/content/docs";
import { DocsNav } from "@/components/docs/DocsNav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const groups = DOC_GROUPS.map((group) => ({ group, pages: DOCS.filter((d) => d.group === group).map(({ slug, title }) => ({ slug, title })) }));
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
      <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
        <DocsNav groups={groups} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
