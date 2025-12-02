import type { NextRequest } from "next/server";

import { generateReportHandler } from "./handler";

export async function POST(request: NextRequest) {
  return generateReportHandler(request);
}

