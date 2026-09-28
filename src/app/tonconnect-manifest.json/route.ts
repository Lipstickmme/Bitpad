import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";

/** TON Connect manifest — served from whatever origin the app runs on. */
export function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_APP_URL ? config.appUrl : req.nextUrl.origin;
  return NextResponse.json(
    { url, name: "Bitpad", iconUrl: `${url}/icon-180.png`, termsOfUseUrl: `${url}/terms`, privacyPolicyUrl: `${url}/terms` },
    { headers: { "access-control-allow-origin": "*" } },
  );
}
