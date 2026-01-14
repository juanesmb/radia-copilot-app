import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

import { generateReportHandler } from "./handler";
import { generateReportStreamHandler } from "./streamHandler";

export async function POST(request: NextRequest) {
  // Check if streaming is requested via query parameter or header
  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "true" || 
                 request.headers.get("accept")?.includes("text/event-stream");

  if (stream) {
    return generateReportStreamHandler(request);
  }

  return generateReportHandler(request);
}

