import { parse } from "yaml";

const LLMS_URL = "https://docs.kie.ai/llms.txt";

export type CatalogEntry = {
  title: string;
  provider: string;
  category: "image" | "video" | "audio";
  docUrl: string;
};

export type ParsedModel = CatalogEntry & {
  id: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
  requiredInputs: string[];
};

/** Lit llms.txt et renvoie les pages candidates (image / vidéo / audio, hors chinois). */
export async function fetchCatalog(): Promise<CatalogEntry[]> {
  const res = await fetch(LLMS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`llms.txt: ${res.status}`);
  const text = await res.text();
  const out: CatalogEntry[] = [];
  const re = /^- (.+?) > (.+?) \[(.+?)\]\((https:\/\/docs\.kie\.ai\/(?!cn)[^)]+\.md)\)/gm;
  for (const m of text.matchAll(re)) {
    const head = m[1].trim().toLowerCase();
    const category = head.startsWith("image")
      ? "image"
      : head.startsWith("video")
        ? "video"
        : head.startsWith("audio") || head.startsWith("music") || head.startsWith("speech")
          ? "audio"
          : null;
    if (!category) continue;
    // Pages Market uniquement (les autres familles ont leurs propres endpoints : phase 2)
    if (!/\/market\/|\/\d+e0\.md$/.test(m[4])) continue;
    out.push({ title: m[3].trim(), provider: m[2].trim(), category, docUrl: m[4] });
  }
  return out;
}

type Json = Record<string, any>;

function deref(node: any, doc: Json, depth = 0): any {
  if (depth > 8 || node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => deref(n, doc, depth + 1));
  if (node.$ref && typeof node.$ref === "string" && node.$ref.startsWith("#/")) {
    const target = node.$ref
      .slice(2)
      .split("/")
      .reduce((o: any, k: string) => o?.[decodeURIComponent(k)], doc);
    return deref(target, doc, depth + 1);
  }
  const out: Json = {};
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("x-apidog") || k === "examples" || k === "example") continue;
    out[k] = deref(v, doc, depth + 1);
  }
  if (Array.isArray(out.allOf)) {
    const merged: Json = { ...out };
    delete merged.allOf;
    for (const part of out.allOf) {
      merged.properties = { ...merged.properties, ...part?.properties };
      merged.required = [...(merged.required ?? []), ...(part?.required ?? [])];
    }
    return merged;
  }
  return out;
}

/** Extrait le modèle Kie + le schéma `input` depuis une page de doc (spec OpenAPI en YAML). */
export function parseModelPage(md: string, entry: CatalogEntry): ParsedModel | null {
  const m = md.match(/```yaml\n([\s\S]*?)\n```/);
  if (!m) return null;
  let doc: Json;
  try {
    doc = parse(m[1]);
  } catch {
    return null;
  }
  const post = doc?.paths?.["/api/v1/jobs/createTask"]?.post;
  const schema = post?.requestBody?.content?.["application/json"]?.schema;
  if (!schema) return null;
  const body = deref(schema, doc);
  const modelProp = body.properties?.model;
  const id: string | undefined = modelProp?.enum?.[0] ?? modelProp?.default;
  let input = body.properties?.input;
  // oneOf/anyOf : on fusionne les variantes (propriétés en union, requis = intersection)
  const variants: Json[] | undefined = input?.oneOf ?? input?.anyOf;
  if (variants?.length) {
    const props: Json = {};
    for (const v of variants) Object.assign(props, v.properties);
    const req = (variants[0].required ?? []).filter((r: string) =>
      variants.every((v) => (v.required ?? []).includes(r)),
    );
    input = { type: "object", properties: props, required: req };
  }
  if (!id || !input?.properties) return null;
  // Description = texte avant le premier titre/bloc (le reste est du standard "Query Task Status…")
  const rawDesc = String(post?.description ?? "").split(/\n\s*(##|<Card|:::)/)[0].trim();
  return {
    ...entry,
    description: rawDesc, // "" si vide : distingue « pas de description » de « pas encore synchronisé »
    id,
    inputSchema: input,
    requiredInputs: Array.isArray(input.required) ? input.required : [],
  };
}

export async function fetchModelPage(entry: CatalogEntry): Promise<ParsedModel | null> {
  const res = await fetch(entry.docUrl, { cache: "no-store" });
  if (!res.ok) return null;
  return parseModelPage(await res.text(), entry);
}
