import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseClient } from "../clients/supabaseClient";
import { mapErrorToResponse } from "../lib/errorHandler";
import { createUserRepository } from "../repositories/userRepository";
import { createCreateUserUseCase } from "./usecase";

const supabaseClient = createSupabaseClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
});

const userRepository = createUserRepository(
  supabaseClient.getClient()
);

const createUserUseCase = createCreateUserUseCase({
  userRepository,
});

export const registerUserHandler = async (request: NextRequest) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    if (typeof payload !== "object" || payload === null) {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    const payloadRecord = payload as Record<string, unknown>;
    const email = typeof payloadRecord.email === "string" ? payloadRecord.email : null;
    const language = typeof payloadRecord.language === "string" ? payloadRecord.language : "es";

    if (!email) {
      return NextResponse.json({ message: "email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Invalid email format" }, { status: 400 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[registerUserHandler] Received payload:", {
        email,
        language,
      });
    }

    const result = await createUserUseCase.execute({ email, language });
    
    return NextResponse.json({
      user: result.user,
      isNewUser: result.isNewUser,
      message: result.isNewUser ? "User registered successfully" : "User already exists"
    }, { status: result.isNewUser ? 201 : 200 });
  } catch (error) {
    console.error("[registerUserHandler] Error:", error);
    const mapped = mapErrorToResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
};
