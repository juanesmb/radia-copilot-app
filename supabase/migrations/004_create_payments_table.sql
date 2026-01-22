CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255),
  stripe_price_id VARCHAR(255),
  stripe_product_id VARCHAR(255),
  plan_key VARCHAR(50),
  plan_name VARCHAR(150),
  status VARCHAR(50) NOT NULL,
  amount_total INTEGER,
  currency VARCHAR(10),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP,
  latest_invoice_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX payments_user_id_idx ON payments (user_id);
CREATE INDEX payments_subscription_idx ON payments (stripe_subscription_id);
CREATE UNIQUE INDEX payments_subscription_unique_idx ON payments (stripe_subscription_id);
CREATE UNIQUE INDEX payments_customer_unique_idx ON payments (stripe_customer_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE
  USING (auth.uid()::text = user_id);
