/**
 * Penalty Service
 * 
 * Provides CRUD operations for Penalty entities.
 * All operations interact with the SQLite Penalty table.
 * 
 * Rules:
 * - UUID generation via react-native-uuid
 * - Always update updatedAt when editing
 * - createdAt is set once on creation
 * - Booleans (isTitle, active, rewardEnabled) stored as INTEGER (0/1)
 * - affect must be one of: SELF, OTHER, BOTH, NONE
 * - clubId is required
 * - name is required
 * - amount and amountOther must be numbers
 */

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';

export type PenaltyAffect = 'SELF' | 'OTHER' | 'BOTH' | 'NONE';

export interface Penalty {
  id: string;
  clubId: string;
  name: string;
  description?: string;
  amount: number;
  amountOther: number;
  affect: PenaltyAffect;
  isTitle: boolean;
  active: boolean;
  rewardEnabled: boolean;
  rewardValue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePenaltyPayload {
  clubId: string;
  name: string;
  description?: string;
  amount: number;
  amountOther: number;
  affect: PenaltyAffect;
  isTitle?: boolean;
  active?: boolean;
  rewardEnabled?: boolean;
  rewardValue?: number;
}

export interface UpdatePenaltyPayload {
  name?: string;
  description?: string;
  amount?: number;
  amountOther?: number;
  affect?: PenaltyAffect;
  isTitle?: boolean;
  active?: boolean;
  rewardEnabled?: boolean;
  rewardValue?: number;
}

const VALID_AFFECTS: PenaltyAffect[] = ['SELF', 'OTHER', 'BOTH', 'NONE'];

function normalizeAmounts(
  affect: PenaltyAffect,
  amount: number | undefined,
  amountOther: number | undefined
): { amount: number; amountOther: number } {
  const ensureNumber = (value: number | undefined, label: string) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      throw new Error(`${label} is required when affect is ${affect}`);
    }
    if (typeof value !== 'number') {
      throw new Error(`${label} must be a number`);
    }
    return value;
  };

  switch (affect) {
    case 'SELF':
      return { amount: ensureNumber(amount, 'Amount (SELF)'), amountOther: 0 };
    case 'OTHER':
      return { amount: 0, amountOther: ensureNumber(amountOther, 'Amount (OTHER)') };
    case 'BOTH':
      return {
        amount: ensureNumber(amount, 'Amount (SELF)'),
        amountOther: ensureNumber(amountOther, 'Amount (OTHER)'),
      };
    case 'NONE':
      return { amount: 0, amountOther: 0 };
    default:
      throw new Error(`Invalid affect value. Must be one of: ${VALID_AFFECTS.join(', ')}`);
  }
}

/**
 * Validate affect value
 */
function validateAffect(affect: string): void {
  if (!VALID_AFFECTS.includes(affect as PenaltyAffect)) {
    throw new Error(`Invalid affect value. Must be one of: ${VALID_AFFECTS.join(', ')}`);
  }
}

/**
 * Convert database row to Penalty object
 */
function rowToPenalty(row: any): Penalty {
  return {
    ...row,
    isTitle: row.isTitle === 1,
    active: row.active === 1,
    rewardEnabled: row.rewardEnabled === 1,
  };
}

/**
 * Get all penalties for a specific club
 * @param clubId - Club UUID
 * @returns Promise<Penalty[]>
 */
export async function getPenaltiesByClub(clubId: string): Promise<Penalty[]> {
  if (!clubId) {
    throw new Error('clubId is required');
  }

  try {
    console.log('[penaltyService] getPenaltiesByClub called with clubId:', clubId);
    const rows: any = await db.getAllAsync(
      'SELECT * FROM Penalty WHERE clubId = ? ORDER BY name ASC',
      [clubId]
    );
    console.log('[penaltyService] Query results:', rows.length, 'rows');
    
    return rows.map((row: any) => rowToPenalty(row));
  } catch (error) {
    console.error(`Error fetching penalties for club ${clubId}:`, error);
    throw error;
  }
}

/**
 * Get a single penalty by ID
 * @param id - Penalty UUID
 * @returns Promise<Penalty | null>
 */
