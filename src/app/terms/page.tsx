export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <article className="card mx-auto max-w-2xl space-y-3 p-6 text-sm text-ink-2">
      <h1 className="text-xl font-semibold text-ink">Terms & risk disclosure</h1>
      <p>Bitpad is non-custodial software. You sign every transaction in your own wallet; bundle wallets are generated and encrypted in your browser.</p>
      <p>Tokens launched on Bitpad are created by third parties. Pairing a token with a stock, commodity or other asset does not give holders any claim on that asset, its issuer, or its dividends beyond what the pool contract holds.</p>
      <p>Prices and analytics come from third-party public APIs and may be delayed or unavailable. Nothing here is investment advice.</p>
      <p>Tokenized stocks may be unavailable in some jurisdictions. You are responsible for complying with the laws that apply to you.</p>
    </article>
  );
}
