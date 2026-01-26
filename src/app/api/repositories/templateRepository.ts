import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";
import type { Language } from "../types/language";
import type { Template } from "../types/template";

export interface TemplateRepository {
  getTemplate(studyType: string, language: Language): Promise<Template | null>;
  templateExists(studyType: string, language: Language): Promise<boolean>;
  listAvailableTemplates(language: Language): Promise<string[]>;
}

type Dependencies = {
  supabaseClient: SupabaseClient;
};

const NO_ROWS_ERROR_CODE = "PGRST116";

const handleSupabaseError = (
  error: unknown,
  operation: string,
  defaultMessage: string
): never => {
  if (error instanceof HttpError) {
    throw error;
  }

  const message = error instanceof Error ? error.message : defaultMessage;
  throw new HttpError(`Failed to ${operation}: ${message}`, {
    status: 500,
    details: error instanceof Error ? message : undefined,
  });
};

export const createTemplateRepository = (deps: Dependencies): TemplateRepository => {
  const { supabaseClient } = deps;

  return {
    async getTemplate(studyType: string, language: Language): Promise<Template | null> {
      try {
        const { data: template, error } = await supabaseClient
          .from("templates")
          .select("*")
          .eq("study_type", studyType)
          .eq("language", language)
          .single();

        if (error) {
          if (error.code === NO_ROWS_ERROR_CODE) {
            return null;
          }
          throw new HttpError(`Failed to fetch template: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return template as Template | null;
      } catch (error) {
        return handleSupabaseError(error, "fetch template", "Failed to fetch template");
      }
    },

    async templateExists(studyType: string, language: Language): Promise<boolean> {
      try {
        const { data, error } = await supabaseClient
          .from("templates")
          .select("template_id")
          .eq("study_type", studyType)
          .eq("language", language)
          .maybeSingle();

        if (error) {
          throw new HttpError(`Failed to check template existence: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return data !== null;
      } catch (error) {
        return handleSupabaseError(
          error,
          "check template existence",
          "Failed to check template existence"
        );
      }
    },

    async listAvailableTemplates(language: Language): Promise<string[]> {
      try {
        const { data: templates, error } = await supabaseClient
          .from("templates")
          .select("study_type")
          .eq("language", language)
          .order("study_type", { ascending: true });

        if (error) {
          throw new HttpError(`Failed to list templates: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return (templates || []).map((t) => t.study_type);
      } catch (error) {
        return handleSupabaseError(error, "list templates", "Failed to list templates");
      }
    },
  };
};
