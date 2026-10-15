import {
  boolean,
  index,
  primaryKey,
  real,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Clés API et réglages, valeurs chiffrées (AES-256-GCM) — voir lib/crypto.ts
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const models = pgTable("models", {
  id: text("id").primaryKey(), // identifiant Kie envoyé dans `model`, ex: nano-banana-2
  name: text("name").notNull(),
  provider: text("provider"),
  description: text("description"),
  category: text("category", { enum: ["image", "video", "audio"] }).notNull(),
  docUrl: text("doc_url").notNull().unique(),
  inputSchema: jsonb("input_schema").notNull(), // schéma OpenAPI de `input`
  requiredInputs: jsonb("required_inputs").$type<string[]>().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    modelId: text("model_id").notNull(),
    input: jsonb("input").notNull(),
    taskId: text("task_id"),
    state: text("state").notNull().default("waiting"), // waiting|queuing|generating|success|fail
    resultUrls: jsonb("result_urls").$type<string[]>(), // URLs Kie (expirent ~24h)
    storedUrls: jsonb("stored_urls").$type<string[]>(), // URLs après copie vers le stockage
    error: text("error"),
    kept: boolean("kept").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
    credits: real("credits"), // crédits Kie réellement débités
  },
  (t) => [index("generations_user_idx").on(t.userId), index("generations_task_idx").on(t.taskId)],
);

// Jetons d'accès pour le serveur MCP / API (stockés hachés, jamais en clair)
export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

// Modèles favoris, par utilisateur
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.modelId] })],
);

// OAuth 2.1 pour le connecteur MCP (claude.ai, Claude Desktop, ChatGPT…) — voir lib/oauth.ts
export const oauthClients = pgTable("oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name"),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const oauthCodes = pgTable("oauth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    kind: text("kind", { enum: ["access", "refresh"] }).notNull(),
    clientId: text("client_id").notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (t) => [index("oauth_tokens_user_idx").on(t.userId)],
);
