CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  tenant_id TEXT,
  target_type TEXT,
  target_id TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log (tenant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action, ts DESC);
