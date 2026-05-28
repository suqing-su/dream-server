-- dream-server schema migration
-- Mirror of initDB() from index.js

CREATE TABLE IF NOT EXISTS dream_events (
  id SERIAL PRIMARY KEY,
  type TEXT,
  value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_chapters (
  id SERIAL PRIMARY KEY,
  book TEXT,
  chapter_num INTEGER,
  title TEXT,
  content TEXT
);

CREATE TABLE IF NOT EXISTS book_notes (
  id SERIAL PRIMARY KEY,
  book TEXT,
  chapter_num INTEGER,
  author TEXT,
  type TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_progress (
  id SERIAL PRIMARY KEY,
  book TEXT,
  author TEXT,
  chapter_num INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dream_memo (
  id SERIAL PRIMARY KEY,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dream_board (
  id SERIAL PRIMARY KEY,
  from_who TEXT,
  content TEXT,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Fix the bug from original code: ON CONFLICT DO NOTHING needs a unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS book_progress_unique
  ON book_progress (book, author, chapter_num);
