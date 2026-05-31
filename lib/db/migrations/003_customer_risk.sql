CREATE TABLE IF NOT EXISTS customer_risk (
  tenant_id text NOT NULL,
  customer_page_id text NOT NULL,
  line_user_id text,
  name text,
  store_id text,
  no_record boolean NOT NULL DEFAULT false,
  days_since_last_record int,
  weight_stalled boolean NOT NULL DEFAULT false,
  weekly_avgs jsonb,
  env text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, customer_page_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_risk_tenant ON customer_risk (tenant_id, env);
