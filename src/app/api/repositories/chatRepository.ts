import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";

export interface ChatSessionData {
  user_id: string;
  title?: string | null;
  model: string;
  report_id?: string | null;
  message_count?: number;
  token_count?: number;
  max_tokens?: number | null;
  last_message_at?: string | null;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  model: string;
  report_id: string | null;
  message_count: number | null;
  token_count: number | null;
  max_tokens: number | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageData {
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  token_count?: number | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  token_count: number | null;
  created_at: string;
}

export interface ChatRepository {
  createSession(data: ChatSessionData): Promise<ChatSession>;
  listSessions(userId: string): Promise<ChatSession[]>;
  getSession(userId: string, sessionId: string): Promise<ChatSession>;
  listMessages(sessionId: string): Promise<ChatMessage[]>;
  createMessage(userId: string, data: ChatMessageData): Promise<ChatMessage>;
  updateSession(sessionId: string, userId: string, updates: Partial<ChatSessionData>): Promise<ChatSession>;
}

type Dependencies = {
  supabaseClient: SupabaseClient;
};

export const createChatRepository = (deps: Dependencies): ChatRepository => {
  const { supabaseClient } = deps;

  return {
    async createSession(data: ChatSessionData): Promise<ChatSession> {
      try {
        const { data: session, error } = await supabaseClient
          .from("chat_sessions")
          .insert({
            ...data,
            message_count: data.message_count ?? 0,
            token_count: data.token_count ?? 0,
            last_message_at: data.last_message_at ?? new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          throw new HttpError(`Failed to create chat session: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!session) {
          throw new HttpError("Failed to create chat session: No data returned", {
            status: 500,
          });
        }

        return session as ChatSession;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to create chat session", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async listSessions(userId: string): Promise<ChatSession[]> {
      try {
        const { data: sessions, error } = await supabaseClient
          .from("chat_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (error) {
          throw new HttpError(`Failed to fetch chat sessions: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return (sessions || []) as ChatSession[];
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to fetch chat sessions", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async getSession(userId: string, sessionId: string): Promise<ChatSession> {
      try {
        const { data: session, error } = await supabaseClient
          .from("chat_sessions")
          .select("*")
          .eq("id", sessionId)
          .eq("user_id", userId)
          .single();

        if (error || !session) {
          throw new HttpError("Chat session not found", { status: 404 });
        }

        return session as ChatSession;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to fetch chat session", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async listMessages(sessionId: string): Promise<ChatMessage[]> {
      try {
        const { data: messages, error } = await supabaseClient
          .from("chat_messages")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });

        if (error) {
          throw new HttpError(`Failed to fetch chat messages: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return (messages || []) as ChatMessage[];
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to fetch chat messages", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async createMessage(userId: string, data: ChatMessageData): Promise<ChatMessage> {
      try {
        const { data: session, error: sessionError } = await supabaseClient
          .from("chat_sessions")
          .select("id, user_id, message_count, token_count")
          .eq("id", data.session_id)
          .single();

        if (sessionError || !session) {
          throw new HttpError("Chat session not found", { status: 404 });
        }

        if (session.user_id !== userId) {
          throw new HttpError("Unauthorized: You do not own this chat", {
            status: 403,
          });
        }

        const { data: message, error } = await supabaseClient
          .from("chat_messages")
          .insert({
            ...data,
            token_count: data.token_count ?? 0,
          })
          .select()
          .single();

        if (error) {
          throw new HttpError(`Failed to create chat message: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!message) {
          throw new HttpError("Failed to create chat message: No data returned", {
            status: 500,
          });
        }

        const nextCount = (session.message_count ?? 0) + 1;
        const nextTokens = (session.token_count ?? 0) + (data.token_count ?? 0);
        await supabaseClient
          .from("chat_sessions")
          .update({
            message_count: nextCount,
            token_count: nextTokens,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.session_id);

        return message as ChatMessage;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to create chat message", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },

    async updateSession(
      sessionId: string,
      userId: string,
      updates: Partial<ChatSessionData>
    ): Promise<ChatSession> {
      try {
        const { data: existingSession, error: fetchError } = await supabaseClient
          .from("chat_sessions")
          .select("user_id")
          .eq("id", sessionId)
          .single();

        if (fetchError || !existingSession) {
          throw new HttpError("Chat session not found", { status: 404 });
        }

        if (existingSession.user_id !== userId) {
          throw new HttpError("Unauthorized: You do not own this chat", {
            status: 403,
          });
        }

        const { data: session, error } = await supabaseClient
          .from("chat_sessions")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) {
          throw new HttpError(`Failed to update chat session: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!session) {
          throw new HttpError("Failed to update chat session: No data returned", {
            status: 500,
          });
        }

        return session as ChatSession;
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        throw new HttpError("Failed to update chat session", {
          status: 500,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
};
