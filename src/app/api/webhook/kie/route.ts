import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshByTaskId } from "@/lib/generations";
import { getSetting } from "@/lib/settings";

// Callback Kie. On ne fait pas confiance au contenu : on lit juste le taskId
// puis on relit l'état réel via recordInfo.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const taskId: string | undefined = body?.data?.taskId ?? body?.data?.task_id;
  if (!taskId) return NextResponse.json({ error: "taskId manquant" }, { status: 400 });

  const hmacKey = await getSetting("kieWebhookHmacKey");
  if (hmacKey) {
    const ts = req.headers.get("x-webhook-timestamp") ?? "";
    const sig = req.headers.get("x-webhook-signature") ?? "";
    const expected = createHmac("sha256", hmacKey).update(`${taskId}.${ts}`).digest("base64");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300;
    if (!fresh || a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }
  }
  await refreshByTaskId(taskId).catch(() => null);
  return NextResponse.json({ ok: true });
}
