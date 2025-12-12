/**
 * Ledger Service
 * 
 * Manages comprehensive transaction ledger
 * Types: session, payment, adjustment, refund
 * 
 * Rules:
 * - Negative amounts allowed (debt tracking)
 * - Outstanding = SUM(amount WHERE memberId)
 */

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';

export type LedgerType = 'session' | 'payment' | 'adjustment' | 'refund';

export interface LedgerEntry {
  id?: string;
  type: LedgerType;
  sessionId?: string;
  paymentId?: string;
  memberId: string;
  clubId: string;
  amount: number;
  note?: string | null;
  createdBy?: string | null;
  timestamp: string;
}

export async function createLedgerEntry(entry: LedgerEntry): Promise<string> {
  // Validation
  if (!['session', 'payment', 'adjustment', 'refund'].includes(entry.type)) {
    throw new Error('Invalid ledger type');
  }
  if (!entry.memberId || !entry.clubId) {
    throw new Error('memberId and clubId required');
  }
  if (!entry.timestamp || isNaN(Date.parse(entry.timestamp))) {
    throw new Error('Invalid timestamp');
  }
  if (entry.type === 'session' && !entry.sessionId) {
    throw new Error('sessionId required for session type');
  }
  const id = entry.id || uuidv4();
  await db.executeSql(
    `INSERT INTO Ledger (id, type, sessionId, paymentId, memberId, clubId, amount, note, createdBy, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entry.type,
      entry.sessionId || null,
      entry.paymentId || null,
      entry.memberId,
      entry.clubId,
      entry.amount,
      entry.note || null,
      entry.createdBy || null,
      entry.timestamp,
    ]
  );
  return id;
}

export async function getLedgerByMember(memberId: string) {
  const result = await db.executeSql(
    `SELECT * FROM Ledger WHERE memberId = ? ORDER BY timestamp ASC`,
    [memberId]
  );
  // Fix: result is already the rows object
  return result.rows || [];
}

// financials: fix for undefined rows in getOutstanding
export async function getOutstanding(memberId: string): Promise<number> {
  console.log('[ledgerService] getOutstanding called for memberId:', memberId);
  
  const result = await db.executeSql(
    `SELECT SUM(amount) as total FROM Ledger WHERE memberId = ?`,
    [memberId]
  );
  console.log('[ledgerService] Query result:', result);
  
  // Fix: result is already the rows object, not result[0].rows
  if (!result || !result.rows || result.rows.length === 0) {
    console.log('[ledgerService] No result rows, returning 0');
    return 0;
  }
  
  const total = (result.rows[0] as any)?.total;
  console.log('[ledgerService] Total from query:', total, 'Type:', typeof total);
  return typeof total === 'number' ? total : 0;
}

// ledger: manual payment/adjustment/refund API
export async function createPayment({ memberId, clubId, amount, note, createdBy }: { memberId: string; clubId: string; amount: number; note?: string; createdBy?: string }) {
  if (amount >= 0) throw new Error('Payments must be negative');
  return createLedgerEntry({
    type: 'payment',
    memberId,
    clubId,
    amount,
    note: note || null,
    createdBy: createdBy || null,
    timestamp: new Date().toISOString(),
  });
}

export async function createAdjustment({ memberId, clubId, amount, note, createdBy }: { memberId: string; clubId: string; amount: number; note?: string; createdBy?: string }) {
  if (!amount || isNaN(amount)) throw new Error('Adjustment amount required');
  return createLedgerEntry({
    type: 'adjustment',
    memberId,
    clubId,
    amount,
    note: note || null,
    createdBy: createdBy || null,
    timestamp: new Date().toISOString(),
  });
}

export async function createRefund({ memberId, clubId, amount, note, createdBy }: { memberId: string; clubId: string; amount: number; note?: string; createdBy?: string }) {
  if (amount <= 0) throw new Error('Refunds must be positive');
  return createLedgerEntry({
    type: 'refund',
    memberId,
    clubId,
    amount,
    note: note || null,
    createdBy: createdBy || null,
    timestamp: new Date().toISOString(),
  });
}