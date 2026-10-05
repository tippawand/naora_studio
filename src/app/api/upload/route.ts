import { NextResponse } from "next/server";
import { uploadFile } from "@/lib/kie";
import { apiUser } from "@/lib/session";

export const maxDuration = 60;

// Envoie une image/vidéo de référence chez Kie et renvoie l'URL à mettre dans `input`.
// Limite pratique ~4,5 Mo par requête sur Vercel ; au-delà, coller une URL publique.
export async function POST(req: Request) {
  if (!(await apiUser())) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (file.size > 4_500_000) return NextResponse.json({ error: "Fichier trop volumineux (4,5 Mo max)" }, { status: 413 });
  if (!/^(image|video|audio)\//.test(file.type)) return NextResponse.json({ error: "Type de fichier non autorisé" }, { status: 415 });
  try {
    return NextResponse.json({ url: await uploadFile(file) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
