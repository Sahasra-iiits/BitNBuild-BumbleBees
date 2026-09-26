// ==============================================================================
// SynapseLab — Seed Data
// ==============================================================================
// Populates the database with realistic development data.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// We use bcryptjs hash here since argon2 might not be available
// This is a hash of 'Password123' using bcryptjs with 12 rounds
const DEMO_PASSWORD_HASH = '$2a$12$LJ3m4Fw8W7bGk0NB6Gy5RuTVxZ7qJkPl3YnGzQ1sDxZv.wK5mWvfC';

async function hashPasswordForSeed(password: string): Promise<string> {
  try {
    const argon2 = require('argon2');
    return await argon2.hash(password, { type: 2, memoryCost: 65536, timeCost: 3, parallelism: 4 });
  } catch {
    const bcrypt = require('bcryptjs');
    return await bcrypt.hash(password, 12);
  }
}

async function main() {
  console.log('🌱 Seeding SynapseLab database...');

  const passwordHash = await hashPasswordForSeed('Password123');

  // ===========================================================================
  // Admin User
  // ===========================================================================
  const admin = await prisma.user.upsert({
    where: { email: 'admin@synapselab.dev' },
    update: {},
    create: {
      email: 'admin@synapselab.dev',
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
      isActive: true,
    },
  });
  console.log('  ✓ Admin user created:', admin.email);

  // ===========================================================================
  // Researcher User
  // ===========================================================================
  const researcherUser = await prisma.user.upsert({
    where: { email: 'researcher@synapselab.dev' },
    update: {},
    create: {
      email: 'researcher@synapselab.dev',
      passwordHash,
      role: 'RESEARCHER',
      isEmailVerified: true,
      isActive: true,
      researcherProfile: {
        create: {
          institution: 'MIT Cognitive Science Lab',
          department: 'Brain and Cognitive Sciences',
          bio: 'Senior researcher studying attention and perception.',
        },
      },
    },
  });
  console.log('  ✓ Researcher created:', researcherUser.email);

  const researcher = await prisma.researcherProfile.findUnique({
    where: { userId: researcherUser.id },
  });

  // ===========================================================================
  // Participant Users
  // ===========================================================================
  const participant1User = await prisma.user.upsert({
    where: { email: 'participant1@synapselab.dev' },
    update: {},
    create: {
      email: 'participant1@synapselab.dev',
      passwordHash,
      role: 'PARTICIPANT',
      isEmailVerified: true,
      isActive: true,
      participantProfile: {
        create: {
          pseudonymousId: 'P-A1B2-C3D4-E5F6-G7H8',
          age: 25,
          gender: 'Female',
          educationLevel: 'Graduate',
          qualityRating: 95.0,
          totalRewardPoints: 150,
          completedSessionsCount: 12,
        },
      },
    },
  });
  console.log('  ✓ Participant 1 created:', participant1User.email);

  const participant2User = await prisma.user.upsert({
    where: { email: 'participant2@synapselab.dev' },
    update: {},
    create: {
      email: 'participant2@synapselab.dev',
      passwordHash,
      role: 'PARTICIPANT',
      isEmailVerified: true,
      isActive: true,
      participantProfile: {
        create: {
          pseudonymousId: 'P-I9J0-K1L2-M3N4-O5P6',
          age: 32,
          gender: 'Male',
          educationLevel: 'Undergraduate',
          qualityRating: 72.0,
          totalRewardPoints: 80,
          completedSessionsCount: 6,
        },
      },
    },
  });
  console.log('  ✓ Participant 2 created:', participant2User.email);

  const participant3User = await prisma.user.upsert({
    where: { email: 'participant3@synapselab.dev' },
    update: {},
    create: {
      email: 'participant3@synapselab.dev',
      passwordHash,
      role: 'PARTICIPANT',
      isEmailVerified: true,
      isActive: true,
      participantProfile: {
        create: {
          pseudonymousId: 'P-Q7R8-S9T0-U1V2-W3X4',
          age: 19,
          gender: 'Non-binary',
          educationLevel: 'High School',
          qualityRating: 45.0,
          totalRewardPoints: 30,
          completedSessionsCount: 3,
        },
      },
    },
  });
  console.log('  ✓ Participant 3 created:', participant3User.email);

  if (!researcher) {
    console.log('  ⚠ Researcher profile not found, skipping experiments.');
    return;
  }

  // ===========================================================================
  // Experiments
  // ===========================================================================

  // 1. Draft experiment
  const draftExperiment = await prisma.experiment.create({
    data: {
      researcherId: researcher.id,
      title: 'Stroop Effect - Color Word Interference',
      description: 'Classic Stroop task measuring the interference effect when color words are printed in incongruent colors.',
      instructions: 'You will see color words on the screen. Press the key corresponding to the INK COLOR of the word, not the word itself.',
      status: 'DRAFT',
      visibility: 'PRIVATE',
      rewardPoints: 10,
      attemptPolicy: 'ALLOW_ONE_ATTEMPT',
      maxAttempts: 1,
    },
  });
  console.log('  ✓ Draft experiment:', draftExperiment.title);

  // 2. Public published experiment with eligibility rules
  const publicExperiment = await prisma.experiment.create({
    data: {
      researcherId: researcher.id,
      title: 'Visual Search Task - Feature vs. Conjunction',
      description: 'Investigate parallel vs. serial visual search using feature and conjunction search paradigms.',
      instructions: 'Find the target letter T among distractor letters L. Press SPACE when you find it.',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      rewardPoints: 15,
      attemptPolicy: 'ALLOW_ONE_ATTEMPT',
      maxAttempts: 1,
      eligibilityRules: {
        create: [
          {
            ruleType: 'AGE_RANGE',
            minAge: 18,
            maxAge: 65,
          },
          {
            ruleType: 'RATING_RANGE',
            minRating: 50,
          },
        ],
      },
    },
  });
  console.log('  ✓ Public experiment:', publicExperiment.title);

  // Create a version for the public experiment
  const version = await prisma.experimentVersion.create({
    data: {
      experimentId: publicExperiment.id,
      versionNumber: 1,
      configSnapshot: {
        title: publicExperiment.title,
        trials: [
          { type: 'INSTRUCTION', text: 'Find the T among Ls' },
          { type: 'FIXATION', durationMs: 500 },
          { type: 'STIMULUS', condition: 'feature_4', setSize: 4 },
          { type: 'STIMULUS', condition: 'feature_8', setSize: 8 },
          { type: 'STIMULUS', condition: 'conjunction_4', setSize: 4 },
          { type: 'STIMULUS', condition: 'conjunction_8', setSize: 8 },
        ],
      },
      configHash: 'seed-config-hash-visual-search',
      publishedAt: new Date(),
      createdBy: researcherUser.id,
    },
  });

  // Create trials for this version
  const trials = await Promise.all([
    prisma.experimentTrial.create({
      data: {
        versionId: version.id,
        sequenceOrder: 0,
        trialType: 'INSTRUCTION',
        name: 'Welcome',
        configuration: { text: 'Find the target T among distractor Ls. Press SPACE when you find it.' },
      },
    }),
    prisma.experimentTrial.create({
      data: {
        versionId: version.id,
        sequenceOrder: 1,
        trialType: 'FIXATION',
        name: 'Fixation',
        configuration: { type: 'cross', color: '#ffffff' },
        durationMs: 500,
      },
    }),
    prisma.experimentTrial.create({
      data: {
        versionId: version.id,
        sequenceOrder: 2,
        trialType: 'STIMULUS',
        name: 'Feature Search (4 items)',
        configuration: { searchType: 'feature', setSize: 4 },
        stimulusConfig: { target: 'T', distractors: ['L'], colors: ['red', 'blue'] },
        timeoutMs: 5000,
      },
    }),
    prisma.experimentTrial.create({
      data: {
        versionId: version.id,
        sequenceOrder: 3,
        trialType: 'STIMULUS',
        name: 'Conjunction Search (8 items)',
        configuration: { searchType: 'conjunction', setSize: 8 },
        stimulusConfig: { target: 'T', distractors: ['L'], colors: ['red', 'blue'] },
        timeoutMs: 5000,
      },
    }),
  ]);

  // Add randomization config
  await prisma.randomizationConfig.create({
    data: {
      versionId: version.id,
      strategy: 'FULL_RANDOM',
      configuration: { shuffleTrials: true, excludeInstructions: true },
    },
  });

  console.log('  ✓ Version with trials and randomization created');

  // 3. Private experiment
  const privateExperiment = await prisma.experiment.create({
    data: {
      researcherId: researcher.id,
      title: 'Implicit Association Test - Attitudes Study',
      description: 'Measure implicit attitudes using categorization speed differences.',
      instructions: 'Categorize items as quickly as possible by pressing the correct key.',
      status: 'PUBLISHED',
      visibility: 'PRIVATE',
      rewardPoints: 20,
      attemptPolicy: 'ALLOW_ONE_ATTEMPT',
      maxAttempts: 1,
    },
  });
  console.log('  ✓ Private experiment:', privateExperiment.title);

  // 4. Rating-restricted experiment
  const ratingRestrictedExperiment = await prisma.experiment.create({
    data: {
      researcherId: researcher.id,
      title: 'High-Quality Perception Study',
      description: 'Requires high quality rating. Tests perceptual thresholds.',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      rewardPoints: 15,
      attemptPolicy: 'ALLOW_ONE_ATTEMPT',
      maxAttempts: 1,
      eligibilityRules: {
        create: [
          {
            ruleType: 'RATING_RANGE',
            minRating: 80,
          },
        ],
      },
    },
  });
  console.log('  ✓ Rating-restricted experiment:', ratingRestrictedExperiment.title);

  // 5. Age-restricted experiment
  const ageRestrictedExperiment = await prisma.experiment.create({
    data: {
      researcherId: researcher.id,
      title: 'Cognitive Aging and Memory',
      description: 'Studies memory changes in older adults.',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      rewardPoints: 10,
      attemptPolicy: 'ALLOW_MULTIPLE_ATTEMPTS',
      maxAttempts: 3,
      eligibilityRules: {
        create: [
          {
            ruleType: 'AGE_RANGE',
            minAge: 55,
            maxAge: 85,
          },
        ],
      },
    },
  });
  console.log('  ✓ Age-restricted experiment:', ageRestrictedExperiment.title);

  // ===========================================================================
  // Sample Sessions and Responses
  // ===========================================================================
  const participant1 = await prisma.participantProfile.findUnique({
    where: { userId: participant1User.id },
  });

  if (participant1 && trials.length > 0) {
    // Create a completed session with sample responses
    const session = await prisma.experimentSession.create({
      data: {
        experimentId: publicExperiment.id,
        versionId: version.id,
        participantId: participant1.id,
        pseudonymousRef: participant1.pseudonymousId,
        status: 'COMPLETED',
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
        qualityStatus: 'CLEAN',
      },
    });

    // Create sample responses
    await prisma.trialResponse.createMany({
      data: [
        {
          sessionId: session.id,
          trialId: trials[2].id,
          eventId: 'seed-event-001',
          trialSequence: 0,
          condition: 'feature_4',
          reactionTimeMs: 542.3,
          response: { key: 'SPACE' },
          correct: true,
          timeout: false,
          clientEventSequence: 0,
        },
        {
          sessionId: session.id,
          trialId: trials[2].id,
          eventId: 'seed-event-002',
          trialSequence: 1,
          condition: 'feature_4',
          reactionTimeMs: 498.1,
          response: { key: 'SPACE' },
          correct: true,
          timeout: false,
          clientEventSequence: 1,
        },
        {
          sessionId: session.id,
          trialId: trials[3].id,
          eventId: 'seed-event-003',
          trialSequence: 2,
          condition: 'conjunction_8',
          reactionTimeMs: 891.7,
          response: { key: 'SPACE' },
          correct: true,
          timeout: false,
          clientEventSequence: 2,
        },
        {
          sessionId: session.id,
          trialId: trials[3].id,
          eventId: 'seed-event-004',
          trialSequence: 3,
          condition: 'conjunction_8',
          reactionTimeMs: 1023.5,
          response: { key: 'SPACE' },
          correct: false,
          timeout: false,
          clientEventSequence: 3,
        },
      ],
    });

    // Create a reward for the completed session
    await prisma.experimentReward.create({
      data: {
        participantId: participant1.id,
        experimentId: publicExperiment.id,
        sessionId: session.id,
        points: 15,
        reason: 'EXPERIMENT_COMPLETION',
        idempotencyKey: `reward:${session.id}:completion`,
      },
    });

    console.log('  ✓ Sample session with responses created');

    // Create a rating event
    await prisma.participantRatingEvent.create({
      data: {
        participantId: participant1.id,
        oldRating: 94.0,
        delta: 1.0,
        newRating: 95.0,
        reason: 'EXPERIMENT_COMPLETION',
        source: 'SYSTEM',
        experimentId: publicExperiment.id,
        sessionId: session.id,
      },
    });
    console.log('  ✓ Sample rating event created');
  }

  // ===========================================================================
  // Audit Events
  // ===========================================================================
  await prisma.auditEvent.createMany({
    data: [
      {
        actorId: researcherUser.id,
        actorRole: 'RESEARCHER',
        action: 'EXPERIMENT_CREATED',
        resourceType: 'EXPERIMENT',
        resourceId: publicExperiment.id,
        metadata: { title: publicExperiment.title },
      },
      {
        actorId: researcherUser.id,
        actorRole: 'RESEARCHER',
        action: 'EXPERIMENT_PUBLISHED',
        resourceType: 'EXPERIMENT',
        resourceId: publicExperiment.id,
      },
    ],
  });
  console.log('  ✓ Audit events created');

  console.log('\n✅ Seed complete!');
  console.log('\nDemo Credentials (all passwords: Password123):');
  console.log('  Admin:        admin@synapselab.dev');
  console.log('  Researcher:   researcher@synapselab.dev');
  console.log('  Participant1: participant1@synapselab.dev (rating: 95)');
  console.log('  Participant2: participant2@synapselab.dev (rating: 72)');
  console.log('  Participant3: participant3@synapselab.dev (rating: 45)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
