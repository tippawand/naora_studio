import { NextResponse } from "next/server";
import { getCredits } from "@/lib/kie";
import { apiUser } from "@/lib/session";

export async function GET() {
  if (!(await apiUser())) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  try {
    return NextResponse.json({ credits: await getCredits() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
