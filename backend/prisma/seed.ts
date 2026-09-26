// ==============================================================================
// SynapseLab — Seed Data
// ==============================================================================
// Creates demo accounts and demo experiments built with the canonical experiment
// definition and published through the same service the API uses, so every
// seeded experiment can actually be run. No participant responses are
// fabricated: results pages only ever show real recorded data.
//
// Idempotent: users are upserted and experiments are only created once.

import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword, generatePseudonymousCode } from '../src/common/utils/crypto';
import { VersionService } from '../src/modules/experiment-versions/versions.service';
import { createElement, createEmptyDefinition, createTrial, type ExperimentDefinition, type ExperimentElement, type Trial } from '../src/shared/experiment';

const prisma = new PrismaClient();

function el<T extends ExperimentElement['type']>(type: T): Extract<ExperimentElement, { type: T }> {
  return createElement(type) as Extract<ExperimentElement, { type: T }>;
}

function trial(name: string, mode: Trial['advanceMode'], elements: ExperimentElement[], extra: Partial<Trial> = {}): Trial {
  return { ...createTrial(name), advanceMode: mode, elements, ...extra };
}

function text(value: string) {
  const t = el('TEXT_INSTRUCTION');
  t.config.text = value;
  return t;
}

function demoDefinition(): ExperimentDefinition {
  const kb = el('KEYBOARD_PRESS');
  kb.config.allowedKeys = ['a', 'l'];
  kb.scoring = { enabled: true, correctKey: 'a' };

  const mc = el('MULTIPLE_CHOICE');
  mc.config.prompt = 'Which letter comes second in the alphabet?';
  mc.config.options = [
    { id: 'opt-a', label: 'A' },
    { id: 'opt-b', label: 'B' },
    { id: 'opt-c', label: 'C' },
  ];
  mc.scoring = { enabled: true, correctOptionId: 'opt-b' };

  const slider = el('SLIDER_RATING');
  slider.config = { ...slider.config, prompt: 'How alert do you feel right now?', min: 1, max: 100, step: 1, defaultValue: 50, leftLabel: 'Not at all', rightLabel: 'Extremely' };

  const input = el('TEXT_INPUT');
  input.config.prompt = 'What is the capital of France?';
  input.scoring = { enabled: true, acceptedAnswers: ['Paris'], caseSensitive: false };

  const yn = el('YES_NO');
  yn.config.prompt = 'Did you read the instructions carefully?';

  return {
    ...createEmptyDefinition(),
    trials: [
      trial('Welcome', 'manual', [text('Welcome! This short demo shows every response type. Press Continue to begin.')]),
      trial('Fixation', 'timed', [el('FIXATION_CROSS')], { durationMs: 500 }),
      trial('Keyboard', 'response_or_timeout', [text('Press A if you see a vowel, L otherwise:\n\nE'), kb], { durationMs: 5000, condition: 'congruent' }),
      trial('Multiple choice', 'response', [mc], { condition: 'knowledge' }),
      trial('Slider', 'response', [slider]),
      trial('Text input', 'response', [input], { condition: 'knowledge' }),
      trial('Yes / No', 'response', [yn]),
    ],
  };
}

async function upsertUser(email: string, passwordHash: string, data: Omit<Prisma.UserCreateInput, 'email' | 'passwordHash'>) {
  return prisma.user.upsert({ where: { email }, update: {}, create: { email, passwordHash, ...data } });
}

async function main() {
  console.log('Seeding SynapseLab database...');
  const passwordHash = await hashPassword('Password123');

  await upsertUser('admin@synapselab.dev', passwordHash, { role: 'ADMIN', isEmailVerified: true });
  const researcherUser = await upsertUser('researcher@synapselab.dev', passwordHash, {
    role: 'RESEARCHER',
    isEmailVerified: true,
    researcherProfile: { create: { institution: 'MIT Cognitive Science Lab', department: 'Brain and Cognitive Sciences' } },
  });
  const participants: Array<[string, number, number]> = [
    ['participant1@synapselab.dev', 25, 1350],
    ['participant2@synapselab.dev', 32, 1200],
    ['participant3@synapselab.dev', 19, 1050],
  ];
  for (const [email, age, rating] of participants) {
    await upsertUser(email, passwordHash, {
      role: 'PARTICIPANT',
      isEmailVerified: true,
      participantProfile: { create: { pseudonymousId: generatePseudonymousCode(), age, qualityRating: rating } },
    });
  }

  const researcher = await prisma.researcherProfile.findUniqueOrThrow({ where: { userId: researcherUser.id } });
  if ((await prisma.experiment.count({ where: { researcherId: researcher.id } })) > 0) {
    console.log('Demo experiments already exist; skipping.');
    return;
  }

  const draft: ExperimentDefinition = {
    ...createEmptyDefinition(),
    trials: [trial('Instructions', 'manual', [text('Press the key matching the INK colour of each word.')])],
  };
  await prisma.experiment.create({
    data: {
      researcherId: researcher.id,
      title: 'Stroop Effect (draft)',
      description: 'Colour-word interference task — still being built.',
      rewardPoints: 10,
      draftDefinition: draft as unknown as Prisma.InputJsonValue,
    },
  });

  const published = [
    { title: 'Response Types Demo', description: 'A two-minute tour of every response type.', rewardPoints: 5, rules: [] as Prisma.EligibilityRuleCreateWithoutExperimentInput[] },
    { title: 'High-Quality Perception Study', description: 'Requires a participant rating of at least 1250.', rewardPoints: 15, rules: [{ ruleType: 'RATING_RANGE', minRating: 1250 }] },
    { title: 'Cognitive Aging and Memory', description: 'For participants aged 55 to 85.', rewardPoints: 10, rules: [{ ruleType: 'AGE_RANGE', minAge: 55, maxAge: 85 }] },
  ];
  for (const p of published) {
    const definition = demoDefinition();
    const experiment = await prisma.experiment.create({
      data: {
        researcherId: researcher.id,
        title: p.title,
        description: p.description,
        instructions: 'Please complete the study in a quiet place without interruptions.',
        visibility: 'PUBLIC',
        rewardPoints: p.rewardPoints,
        draftDefinition: definition as unknown as Prisma.InputJsonValue,
        eligibilityRules: { create: p.rules },
      },
      include: { eligibilityRules: true },
    });
    await VersionService.createFromDefinition(experiment, definition, researcherUser.id);
    await prisma.experiment.update({ where: { id: experiment.id }, data: { status: 'PUBLISHED' } });
    console.log(`  published: ${p.title}`);
  }

  console.log('\nSeed complete. Demo credentials (password: Password123):');
  console.log('  researcher@synapselab.dev, participant1..3@synapselab.dev (ratings 1350 / 1200 / 1050), admin@synapselab.dev');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
