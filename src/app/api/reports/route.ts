import type { NextRequest } from "next/server";

import { getReportsHandler } from "./handler";

export async function GET(request: NextRequest) {
  return getReportsHandler(request);
}

