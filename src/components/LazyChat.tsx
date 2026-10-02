"use client";
import dynamic from "next/dynamic";

/** Trench Chat (with its TON encoding code) loads after the page, not as part of every first paint. */
export const LazyChat = dynamic(() => import("./TrenchChat").then((m) => m.TrenchChat), { ssr: false });
