import { api } from './client';
import type { ParticipantConsent } from '../types/api';

/** Consent text shown to participants; its hash is stored server-side with the consent record. */
export const CONSENT_VERSION = '2026-09';
export const CONSENT_TEXT = [
  'You are invited to take part in a research study run through this platform.',
  'Participation is voluntary. You may stop at any time by closing the page; unfinished sessions are not rewarded.',
  'Your responses are stored under a random participant code. Your name and email address are never shared with the researcher.',
  'The study records your responses and how long you take to respond. Only the researcher who created the study can access them.',
].join('\n\n');

export const consentApi = {
  record: (data: { experimentId: string; versionId: string }) =>
    api.post<ParticipantConsent>('/consent', { ...data, consentVersion: CONSENT_VERSION, consentText: CONSENT_TEXT }),
};
