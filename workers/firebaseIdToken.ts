import { jwtVerify } from 'jose';

type FirebaseJwtKey = Parameters<typeof jwtVerify>[1];

export type FirebaseIdTokenClaims = {
  sub: string;
  user_id?: string;
  firebase?: { sign_in_provider?: string };
};

export const FIREBASE_ID_TOKEN_ALGORITHMS = ['RS256'] as const;

export function firebaseSecureTokenIssuer(projectId: string): string {
  return `https://securetoken.google.com/${projectId}`;
}

export async function verifyFirebaseIdToken(
  token: string,
  key: FirebaseJwtKey,
  projectId: string,
  now?: Date,
): Promise<FirebaseIdTokenClaims> {
  const result = await jwtVerify<FirebaseIdTokenClaims>(token, key, {
    algorithms: [...FIREBASE_ID_TOKEN_ALGORITHMS],
    audience: projectId,
    issuer: firebaseSecureTokenIssuer(projectId),
    currentDate: now,
  });
  return result.payload;
}

export function firebaseUidFromClaims(claims: FirebaseIdTokenClaims): string | null {
  const uid = claims.user_id ?? claims.sub;
  return uid && uid.length > 0 ? uid : null;
}

export function isAnonymousFirebaseSignIn(claims: FirebaseIdTokenClaims): boolean {
  const provider = claims.firebase?.sign_in_provider;
  return !provider || provider === 'anonymous';
}
