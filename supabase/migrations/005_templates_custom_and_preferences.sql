ALTER TABLE templates
ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN user_id VARCHAR(255);

-- Existing templates are system templates
UPDATE templates SET is_system = TRUE, user_id = NULL WHERE is_system IS NULL OR is_system = FALSE;

-- Drop old unique constraint and replace with a unique index for system templates only
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_study_type_language_key;

CREATE UNIQUE INDEX IF NOT EXISTS templates_system_unique
ON templates (study_type, language)
WHERE is_system = TRUE;

CREATE INDEX IF NOT EXISTS idx_templates_user_study_language
ON templates (user_id, study_type, language);

CREATE TABLE IF NOT EXISTS template_preferences (
  user_id VARCHAR(255) NOT NULL,
  study_type VARCHAR(100) NOT NULL,
  language VARCHAR(2) NOT NULL,
  preferred_template_id UUID,
  use_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, study_type, language)
);

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS template_id UUID;
