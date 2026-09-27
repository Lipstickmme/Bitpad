import Link from "next/link";

export function Logo({ size = 32, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Bitpad home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" width={size} height={size} alt="" className="rounded-lg" />
      {withText && (
        <span className="text-[1.15rem] font-extrabold tracking-tight">
          Bit<span className="text-brand">pad</span>
        </span>
      )}
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
