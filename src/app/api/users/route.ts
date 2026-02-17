import type { NextRequest } from "next/server";

import { registerUserHandler } from "./handler";

export async function POST(request: NextRequest) {
  return registerUserHandler(request);
}
