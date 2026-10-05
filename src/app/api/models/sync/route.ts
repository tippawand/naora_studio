import { NextResponse } from "next/server";
import { apiUser } from "@/lib/session";
import { syncModels } from "@/lib/sync";

export const maxDuration = 60;

export async function POST() {
  if (!(await apiUser(true))) return NextResponse.json({ error: "Admin requis" }, { status: 403 });
  try {
    return NextResponse.json(await syncModels());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
