// ==============================================================================
// SynapseLab Authentication Service
// ==============================================================================

import { AUDIT_ACTIONS, ROLES, UserRole } from '../../config/constants';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../common/errors/app-error';
import { generatePseudonymousCode, hashPassword, hashString, verifyPassword } from '../../common/utils/crypto';
import { signAccessToken, signRefreshToken, TokenPayload, verifyRefreshToken } from '../../common/utils/jwt';
import { AuditService } from '../audit/audit.service';
import type { LoginInput, RegisterInput } from './auth.schema';

export class AuthService {
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
                  qualityRating: 1200.0,
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

    const tokenPayload: TokenPayload = {
      userId: user.id,
      role: user.role as UserRole,
      email: user.email,
      participantProfileId: user.participantProfile?.id,
      researcherProfileId: user.researcherProfile?.id,
    };

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
      metadata: { role: user.role, email: user.email },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        researcherProfile: user.researcherProfile,
        participantProfile: user.participantProfile
          ? {
              id: user.participantProfile.id,
              pseudonymousId: user.participantProfile.pseudonymousId,
              qualityRating: user.participantProfile.qualityRating,
              totalRewardPoints: user.participantProfile.totalRewardPoints,
            }
          : null,
      },
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

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await verifyPassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      role: user.role as UserRole,
      email: user.email,
      participantProfileId: user.participantProfile?.id,
      researcherProfileId: user.researcherProfile?.id,
    };

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
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        researcherProfile: user.researcherProfile,
        participantProfile: user.participantProfile
          ? {
              id: user.participantProfile.id,
              pseudonymousId: user.participantProfile.pseudonymousId,
              qualityRating: user.participantProfile.qualityRating,
              totalRewardPoints: user.participantProfile.totalRewardPoints,
            }
          : null,
      },
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

    const newPayload: TokenPayload = {
      userId: session.user.id,
      role: session.user.role as UserRole,
      email: session.user.email,
      participantProfileId: session.user.participantProfile?.id,
      researcherProfileId: session.user.researcherProfile?.id,
    };

    const newAccessToken = signAccessToken(newPayload);
    return {
      accessToken: newAccessToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
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
        isEmailVerified: true,
        isActive: true,
        createdAt: true,
        researcherProfile: true,
        participantProfile: {
          select: {
            id: true,
            pseudonymousId: true,
            age: true,
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
