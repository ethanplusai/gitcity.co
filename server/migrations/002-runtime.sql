CREATE TABLE sessions (id text PRIMARY KEY, payload text NOT NULL, expires bigint NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE TABLE oauth_states (id text PRIMARY KEY, payload text NOT NULL, expires bigint NOT NULL);
CREATE INDEX oauth_states_expiry ON oauth_states(expires);
CREATE TABLE sync_jobs (login text PRIMARY KEY, state text NOT NULL, lease text, lease_until bigint NOT NULL DEFAULT 0);
CREATE TABLE repo_cache (key text PRIMARY KEY, payload text NOT NULL, expires bigint NOT NULL);
CREATE INDEX repo_cache_expiry ON repo_cache(expires);
