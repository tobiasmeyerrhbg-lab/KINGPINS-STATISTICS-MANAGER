import { getSessionsByClub } from './sessionService';
import { getLogsBySession } from './sessionLogService';

/**
 * Attempt to find an active session for a club and return sessionId + logs to hydrate UI after crash.
 */
export async function findActiveSession(clubId: string): Promise<{ sessionId: string; logs: any[] } | null> {
  const activeSessions = await getSessionsByClub(clubId, 'active');
  if (!activeSessions.length) return null;
  const session = activeSessions[0]; // pick most recent active
  const logs = await getLogsBySession(session.id);
  return { sessionId: session.id, logs };
}
