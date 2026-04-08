import { db } from "./db";
import { recipes, users, type Recipe, type InsertRecipe, type User, type InsertUser } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserByEmail(email: string): User | undefined;
  getUserById(id: number): User | undefined;
  createUser(data: InsertUser): User;
  updateUserPlan(id: number, plan: "free" | "premium"): User | undefined;
  updateUserName(id: number, name: string): User | undefined;
  updateUserPreferences(id: number, preferences: string): User | undefined;

  // Recipes (always scoped to a userId)
  getAllRecipes(userId: number): Recipe[];
  countRecipes(userId: number): number;
  getRecipe(id: number, userId: number): Recipe | undefined;
  createRecipe(data: InsertRecipe): Recipe;
  updateRecipe(id: number, userId: number, data: Partial<InsertRecipe>): Recipe | undefined;
  deleteRecipe(id: number, userId: number): boolean;
}

export class DatabaseStorage implements IStorage {
  // ── Users ──────────────────────────────────────────────────────────────
  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  getUserById(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  createUser(data: InsertUser): User {
    return db.insert(users).values(data).returning().get();
  }
  updateUserPlan(id: number, plan: "free" | "premium"): User | undefined {
    return db.update(users).set({ plan }).where(eq(users.id, id)).returning().get();
  }
  updateUserName(id: number, name: string): User | undefined {
    return db.update(users).set({ name }).where(eq(users.id, id)).returning().get();
  }
  updateUserPreferences(id: number, preferences: string): User | undefined {
    return db.update(users).set({ preferences }).where(eq(users.id, id)).returning().get();
  }

  // ── Recipes ────────────────────────────────────────────────────────────
  getAllRecipes(userId: number): Recipe[] {
    return db.select().from(recipes)
      .where(eq(recipes.userId, userId))
      .all()
      .reverse();
  }
  countRecipes(userId: number): number {
    return db.select().from(recipes).where(eq(recipes.userId, userId)).all().length;
  }
  getRecipe(id: number, userId: number): Recipe | undefined {
    return db.select().from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .get();
  }
  createRecipe(data: InsertRecipe): Recipe {
    return db.insert(recipes).values(data).returning().get();
  }
  updateRecipe(id: number, userId: number, data: Partial<InsertRecipe>): Recipe | undefined {
    const existing = this.getRecipe(id, userId);
    if (!existing) return undefined;
    return db.update(recipes).set(data)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .returning().get();
  }
  deleteRecipe(id: number, userId: number): boolean {
    const result = db.delete(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .run();
    return result.changes > 0;
  }
}

export const storage = new DatabaseStorage();
