export const MEMBER_ALLOWED_TTL_MS = 15_000;
export const MEMBER_DENIED_TTL_MS = 5_000;

type CacheEntry = { allowed: boolean; expiresAt: number };

const membershipCache = new Map<string, CacheEntry>();

export function spaceMemberDocumentUrl(projectId: string, spaceId: string, uid: string): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/spaces/${encodeURIComponent(spaceId)}/space_members/${encodeURIComponent(uid)}`;
}

export function interpretMembershipStatus(status: number): boolean {
  return status === 200;
}

function cacheKey(spaceId: string, uid: string): string {
  return `${spaceId}:${uid}`;
}

export function clearMembershipCache(): void {
  membershipCache.clear();
}

export async function lookupSpaceMembership(args: {
  projectId: string;
  idToken: string;
  spaceId: string;
  uid: string;
  now?: number;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const now = args.now ?? Date.now();
  const key = cacheKey(args.spaceId, args.uid);
  const hit = membershipCache.get(key);
  if (hit && hit.expiresAt > now) return hit.allowed;

  const url = spaceMemberDocumentUrl(args.projectId, args.spaceId, args.uid);
  let allowed = false;
  try {
    const response = await (args.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${args.idToken}` },
    });
    allowed = interpretMembershipStatus(response.status);
  } catch {
    allowed = false;
  }

  membershipCache.set(key, {
    allowed,
    expiresAt: now + (allowed ? MEMBER_ALLOWED_TTL_MS : MEMBER_DENIED_TTL_MS),
  });
  return allowed;
}

export function firestoreStringField(payload: unknown, field: string): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const fields = (payload as { fields?: Record<string, { stringValue?: unknown }> }).fields;
  const value = fields?.[field]?.stringValue;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function spaceMemoryDocumentUrl(projectId: string, spaceId: string, memoryId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/spaces/${encodeURIComponent(spaceId)}/memories/${encodeURIComponent(memoryId)}`;
}

export async function lookupMemoryAuthorUid(args: {
  projectId: string;
  idToken: string;
  spaceId: string;
  memoryId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ exists: boolean; createdByUid: string | null }> {
  const url = spaceMemoryDocumentUrl(args.projectId, args.spaceId, args.memoryId);
  try {
    const response = await (args.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${args.idToken}` },
    });
    if (response.status === 404) return { exists: false, createdByUid: null };
    if (response.status !== 200) return { exists: true, createdByUid: null };
    const payload = await response.json().catch(() => null);
    return { exists: true, createdByUid: firestoreStringField(payload, 'createdByUid') };
  } catch {
    return { exists: true, createdByUid: null };
  }
}
