CREATE TABLE templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_type VARCHAR(100) NOT NULL,
  language VARCHAR(2) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(study_type, language)
);

-- Index on language for query performance
CREATE INDEX idx_templates_language ON templates(language);

-- Note: RLS policies can be added later if admin access is needed
