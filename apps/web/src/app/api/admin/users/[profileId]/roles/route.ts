import type { NextRequest } from "next/server";
import { z } from "zod";
import { ROLES } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import { grantRole, revokeRole } from "../../../../../../lib/admin/users";

export const dynamic = "force-dynamic";

const roleBodySchema = z.object({ role: z.enum(ROLES) });

/** Grants a role to this profile — idempotent if already active. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("profile", "configure");
    const supabase = await createServerSupabaseClient();
    const { profileId } = await params;
    const body: unknown = await request.json().catch(() => null);
    const input = roleBodySchema.parse(body);
    await grantRole(supabase, { profileId, role: input.role });
    return respondOk({ granted: true }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/** Revokes this profile's currently-active assignment of the given role. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("profile", "configure");
    const supabase = await createServerSupabaseClient();
    const { profileId } = await params;
    const body: unknown = await request.json().catch(() => null);
    const input = roleBodySchema.parse(body);
    await revokeRole(supabase, { profileId, role: input.role });
    return respondOk({ revoked: true }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
