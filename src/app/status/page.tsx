import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2, CircleAlert, CircleDashed, XCircle } from "lucide-react";
import { runHealth, type CheckState } from "@/lib/health";

export const metadata: Metadata = { title: "System status", robots: { index: false } };
export const dynamic = "force-dynamic";

const ICON: Record<CheckState, React.ReactNode> = {
  ok: <CheckCircle2 className="size-4 text-up" />,
  warn: <CircleAlert className="size-4 text-[#f5c518]" />,
  error: <XCircle className="size-4 text-down" />,
  missing: <CircleDashed className="size-4 text-muted" />,
};
const LABEL: Record<CheckState, string> = { ok: "Active", warn: "Check", error: "Not working", missing: "Not set" };

/** Every environment variable tested live against its service. Values are never shown. */
export default async function StatusPage() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const { checks, deployment } = await runHealth(origin);
  const bad = checks.filter((c) => c.state === "error").length;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System status</h1>
        <p className="mt-1 text-sm text-ink-2">Each environment variable is tested live against its service right now. Values are never shown. {bad ? <b className="text-down">{bad} not working.</b> : <b className="text-up">No errors.</b>}</p>
      </div>
      <section className="card overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {checks.map((c) => (
              <tr key={c.name} className="border-b border-line/60 last:border-0 align-top">
                <td className="px-4 py-3"><div className="flex items-center gap-2">{ICON[c.state]}<span className="font-mono text-xs font-semibold">{c.name}</span></div></td>
                <td className="py-3 pr-2 text-xs font-medium whitespace-nowrap">{LABEL[c.state]}{c.required && c.state !== "ok" ? " · needed" : ""}</td>
                <td className="py-3 pr-4 text-xs text-ink-2">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card p-4 text-xs">
        <div className="mb-2 font-semibold">This deployment (set automatically by Vercel)</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {Object.entries(deployment).map(([k, v]) => <div key={k}><span className="text-muted">{k}: </span><span className="font-mono">{v}</span></div>)}
        </div>
        <p className="mt-3 text-muted">Changed a variable? Vercel only applies it to new deployments: redeploy, then reload this page.</p>
      </section>
    </div>
  );
}
