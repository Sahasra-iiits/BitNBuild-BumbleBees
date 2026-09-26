// ==============================================================================
// CogniScale Frontend — Consent API
// ==============================================================================

import { api } from './client';
import { RecordConsentRequest, ParticipantConsent } from '../types/api';
import * as crypto from 'crypto';

export const consentApi = {
  // Record participant consent before starting a session
  record: async (data: RecordConsentRequest): Promise<ParticipantConsent> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 300));
      return {
        id: `consent-mock-${Date.now()}`,
        participantId: 'part-mock-1',
        experimentId: data.experimentId,
        versionId: data.versionId,
        consentVersion: data.consentVersion,
        agreedAt: new Date().toISOString(),
      };
    }
    return api.post<ParticipantConsent>('/consent', data);
  },

  // Withdraw consent (data retention policies apply on backend)
  withdraw: async (consentId: string): Promise<void> => {
    if (api.useMock) return;
    await api.post(`/consent/${consentId}/withdraw`);
  },
};

// Utility: Hash consent text for integrity verification
// Frontend sends hash; backend stores it to verify consent wasn't altered
export function hashConsentText(text: string): string {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    // In real implementation, use SubtleCrypto async hash
    // For now, use simple base64 of text as placeholder
    return btoa(text.slice(0, 100)).replace(/=/g, '');
  }
  return btoa(text.slice(0, 100)).replace(/=/g, '');
}
