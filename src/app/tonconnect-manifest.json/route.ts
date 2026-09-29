import { NextResponse, type NextRequest } from "next/server";

/** TON Connect manifest — served from whatever origin the app runs on. */
export function GET(req: NextRequest) {
  const url = req.nextUrl.origin;
  return NextResponse.json(
    { url, name: "Bitpad", iconUrl: `${url}/icon-180.png`, termsOfUseUrl: `${url}/terms`, privacyPolicyUrl: `${url}/terms` },
    { headers: { "access-control-allow-origin": "*" } },
  );
}
