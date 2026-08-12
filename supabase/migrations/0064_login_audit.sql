-- V-015: Login audit log — tracks authentication attempts for brute-force
-- detection and incident response. Insert-only; no user can modify rows.
-- Only coordenador_geral can read (same pattern as audit_log in 0059).

CREATE TABLE IF NOT EXISTS login_audit (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL,
  ip         text,
  user_agent text,
  success    boolean NOT NULL DEFAULT false,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by email + time range (lockout detection, reporting).
CREATE INDEX IF NOT EXISTS idx_login_audit_email_time
  ON login_audit (email, created_at DESC);

-- Index for IP-based anomaly detection.
CREATE INDEX IF NOT EXISTS idx_login_audit_ip_time
  ON login_audit (ip, created_at DESC);

-- RLS: only coordenador_geral can read; no direct writes (function only).
ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login_audit_select_coordinator"
  ON login_audit
  FOR SELECT
  TO authenticated
  USING (has_role('coordenador_geral'));

-- No INSERT/UPDATE/DELETE policies — inserts happen via SECURITY DEFINER function.

-- SECURITY DEFINER function to record login attempts (bypasses RLS for inserts).
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email text,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_success boolean DEFAULT false,
  p_error_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO login_audit (email, ip, user_agent, success, error_code)
  VALUES (p_email, p_ip, p_user_agent, p_success, p_error_code);
END;
$$;

REVOKE ALL ON FUNCTION record_login_attempt(text, text, text, boolean, text) FROM public;
REVOKE ALL ON FUNCTION record_login_attempt(text, text, text, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION record_login_attempt(text, text, text, boolean, text) TO authenticated;

-- Auto-cleanup: delete records older than 90 days (run via pg_cron if available,
-- or as a periodic Supabase Edge Function). For now, this is a manual option:
-- SELECT delete_old_login_audit(90);
CREATE OR REPLACE FUNCTION delete_old_login_audit(days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM login_audit WHERE created_at < now() - (days || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION delete_old_login_audit(integer) FROM public;
REVOKE ALL ON FUNCTION delete_old_login_audit(integer) FROM anon;
GRANT EXECUTE ON FUNCTION delete_old_login_audit(integer) TO service_role;

COMMENT ON TABLE login_audit IS 'V-015: Authentication attempt log for brute-force detection and incident response.';
COMMENT ON FUNCTION record_login_attempt IS 'V-015: SECURITY DEFINER — records a login attempt (success or failure).';
