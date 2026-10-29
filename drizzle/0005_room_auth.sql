CREATE TABLE room_accounts(id TEXT PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1);
CREATE TABLE room_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES room_accounts(id),expires INTEGER NOT NULL);
CREATE INDEX room_sessions_expires ON room_sessions(expires);
