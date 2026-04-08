import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";
import fs from "fs";

const dbDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(path.join(dbDir, "recipes.db"));
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// ── Bootstrap tables ────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    source TEXT,
    serves INTEGER DEFAULT 4,
    prep_time TEXT,
    cook_time TEXT,
    ingredients TEXT NOT NULL DEFAULT '[]',
    steps TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    is_favourite INTEGER DEFAULT 0,
    source_text TEXT,
    image_data_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// ── Migrations for existing databases ───────────────────────────────────
// Migrate users table
const userCols = sqlite.prepare("PRAGMA table_info(users)").all() as { name: string }[];
const userColNames = userCols.map(c => c.name);
if (!userColNames.includes("preferences")) sqlite.exec("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'");

// Migrate recipes table
const cols = sqlite.prepare("PRAGMA table_info(recipes)").all() as { name: string }[];
const colNames = cols.map((c) => c.name);
if (!colNames.includes("user_id"))      sqlite.exec("ALTER TABLE recipes ADD COLUMN user_id INTEGER");
if (!colNames.includes("source"))       sqlite.exec("ALTER TABLE recipes ADD COLUMN source TEXT");
if (!colNames.includes("serves"))       sqlite.exec("ALTER TABLE recipes ADD COLUMN serves INTEGER DEFAULT 4");
if (!colNames.includes("prep_time"))    sqlite.exec("ALTER TABLE recipes ADD COLUMN prep_time TEXT");
if (!colNames.includes("cook_time"))    sqlite.exec("ALTER TABLE recipes ADD COLUMN cook_time TEXT");
if (!colNames.includes("is_favourite")) sqlite.exec("ALTER TABLE recipes ADD COLUMN is_favourite INTEGER DEFAULT 0");
