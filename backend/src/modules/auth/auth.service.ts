// ==============================================================================
// SynapseLab Authentication Service
// ==============================================================================

import { AUDIT_ACTIONS, RATING, ROLES, UserRole } from '../../config/constants';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../common/errors/app-error';
import { randomBytes, randomUUID } from 'crypto';
import { generatePseudonymousCode, hashPassword, hashString, verifyPassword } from '../../common/utils/crypto';
import { signAccessToken, signRefreshToken, TokenPayload, verifyRefreshToken } from '../../common/utils/jwt';
import { AuditService } from '../audit/audit.service';
import type { LoginInput, RegisterInput } from './auth.schema';

type TokenUser = {
  id: string;
  role: string;
  email: string;
  isGuest: boolean;
  participantProfile: { id: string } | null;
  researcherProfile: { id: string } | null;
};

function tokenPayloadFor(user: TokenUser): TokenPayload {
  return {
    userId: user.id,
    role: user.role as UserRole,
    email: user.email,
    participantProfileId: user.participantProfile?.id,
    researcherProfileId: user.researcherProfile?.id,
    isGuest: user.isGuest || undefined,
  };
}

/** Guests get an internal address on a reserved domain (RFC 2606) so it can never receive mail or collide. */
export const GUEST_EMAIL_DOMAIN = 'guest.invalid';

/** Device tokens are random base64url strings issued by createGuest. */
export function isDeviceToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

export class AuthService {
  /**
   * Starts a guest visit: no email, password or demographics. Each device keeps a
   * random device token (cookie + browser storage); presenting it again returns the
   * same guest, so ending the visit and coming back does not give a fresh attempt.
   */
  public static async createGuest(ipAddress?: string, userAgent?: string, presentedDeviceToken?: string | null) {
    const deviceToken = isDeviceToken(presentedDeviceToken) ? presentedDeviceToken : randomBytes(32).toString('base64url');
    const guestDeviceHash = hashString(deviceToken);
    const include = { researcherProfile: true, participantProfile: true } as const;

    let user = await prisma.user.findUnique({ where: { guestDeviceHash }, include });
    if (user && (!user.isGuest || !user.isActive)) throw new UnauthorizedError('Guest access is not available on this device.');
    const returning = !!user;
    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            email: `guest-${randomUUID()}@${GUEST_EMAIL_DOMAIN}`,
            // A random secret nobody knows: guests cannot sign in with a password.
            passwordHash: await hashPassword(randomBytes(32).toString('hex')),
            role: ROLES.PARTICIPANT,
            isGuest: true,
            isEmailVerified: false,
            guestDeviceHash,
            participantProfile: {
              create: { pseudonymousId: generatePseudonymousCode(), age: null, qualityRating: RATING.DEFAULT, totalRewardPoints: 0 },
            },
          },
          include,
        });
      } catch (error) {
        // Two tabs started a guest visit for the same device at once: use the one that won.
        if ((error as { code?: string }).code !== 'P2002') throw error;
        user = await prisma.user.findUniqueOrThrow({ where: { guestDeviceHash }, include });
      }
    }

    const payload = tokenPayloadFor(user);
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    await prisma.userSession.create({
      data: { userId: user.id, refreshTokenHash: hashString(refreshToken), userAgent, ipAddress, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    await AuditService.record({
      actorId: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.GUEST_STARTED,
      resourceType: 'USER',
      resourceId: user.id,
      ipAddressRedacted: ipAddress,
      userAgent,
      metadata: { returning },
    });
    return { user: await this.getCurrentUser(user.id), accessToken, refreshToken, deviceToken };
  }

  public static async register(input: RegisterInput, ipAddress?: string, userAgent?: string) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    if (input.role === ROLES.PARTICIPANT && !input.participantProfile) {
      throw new ValidationError('Participant profile with age is required for participant registration');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role,
        isEmailVerified: true, // For demo/sandbox auto-verify
        researcherProfile:
          input.role === ROLES.RESEARCHER
            ? {
                create: {
                  institution: input.researcherProfile?.institution || 'Independent Research',
                  department: input.researcherProfile?.department || 'Cognitive Science',
                  bio: input.researcherProfile?.bio || '',
                },
              }
            : undefined,
        participantProfile:
          input.role === ROLES.PARTICIPANT && input.participantProfile
            ? {
                create: {
                  pseudonymousId: generatePseudonymousCode(),
                  age: input.participantProfile.age,
                  gender: input.participantProfile.gender || null,
                  educationLevel: input.participantProfile.educationLevel || null,
                  qualityRating: RATING.DEFAULT,
                  totalRewardPoints: 0,
                },
              }
            : undefined,
      },
      include: {
        researcherProfile: true,
        participantProfile: true,
      },
    });

    const tokenPayload = tokenPayloadFor(user);

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Record session
    const refreshTokenHash = hashString(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    // Audit log
    await AuditService.record({
      actorId: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      resourceType: 'USER',
      resourceId: user.id,
      ipAddressRedacted: ipAddress,
      userAgent,
      metadata: { role: user.role },
    });

    return {
      user: await this.getCurrentUser(user.id),
      accessToken,
      refreshToken,
    };
  }

  public static async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        researcherProfile: true,
        participantProfile: true,
      },
    });

    if (!user || !user.isActive || user.isGuest) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await verifyPassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokenPayload = tokenPayloadFor(user);

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Save session
    const refreshTokenHash = hashString(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    await AuditService.record({
      actorId: user.id,
      actorRole: user.role,
      action: AUDIT_ACTIONS.USER_LOGIN,
      resourceType: 'USER',
      resourceId: user.id,
      ipAddressRedacted: ipAddress,
      userAgent,
    });

    return {
      user: await this.getCurrentUser(user.id),
      accessToken,
      refreshToken,
    };
  }

  public static async refreshToken(token: string) {
    if (!token) {
      throw new UnauthorizedError('Refresh token is required');
    }

    let payload: any;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokenHash = hashString(token);
    const session = await prisma.userSession.findFirst({
      where: {
        userId: payload.userId,
        refreshTokenHash: tokenHash,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            researcherProfile: true,
            participantProfile: true,
          },
        },
      },
    });

    if (!session || !session.user || !session.user.isActive) {
      throw new UnauthorizedError('Session expired or revoked');
    }

    const newPayload = tokenPayloadFor(session.user);

    const newAccessToken = signAccessToken(newPayload);
    return {
      accessToken: newAccessToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        isGuest: session.user.isGuest,
      },
    };
  }

  public static async logout(token?: string, userId?: string) {
    if (token) {
      const tokenHash = hashString(token);
      await prisma.userSession.updateMany({
        where: { refreshTokenHash: tokenHash },
        data: { isRevoked: true },
      });
    }

    if (userId) {
      await AuditService.record({
        actorId: userId,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        resourceType: 'USER',
        resourceId: userId,
      });
    }

    return { message: 'Logged out successfully' };
  }

  public static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isGuest: true,
        isEmailVerified: true,
        isActive: true,
        createdAt: true,
        researcherProfile: true,
        participantProfile: {
          select: {
            id: true,
            pseudonymousId: true,
            age: true,
            gender: true,
            educationLevel: true,
            qualityRating: true,
            totalRewardPoints: true,
            completedSessionsCount: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }
}
