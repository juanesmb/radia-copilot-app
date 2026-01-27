import type { NextRequest } from "next/server";

import { createReportHandler, getReportsHandler } from "./handler";

export async function GET(request: NextRequest) {
  return getReportsHandler(request);
}

export async function POST(request: NextRequest) {
  return createReportHandler(request);
}
