import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createReportRepository } from "../repositories/reportRepository";
import { createGetReportsUseCase } from "./usecase";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const reportRepository = createReportRepository({
  supabaseClient: supabaseClient.getClient(),
});

const useCase = createGetReportsUseCase({
  reportRepository,
});

export const getReportsHandler = async (request: NextRequest) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const reports = await useCase.execute(userId);
    return NextResponse.json(reports, { status: 200 });
  } catch (error) {
    console.error("[getReportsHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
};

