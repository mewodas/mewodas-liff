ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS env text;
CREATE INDEX IF NOT EXISTS idx_audit_log_env_ts ON audit_log (env, ts DESC);
