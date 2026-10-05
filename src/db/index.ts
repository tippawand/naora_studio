import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: ReturnType<typeof create> | undefined;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  return drizzle(neon(url), { schema });
}

// Création paresseuse pour que `next build` ne plante pas sans variable d'env.
export const db = new Proxy({} as ReturnType<typeof create>, {
  get(_t, prop) {
    _db ??= create();
    return Reflect.get(_db, prop);
  },
});

export * from "./schema";
