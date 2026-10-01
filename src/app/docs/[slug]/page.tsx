import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOCS, docBySlug } from "@/content/docs";
import { DocArticle } from "@/components/docs/DocArticle";

export const dynamicParams = false;
export const generateStaticParams = () => DOCS.map((d) => ({ slug: d.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = docBySlug((await params).slug);
  return page ? { title: `${page.title} · Docs`, description: page.description } : {};
}

export default async function DocPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const page = docBySlug((await params).slug);
  if (!page) notFound();
  return <DocArticle page={page} />;
}
