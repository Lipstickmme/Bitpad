import Link from "next/link";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Minimal Markdown for the docs (trusted, in-repo content only): headings,
 * paragraphs, lists, tables, fenced code, quotes with [!INFO]/[!TIP]/[!WARN]
 * callouts, and inline **bold**, `code` and [links](url).
 */
export const slugify = (s: string) => s.toLowerCase().replace(/[`*]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function headings(md: string) {
  return [...md.matchAll(/^(#{2,3}) (.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].replace(/[`*]/g, ""), id: slugify(m[2]) }));
}

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k} className="font-semibold text-ink">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="break-all rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-ink">{t.slice(1, -1)}</code>);
    else {
      const [, label, href] = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      out.push(href.startsWith("/")
        ? <Link key={k} href={href} className="font-medium text-brand underline-offset-2 hover:underline">{label}</Link>
        : <a key={k} href={href} target="_blank" rel="noreferrer" className="font-medium text-brand underline-offset-2 hover:underline">{label}</a>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const CALLOUT = {
  INFO: { Icon: Info, cls: "border-brand/40 bg-brand-soft/30", icon: "text-brand" },
  TIP: { Icon: Lightbulb, cls: "border-up/40 bg-up-soft", icon: "text-up" },
  WARN: { Icon: AlertTriangle, cls: "border-warn/40 bg-warn-soft", icon: "text-warn" },
} as const;

export function Markdown({ md }: { md: string }) {
  const lines = md.trim().split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{2,3}) (.+)$/);
    if (h) {
      const Tag = h[1].length === 2 ? "h2" : "h3";
      blocks.push(<Tag key={k++} id={slugify(h[2])} className={`scroll-mt-24 font-semibold tracking-tight text-ink ${Tag === "h2" ? "mt-10 border-t border-line pt-6 text-xl" : "mt-7 text-base"}`}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface-2 p-4 font-mono text-[13px] leading-relaxed text-ink">{code.join("\n")}</pre>);
      continue;
    }
    if (line.startsWith(">")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) q.push(lines[i++].replace(/^> ?/, ""));
      const tag = q[0]?.match(/^\[!(INFO|TIP|WARN)\]$/)?.[1] as keyof typeof CALLOUT | undefined;
      const c = CALLOUT[tag ?? "INFO"];
      blocks.push(
        <div key={k++} className={`mt-4 flex gap-3 rounded-lg border p-4 text-sm leading-relaxed text-ink-2 ${c.cls}`}>
          <c.Icon className={`mt-0.5 size-4 shrink-0 ${c.icon}`} />
          <div>{inline((tag ? q.slice(1) : q).join(" "))}</div>
        </div>,
      );
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i++].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
      }
      const [head, ...body] = rows;
      const blankHead = head.every((c) => !c);
      blocks.push(
        <div key={k++} className="scroll-x mt-4 rounded-lg border border-line">
          <table className="w-full text-sm">
            {!blankHead && <thead className="bg-surface-2 text-left text-xs text-muted"><tr>{head.map((c, j) => <th key={j} className="px-3 py-2 font-medium">{inline(c)}</th>)}</tr></thead>}
            <tbody>{body.map((r, ri) => <tr key={ri} className="border-t border-line first:border-t-0 align-top">{r.map((c, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? "text-ink" : "text-ink-2"}`}>{inline(c, ri * 10 + j)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    const list = line.match(/^(-|\d+\.) /);
    if (list) {
      const ordered = list[1] !== "-";
      const items: string[] = [];
      while (i < lines.length && /^(-|\d+\.) /.test(lines[i])) items.push(lines[i++].replace(/^(-|\d+\.) /, ""));
      const L = ordered ? "ol" : "ul";
      blocks.push(<L key={k++} className={`mt-4 space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-2 ${ordered ? "list-decimal" : "list-disc"} marker:text-muted`}>{items.map((t, j) => <li key={j}>{inline(t, j)}</li>)}</L>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3} |```|>|\||-|\d+\. )/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++} className="mt-4 text-[15px] leading-relaxed text-ink-2">{inline(para.join(" "))}</p>);
  }
  return <>{blocks}</>;
}
