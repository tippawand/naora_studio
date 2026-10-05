import { getSetting } from "./settings";

const BASE = "https://api.kie.ai/api/v1";

async function apiKey() {
  const k = await getSetting("kieApiKey");
  if (!k) throw new Error("Clé API Kie non configurée (Admin > Settings)");
  return k;
}

type Envelope<T> = { code: number; msg: string; data: T };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await apiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json || json.code !== 200) {
    throw new Error(json?.msg || `Kie API ${res.status}`);
  }
  return json.data;
}

export function createTask(model: string, input: unknown, callBackUrl?: string) {
  return call<{ taskId: string }>("/jobs/createTask", {
    method: "POST",
    body: JSON.stringify({ model, input, ...(callBackUrl ? { callBackUrl } : {}) }),
  });
}

export type KieTask = {
  taskId: string;
  model: string;
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultJson?: string;
  failMsg?: string;
  failCode?: string;
  costTime?: number;
  creditsConsumed?: number;
};

export function getTask(taskId: string) {
  return call<KieTask>(`/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
}

export function getCredits() {
  return call<number>("/chat/credit");
}

export function parseResultUrls(resultJson?: string): string[] {
  if (!resultJson) return [];
  try {
    const r = JSON.parse(resultJson);
    return Array.isArray(r.resultUrls) ? r.resultUrls : [];
  } catch {
    return [];
  }
}

/** Upload d'un fichier de référence chez Kie (multipart) ; renvoie l'URL à passer dans `input`. */
export async function uploadFile(file: File, uploadPath = "studio") {
  const form = new FormData();
  form.append("file", file);
  form.append("uploadPath", uploadPath);
  const res = await fetch("https://api.kie.ai/api/file-stream-upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${await apiKey()}` },
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.data?.downloadUrl) throw new Error(json?.msg || "Upload Kie échoué");
  return json.data.downloadUrl as string;
}
