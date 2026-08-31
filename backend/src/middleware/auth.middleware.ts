import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth, Session } from '../lib/auth.js';

export interface AuthenticatedRequest extends Request {
  user?: Session['user'];
  session?: Session['session'];
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionData || !sessionData.session || !sessionData.user) {
      return res.status(401).json({ error: 'Unauthorized: No active session' });
    }

    const user = sessionData.user as Record<string, unknown>;
    if (user.isActive === false) {
      return res.status(403).json({ error: 'Forbidden: Account has been deactivated' });
    }

    req.user = sessionData.user;
    req.session = sessionData.session;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
}

export function requireRole(role: 'ADMIN' | 'AGENT') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userRole = (req.user as Record<string, unknown>).role;
    if (userRole !== role && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    return next();
  };
}
