import { NextResponse } from "next/server";
import { healthResponseSchema } from "@mboyo/domain";

export function GET() {
  const payload = healthResponseSchema.parse({
    status: "ok",
    service: "apps/web",
    version: process.env.npm_package_version ?? "0.0.0",
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json(payload);
}
