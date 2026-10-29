CREATE TABLE drink_logs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,day TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX drink_logs_day ON drink_logs(day);
