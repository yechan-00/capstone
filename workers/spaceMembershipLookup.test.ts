import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MEMBER_ALLOWED_TTL_MS,
  MEMBER_DENIED_TTL_MS,
  clearMembershipCache,
  interpretMembershipStatus,
  lookupMemoryAuthorUid,
  lookupSpaceMembership,
  spaceMemberDocumentUrl,
} from './spaceMembershipLookup.ts';

function jsonResponse(status: number, body?: unknown) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: body == null ? undefined : { 'Content-Type': 'application/json' },
  });
}

test('only HTTP 200 counts as current membership; errors deny access', () => {
  assert.equal(interpretMembershipStatus(200), true);
  for (const status of [0, 401, 403, 404, 500, 503]) {
    assert.equal(interpretMembershipStatus(status), false);
  }
});

test('membership lookup uses the caller token and self member path', async () => {
  clearMembershipCache();
  const calls: { url: string; authorization: string | null }[] = [];
  const allowed = await lookupSpaceMembership({
    projectId: 'demo',
    idToken: 'token-a',
    spaceId: 'space-a',
    uid: 'member-1',
    now: 1_000,
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        authorization: new Headers(init?.headers).get('Authorization'),
      });
      return jsonResponse(200);
    },
  });
  assert.equal(allowed, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.authorization, 'Bearer token-a');
  assert.equal(
    calls[0]?.url,
    spaceMemberDocumentUrl('demo', 'space-a', 'member-1'),
  );
});

test('non-member, other space, and Firestore failures are denied', async () => {
  clearMembershipCache();
  const denied = await lookupSpaceMembership({
    projectId: 'demo',
    idToken: 'token-b',
    spaceId: 'space-a',
    uid: 'outsider',
    now: 1_000,
    fetchImpl: async () => jsonResponse(404),
  });
  assert.equal(denied, false);

  const otherSpace = await lookupSpaceMembership({
    projectId: 'demo',
    idToken: 'token-a',
    spaceId: 'space-b',
    uid: 'member-1',
    now: 1_000,
    fetchImpl: async () => jsonResponse(404),
  });
  assert.equal(otherSpace, false);

  const failed = await lookupSpaceMembership({
    projectId: 'demo',
    idToken: 'token-a',
    spaceId: 'space-c',
    uid: 'member-1',
    now: 1_000,
    fetchImpl: async () => jsonResponse(500),
  });
  assert.equal(failed, false);

  const crashed = await lookupSpaceMembership({
    projectId: 'demo',
    idToken: 'token-a',
    spaceId: 'space-d',
    uid: 'member-1',
    now: 1_000,
    fetchImpl: async () => {
      throw new Error('network');
    },
  });
  assert.equal(crashed, false);
});

test('leave is denied after the allow cache expires, and errors stay denied', async () => {
  clearMembershipCache();
  let status = 200;
  const fetchImpl: typeof fetch = async () => jsonResponse(status);

  assert.equal(
    await lookupSpaceMembership({
      projectId: 'demo',
      idToken: 'token-a',
      spaceId: 'space-a',
      uid: 'member-1',
      now: 10_000,
      fetchImpl,
    }),
    true,
  );

  status = 404;
  assert.equal(
    await lookupSpaceMembership({
      projectId: 'demo',
      idToken: 'token-a',
      spaceId: 'space-a',
      uid: 'member-1',
      now: 10_000 + MEMBER_ALLOWED_TTL_MS - 1,
      fetchImpl,
    }),
    true,
  );
  assert.equal(
    await lookupSpaceMembership({
      projectId: 'demo',
      idToken: 'token-a',
      spaceId: 'space-a',
      uid: 'member-1',
      now: 10_000 + MEMBER_ALLOWED_TTL_MS + 1,
      fetchImpl,
    }),
    false,
  );

  status = 200;
  assert.equal(
    await lookupSpaceMembership({
      projectId: 'demo',
      idToken: 'token-a',
      spaceId: 'space-a',
      uid: 'member-1',
      now: 10_000 + MEMBER_ALLOWED_TTL_MS + MEMBER_DENIED_TTL_MS - 1,
      fetchImpl,
    }),
    false,
  );
});

test('memory author lookup is fail-closed except for a true 404', async () => {
  const missing = await lookupMemoryAuthorUid({
    projectId: 'demo',
    idToken: 'token-a',
    spaceId: 'space-a',
    memoryId: 'new-id',
    fetchImpl: async () => jsonResponse(404),
  });
  assert.deepEqual(missing, { exists: false, createdByUid: null });

  const found = await lookupMemoryAuthorUid({
    projectId: 'demo',
    idToken: 'token-a',
    spaceId: 'space-a',
    memoryId: 'm1',
    fetchImpl: async () =>
      jsonResponse(200, { fields: { createdByUid: { stringValue: 'author-1' } } }),
  });
  assert.deepEqual(found, { exists: true, createdByUid: 'author-1' });

  const forbidden = await lookupMemoryAuthorUid({
    projectId: 'demo',
    idToken: 'token-a',
    spaceId: 'space-a',
    memoryId: 'm1',
    fetchImpl: async () => jsonResponse(403),
  });
  assert.deepEqual(forbidden, { exists: true, createdByUid: null });

  const errored = await lookupMemoryAuthorUid({
    projectId: 'demo',
    idToken: 'token-a',
    spaceId: 'space-a',
    memoryId: 'm1',
    fetchImpl: async () => jsonResponse(500),
  });
  assert.deepEqual(errored, { exists: true, createdByUid: null });

  const crashed = await lookupMemoryAuthorUid({
    projectId: 'demo',
    idToken: 'token-a',
    spaceId: 'space-a',
    memoryId: 'm1',
    fetchImpl: async () => {
      throw new Error('r2-unrelated-firestore-down');
    },
  });
  assert.deepEqual(crashed, { exists: true, createdByUid: null });
});
