import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "../lib/errorHandler";
import type { Language } from "../types/language";
import type { Template } from "../types/template";
import { getTableName } from "../lib/tableUtils";

export interface TemplateRepository {
  getSystemTemplate(studyType: string, language: Language): Promise<Template | null>;
  getPreferredTemplate(
    userId: string,
    studyType: string,
    language: Language,
    opts?: { useDefault?: boolean }
  ): Promise<Template | null>;
  hasCustomTemplate(userId: string, studyType: string, language: Language): Promise<boolean>;
  createCustomTemplateFromSystem(
    userId: string,
    studyType: string,
    language: Language,
    content: string
  ): Promise<Template>;
  updateCustomTemplateContent(userId: string, templateId: string, content: string): Promise<void>;
  setTemplatePreference(
    userId: string,
    studyType: string,
    language: Language,
    preference: { preferred_template_id: string | null; use_default: boolean }
  ): Promise<void>;
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

  const getSystemTemplate = async (
    studyType: string,
    language: Language
  ): Promise<Template | null> => {
    try {
      const { data: template, error } = await supabaseClient
        .from(getTableName("templates"))
        .select("*")
        .eq("study_type", studyType)
        .eq("language", language)
        .eq("is_system", true)
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
  };

  const setTemplatePreference = async (
    userId: string,
    studyType: string,
    language: Language,
    preference: { preferred_template_id: string | null; use_default: boolean }
  ): Promise<void> => {
    try {
      // Validate that the preferred template (when provided) belongs to this user
      // or is a system template. This prevents leaking or referencing other users'
      // custom templates when using the service-role key.
      if (preference.preferred_template_id) {
        const { data: ownerCheck, error: ownerError } = await supabaseClient
          .from(getTableName("templates"))
          .select("template_id")
          .eq("template_id", preference.preferred_template_id)
          .or(`user_id.eq.${userId},is_system.eq.true`)
          .maybeSingle();

        if (ownerError) {
          throw new HttpError(`Failed to validate preferred template: ${ownerError.message}`, {
            status: 500,
            details: ownerError.code,
          });
        }

        if (!ownerCheck) {
          throw new HttpError("Preferred template does not belong to the current user.", {
            status: 403,
          });
        }
      }

      const { error } = await supabaseClient
        .from(getTableName("template_preferences"))
        .upsert(
          {
            user_id: userId,
            study_type: studyType,
            language,
            preferred_template_id: preference.preferred_template_id,
            use_default: preference.use_default,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,study_type,language",
          }
        );

      if (error) {
        throw new HttpError(`Failed to set template preference: ${error.message}`, {
          status: 500,
          details: error.code,
        });
      }
    } catch (error) {
      return handleSupabaseError(error, "set template preference", "Failed to set template preference");
    }
  };

  return {
    getSystemTemplate,

    async getPreferredTemplate(
      userId: string,
      studyType: string,
      language: Language,
      opts?: { useDefault?: boolean }
    ): Promise<Template | null> {
      try {
        const useDefault = Boolean(opts?.useDefault);

        if (!useDefault) {
          const { data: pref, error: prefError } = await supabaseClient
            .from(getTableName("template_preferences"))
            .select("preferred_template_id, use_default")
            .eq("user_id", userId)
            .eq("study_type", studyType)
            .eq("language", language)
            .maybeSingle();

          if (prefError) {
            throw new HttpError(`Failed to fetch template preference: ${prefError.message}`, {
              status: 500,
              details: prefError.code,
            });
          }

          if (pref?.use_default) {
            // Fall through to system template
          } else if (pref?.preferred_template_id) {
            const { data: preferred, error: preferredError } = await supabaseClient
              .from(getTableName("templates"))
              .select("*")
              .eq("template_id", pref.preferred_template_id)
              // Ensure we only ever load templates owned by this user or system templates.
              .or(`user_id.eq.${userId},is_system.eq.true`)
              .maybeSingle();

            if (preferredError) {
              throw new HttpError(`Failed to fetch preferred template: ${preferredError.message}`, {
                status: 500,
                details: preferredError.code,
              });
            }

            if (preferred) {
              return preferred as Template;
            }
          } else {
            // If no explicit preference, try the latest custom for this user
            const { data: latestCustom, error: latestError } = await supabaseClient
              .from(getTableName("templates"))
              .select("*")
              .eq("user_id", userId)
              .eq("study_type", studyType)
              .eq("language", language)
              .eq("is_system", false)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestError) {
              throw new HttpError(`Failed to fetch latest custom template: ${latestError.message}`, {
                status: 500,
                details: latestError.code,
              });
            }

            if (latestCustom) {
              return latestCustom as Template;
            }
          }
        }

        return await getSystemTemplate(studyType, language);
      } catch (error) {
        return handleSupabaseError(error, "fetch preferred template", "Failed to fetch preferred template");
      }
    },

    async hasCustomTemplate(userId: string, studyType: string, language: Language): Promise<boolean> {
      try {
        const { data, error } = await supabaseClient
          .from(getTableName("templates"))
          .select("template_id")
          .eq("user_id", userId)
          .eq("study_type", studyType)
          .eq("language", language)
          .eq("is_system", false)
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new HttpError(`Failed to check custom template existence: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        return Boolean(data);
      } catch (error) {
        return handleSupabaseError(
          error,
          "check custom template existence",
          "Failed to check custom template existence"
        );
      }
    },

    async createCustomTemplateFromSystem(
      userId: string,
      studyType: string,
      language: Language,
      content: string
    ): Promise<Template> {
      try {
        const systemTemplate = await getSystemTemplate(studyType, language);
        if (!systemTemplate) {
          throw new HttpError(`System template not found for study type "${studyType}"`, { status: 404 });
        }

        const insertPayload = {
          study_type: systemTemplate.study_type,
          language: systemTemplate.language,
          content,
          is_system: false,
          user_id: userId,
        };

        const { data: created, error: insertError } = await supabaseClient
          .from(getTableName("templates"))
          .insert(insertPayload)
          .select("*")
          .single();

        if (insertError || !created) {
          throw new HttpError(`Failed to create custom template: ${insertError?.message ?? "No data returned"}`, {
            status: 500,
            details: insertError?.code,
          });
        }

        // Persist preference to use this new template by default for this user+study+language
        await setTemplatePreference(userId, studyType, language, {
          preferred_template_id: created.template_id as string,
          use_default: false,
        });

        return created as Template;
      } catch (error) {
        return handleSupabaseError(error, "create custom template", "Failed to create custom template");
      }
    },

    async updateCustomTemplateContent(userId: string, templateId: string, content: string): Promise<void> {
      try {
        const trimmed = content.trim();

        const { data, error } = await supabaseClient
          .from(getTableName("templates"))
          .update({ content: trimmed, updated_at: new Date().toISOString() })
          .eq("template_id", templateId)
          .eq("user_id", userId)
          .eq("is_system", false)
          .select("template_id")
          .maybeSingle();

        if (error) {
          throw new HttpError(`Failed to update custom template: ${error.message}`, {
            status: 500,
            details: error.code,
          });
        }

        if (!data) {
          throw new HttpError("Custom template not found", { status: 404 });
        }
      } catch (error) {
        return handleSupabaseError(error, "update custom template", "Failed to update custom template");
      }
    },

    setTemplatePreference,

    async templateExists(studyType: string, language: Language): Promise<boolean> {
      try {
        const { data, error } = await supabaseClient
          .from(getTableName("templates"))
          .select("template_id")
          .eq("study_type", studyType)
          .eq("language", language)
          .eq("is_system", true)
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
          .from(getTableName("templates"))
          .select("study_type")
          .eq("language", language)
          .eq("is_system", true)
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
