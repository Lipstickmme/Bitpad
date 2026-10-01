import Link from "next/link";

/** The rocket mascot on its own: transparent white mark (720×567). `size` is the rendered height. */
export function Mark({ size = 18, className = "" }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mark.png" height={size} width={Math.round((size * 720) / 567)} alt="" className={`shrink-0 select-none ${className}`} draggable={false} />;
}

export function Logo({ size = 44, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Bitpad home">
      <Mark size={size} />
      {withText && <span className="text-lg font-extrabold tracking-[0.08em] max-[420px]:hidden">BITPAD</span>}
    </Link>
  );
}

export function TelegramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2 1.8 11.7c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z" />
    </svg>
  );
}

export function XIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.8 2.3h7l4.8 6.4 5.6-6.4Zm-1.2 17.9h1.9L7 4.2H5l12 16Z" />
    </svg>
  );
}

/** Chain marks for wallet rows and chain labels. */
export function TonIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5.1 4.5h13.8c1.2 0 1.9 1.3 1.3 2.3l-7 11.9c-.5.9-1.9.9-2.4 0L3.8 6.8c-.6-1 .1-2.3 1.3-2.3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 4.5v14.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
export function SolanaIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M6.4 15.6c.1-.1.3-.2.5-.2h13.6c.3 0 .5.4.2.6l-2.9 2.9c-.1.1-.3.2-.5.2H3.7c-.3 0-.5-.4-.2-.6l2.9-2.9ZM6.4 4.7c.2-.1.3-.2.5-.2h13.6c.3 0 .5.4.2.6l-2.9 2.9c-.1.1-.3.2-.5.2H3.7c-.3 0-.5-.4-.2-.6l2.9-2.9ZM17.6 10.1c-.1-.1-.3-.2-.5-.2H3.5c-.3 0-.5.4-.2.6l2.9 2.9c.1.1.3.2.5.2h13.6c.3 0 .5-.4.2-.6l-2.9-2.9Z" />
    </svg>
  );
}
export function EthIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2 5.5 12.3 12 16l6.5-3.7L12 2Z" opacity=".9" />
      <path d="M12 17.3 5.5 13.6 12 22l6.5-8.4-6.5 3.7Z" opacity=".6" />
    </svg>
  );
}