export async function getPenalty(id: string): Promise<Penalty | null> {
  try {
    const row: any = await db.getFirstAsync(
      'SELECT * FROM Penalty WHERE id = ?',
      [id]
    );
    
    if (row) {
      return rowToPenalty(row);
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching penalty ${id}:`, error);
    throw error;
  }
}

/**
 * Create a new penalty
 * @param payload - CreatePenaltyPayload
 * @returns Promise<Penalty>
 */
export async function createPenalty(payload: CreatePenaltyPayload): Promise<Penalty> {
  if (!payload.clubId) {
    throw new Error('clubId is required');
  }
  
  if (!payload.name || !payload.name.trim()) {
    throw new Error('name is required');
  }

  validateAffect(payload.affect);

  const { amount, amountOther } = normalizeAmounts(
    payload.affect,
    payload.amount,
    payload.amountOther
  );

  try {
    const id = uuidv4() as string;
    const now = new Date().toISOString();
    
    const penalty: Penalty = {
      id,
      clubId: payload.clubId,
      name: payload.name.trim(),
      description: payload.description,
      amount,
      amountOther,
      affect: payload.affect,
      isTitle: payload.isTitle || false,
      active: payload.active !== undefined ? payload.active : true,
      rewardEnabled: payload.rewardEnabled || false,
      rewardValue: payload.rewardValue,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.executeSql(
      `INSERT INTO Penalty (
        id, clubId, name, description, amount, amountOther, affect,
        isTitle, active, rewardEnabled, rewardValue, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        penalty.id,
        penalty.clubId,
        penalty.name,
        penalty.description || null,
        penalty.amount,
        penalty.amountOther,
        penalty.affect,
        penalty.isTitle ? 1 : 0,
        penalty.active ? 1 : 0,
        penalty.rewardEnabled ? 1 : 0,
        penalty.rewardValue || null,
        penalty.createdAt,
        penalty.updatedAt,
      ]
    );
    
    return penalty;
  } catch (error) {
    console.error('Error creating penalty:', error);
    throw error;
  }
}

/**
 * Update an existing penalty
 * @param id - Penalty UUID
 * @param payload - UpdatePenaltyPayload
 * @returns Promise<Penalty | null>
 */
export async function updatePenalty(
  id: string,
  payload: UpdatePenaltyPayload
): Promise<Penalty | null> {
  try {
    const existing = await getPenalty(id);
    
    if (!existing) {
      return null;
    }
    
    if (payload.name !== undefined && !payload.name.trim()) {
      throw new Error('name cannot be empty');
    }

    const targetAffect = payload.affect !== undefined ? payload.affect : existing.affect;
    validateAffect(targetAffect);

    const { amount, amountOther } = normalizeAmounts(
      targetAffect,
      payload.amount !== undefined ? payload.amount : existing.amount,
      payload.amountOther !== undefined ? payload.amountOther : existing.amountOther
    );
    
    const now = new Date().toISOString();
    
    const updated: Penalty = {
      ...existing,
      name: payload.name !== undefined ? payload.name.trim() : existing.name,
      description: payload.description !== undefined ? payload.description : existing.description,
      amount,
      amountOther,
      affect: targetAffect,
      isTitle: payload.isTitle !== undefined ? payload.isTitle : existing.isTitle,
      active: payload.active !== undefined ? payload.active : existing.active,
      rewardEnabled: payload.rewardEnabled !== undefined ? payload.rewardEnabled : existing.rewardEnabled,
      rewardValue: payload.rewardValue !== undefined ? payload.rewardValue : existing.rewardValue,
      updatedAt: now,
    };
    
    await db.executeSql(
      `UPDATE Penalty 
       SET name = ?, description = ?, amount = ?, amountOther = ?, affect = ?,
           isTitle = ?, active = ?, rewardEnabled = ?, rewardValue = ?, updatedAt = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.description || null,
        updated.amount,
        updated.amountOther,
        updated.affect,
        updated.isTitle ? 1 : 0,
        updated.active ? 1 : 0,
        updated.rewardEnabled ? 1 : 0,
        updated.rewardValue || null,
        updated.updatedAt,
        id,
      ]
    );
    
    return updated;
  } catch (error) {
    console.error(`Error updating penalty ${id}:`, error);
    throw error;
  }
}

/**
 * Delete a penalty by ID
 * @param id - Penalty UUID
 * @returns Promise<boolean> - true if deleted, false if not found
 */
export async function deletePenalty(id: string): Promise<boolean> {
  try {
    const existing = await getPenalty(id);
    
    if (!existing) {
      return false;
    }
    
    await db.executeSql('DELETE FROM Penalty WHERE id = ?', [id]);
    
    return true;
  } catch (error) {
    console.error(`Error deleting penalty ${id}:`, error);
    throw error;
  }
}
