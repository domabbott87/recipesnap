import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users ──────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  plan: text("plan").notNull().default("free"),   // "free" | "premium"
  preferences: text("preferences").default("{}"), // JSON: UserPreferences
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export interface UserPreferences {
  units: "metric" | "us";
  defaultServes: number;
  dietary: string[];
  cuisines: string[];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  units: "metric",
  defaultServes: 4,
  dietary: [],
  cuisines: [],
};

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Recipes ───────────────────────────────────────────────────────────────
export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),                     // null = legacy / unowned
  title: text("title").notNull(),
  source: text("source"),
  serves: integer("serves").default(4),
  prepTime: text("prep_time"),
  cookTime: text("cook_time"),
  ingredients: text("ingredients").notNull().default("[]"),
  steps: text("steps").notNull().default("[]"),
  tags: text("tags").notNull().default("[]"),
  isFavourite: integer("is_favourite", { mode: "boolean" }).default(false),
  sourceText: text("source_text"),
  imageDataUrl: text("image_data_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({ id: true, createdAt: true });
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

// ── Constants ─────────────────────────────────────────────────────────────
export const FREE_RECIPE_LIMIT = 10;
