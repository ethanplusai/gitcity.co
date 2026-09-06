ALTER TABLE repo_cache ADD COLUMN lease text;
ALTER TABLE repo_cache ADD COLUMN lease_until bigint NOT NULL DEFAULT 0;
CREATE TABLE request_limits (key text PRIMARY KEY, count integer NOT NULL, expires bigint NOT NULL);
CREATE INDEX request_limits_expiry ON request_limits(expires);
