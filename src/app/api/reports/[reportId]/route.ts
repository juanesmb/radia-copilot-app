import type { NextRequest } from "next/server";

import { updateReportHandler } from "./handler";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  return updateReportHandler(request, { params });
}

