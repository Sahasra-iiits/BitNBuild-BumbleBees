// ==============================================================================
// SynapseLab — JWT Utilities
// ==============================================================================

import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { UserRole } from '../../config/constants';

export interface TokenPayload {
  userId: string;
  role: UserRole;
  email: string;
  participantProfileId?: string;
  researcherProfileId?: string;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
}

/**
 * Sign a short-lived access token.
 */
export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as any,
    issuer: 'synapselab',
    audience: 'synapselab-api',
  });
}

/**
 * Sign a long-lived refresh token.
 */
export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as any,
    issuer: 'synapselab',
    audience: 'synapselab-api',
  });
}

/**
 * Verify and decode an access token.
 */
export function verifyAccessToken(token: string): DecodedToken {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'synapselab',
    audience: 'synapselab-api',
  }) as DecodedToken;
}

/**
 * Verify and decode a refresh token.
 */
export function verifyRefreshToken(token: string): DecodedToken {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'synapselab',
    audience: 'synapselab-api',
  }) as DecodedToken;
}
