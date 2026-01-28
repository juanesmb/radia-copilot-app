CREATE TABLE user_monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  period_start DATE NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  chat_token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_start)
);

ALTER TABLE user_monthly_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON user_monthly_usage FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own usage"
  ON user_monthly_usage FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own usage"
  ON user_monthly_usage FOR UPDATE
  USING (auth.uid()::text = user_id);
