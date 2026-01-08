CREATE TABLE report_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL, -- Clerk JWT sub claim
  report_id UUID NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  confidence INTEGER NOT NULL CHECK (confidence >= 1 AND confidence <= 5),
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for quick lookups by report_id
CREATE INDEX idx_report_feedback_report_id ON report_feedback(report_id);

-- Index for user_id lookups
CREATE INDEX idx_report_feedback_user_id ON report_feedback(user_id);

ALTER TABLE report_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON report_feedback FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view own feedback"
  ON report_feedback FOR SELECT
  USING (auth.uid()::text = user_id);

