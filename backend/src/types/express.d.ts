// ==============================================================================
// SynapseLab — Global Type Extensions
// ==============================================================================

import { DecodedToken } from '../common/utils/jwt';

// Override Express Request types for our application
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
      requestId?: string;
      correlationId?: string;
    }
  }
}

// Module augmentation to fix Express v5 params type
declare module 'express-serve-static-core' {
  interface Request {
    params: Record<string, string>;
  }
}

export {};
