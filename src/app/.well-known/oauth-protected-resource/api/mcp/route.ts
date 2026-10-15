import { CORS, originOf, resourceMetadata } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return Response.json(resourceMetadata(originOf(req)), { headers: CORS });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
