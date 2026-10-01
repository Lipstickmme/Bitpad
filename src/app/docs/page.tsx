import type { Metadata } from "next";
import { DOCS } from "@/content/docs";
import { DocArticle } from "@/components/docs/DocArticle";

export const metadata: Metadata = { title: "Docs", description: DOCS[0].description };

export default function DocsHome() {
  return <DocArticle page={DOCS[0]} />;
}
