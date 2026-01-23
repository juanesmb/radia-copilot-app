import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL ? "✓" : "✗");
  console.error("  SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const templatesDir = join(process.cwd(), "src/app/api/templates");
const languages = ["en", "es"];

interface TemplateFile {
  studyType: string;
  language: string;
  content: string;
}

async function migrateTemplates() {
  console.log("Starting template migration...\n");

  const templates: TemplateFile[] = [];

  for (const language of languages) {
    const languageDir = join(templatesDir, language);
    
    if (!existsSync(languageDir)) {
      console.warn(`Directory not found: ${languageDir}`);
      continue;
    }

    const files = readdirSync(languageDir);
    const mdFiles = files.filter((file) => file.endsWith(".md") && !file.endsWith(".metadata.md"));

    for (const file of mdFiles) {
      const studyType = file.replace(".md", "");
      const filePath = join(languageDir, file);

      try {
        const content = readFileSync(filePath, "utf-8").trim();
        templates.push({
          studyType,
          language,
          content,
        });
        console.log(`✓ Loaded: ${studyType} (${language})`);
      } catch (error) {
        console.error(`✗ Failed to load ${filePath}:`, error);
      }
    }
  }

  console.log(`\nLoaded ${templates.length} templates\n`);
  console.log("Inserting into database...\n");

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const template of templates) {
    try {
      const { data, error } = await supabase
        .from("templates")
        .upsert(
          {
            study_type: template.studyType,
            language: template.language,
            content: template.content,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "study_type,language",
          }
        )
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation - already exists
          console.log(`⊘ Skipped (exists): ${template.studyType} (${template.language})`);
          skipCount++;
        } else {
          console.error(`✗ Error inserting ${template.studyType} (${template.language}):`, error.message);
          errorCount++;
        }
      } else {
        console.log(`✓ Inserted: ${template.studyType} (${template.language})`);
        successCount++;
      }
    } catch (error) {
      console.error(`✗ Unexpected error for ${template.studyType} (${template.language}):`, error);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("Migration Summary:");
  console.log(`  Success: ${successCount}`);
  console.log(`  Skipped: ${skipCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Total: ${templates.length}`);
  console.log("=".repeat(50));
}

migrateTemplates()
  .then(() => {
    console.log("\nMigration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nMigration failed:", error);
    process.exit(1);
  });
