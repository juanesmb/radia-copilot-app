CREATE TABLE reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL, -- Clerk JWT sub claim
  generated_transcription TEXT NOT NULL,
  updated_transcription TEXT NOT NULL,
  report_title VARCHAR(500),
  generated_report TEXT NOT NULL,
  updated_report TEXT NOT NULL,
  used_template VARCHAR(100) NOT NULL,
  study_type VARCHAR(100),
  detection_confidence DECIMAL(3,2),
  model_used VARCHAR(50) NOT NULL,
  language VARCHAR(2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Note: Indexes will be added later if needed for performance

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  USING (auth.uid()::text = user_id);

