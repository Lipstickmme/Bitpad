import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export function GET() {
  return NextResponse.json(
    { url: config.appUrl, name: "Bitpad", iconUrl: `${config.appUrl}/icon-180.png`, termsOfUseUrl: `${config.appUrl}/terms`, privacyPolicyUrl: `${config.appUrl}/terms` },
    { headers: { "access-control-allow-origin": "*" } },
  );
}
