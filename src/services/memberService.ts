/**
 * Member Service
 * 
 * Provides CRUD operations for Member entities.
 * All operations interact with the SQLite Member table.
 * 
 * Rules:
 * - UUID generation via react-native-uuid
 * - Always update updatedAt when editing
 * - joinedAt is set once on creation
 * - isGuest stored as INTEGER (0/1)
 * - clubId is required
 * - name is required
 */

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';

export interface Member {
  id: string;
  clubId: string;
  name: string;
  isGuest: boolean;
  photoUri?: string;
  paidPenaltyAmount: number;
  joinedAt: string;
  updatedAt: string;
  birthdate?: string;
}

export interface CreateMemberPayload {
  clubId: string;
  name: string;
  isGuest?: boolean;
  photoUri?: string;
  birthdate?: string;
}

export interface UpdateMemberPayload {
  name?: string;
  isGuest?: boolean;
  photoUri?: string;
  birthdate?: string;
}

/**
 * Increment paidPenaltyAmount by a positive amount.
 * Used when recording a positive payment (reduces outstanding).
 */
export async function addPaidPenaltyAmount(
  memberId: string,
  amount: number
): Promise<void> {
  if (!memberId) {
    throw new Error('memberId is required');
  }
  if (amount <= 0 || isNaN(amount)) {
    throw new Error('amount must be a positive number');
  }

  const now = new Date().toISOString();

  await db.executeSql(
    `UPDATE Member
     SET paidPenaltyAmount = paidPenaltyAmount + ?, updatedAt = ?
     WHERE id = ?`,
    [amount, now, memberId]
  );
}

/**
 * Get all members for a specific club
 * @param clubId - Club UUID
 * @returns Promise<Member[]>
 */
export async function getMembersByClub(clubId: string): Promise<Member[]> {
  if (!clubId) {
    throw new Error('clubId is required');
  }

  try {
    console.log('[memberService] getMembersByClub called with clubId:', clubId);
    const rows: any = await db.getAllAsync(
      'SELECT id, clubId, name, isGuest, photoUri, paidPenaltyAmount, joinedAt, updatedAt, birthdate FROM Member WHERE clubId = ? ORDER BY name ASC',
      [clubId]
    );
    console.log('[memberService] Query results:', rows.length, 'rows');
    
    return rows.map((row: any) => ({
      ...row,
      isGuest: row.isGuest === 1,
    }));
  } catch (error) {
    console.error(`Error fetching members for club ${clubId}:`, error);
    throw error;
  }
}

/**
 * Get a single member by ID
 * @param id - Member UUID
 * @returns Promise<Member | null>
 */
export async function getMember(id: string): Promise<Member | null> {
  try {
    const row: any = await db.getFirstAsync(
      'SELECT * FROM Member WHERE id = ?',
      [id]
    );
    
    if (row) {
      return {
        ...row,
        isGuest: row.isGuest === 1,
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching member ${id}:`, error);
    throw error;
  }
}

/**
 * Create a new member
 * @param payload - CreateMemberPayload
 * @returns Promise<Member>
 */
export async function createMember(payload: CreateMemberPayload): Promise<Member> {
  if (!payload.clubId) {
    throw new Error('clubId is required');
  }
  
  if (!payload.name || !payload.name.trim()) {
    throw new Error('name is required');
  }

  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const member: Member = {
      id,
      clubId: payload.clubId,
      name: payload.name.trim(),
      isGuest: payload.isGuest || false,
      photoUri: payload.photoUri,
      paidPenaltyAmount: 0,
      joinedAt: now,
      updatedAt: now,
      birthdate: payload.birthdate,
   
    };
    
    await db.executeSql(
      `INSERT INTO Member (
        id, clubId, name, isGuest, photoUri, paidPenaltyAmount,
        joinedAt, updatedAt, birthdate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member.id,
        member.clubId,
        member.name,
        member.isGuest ? 1 : 0,
        member.photoUri || null,
        member.paidPenaltyAmount,
        member.joinedAt,
        member.updatedAt,
        member.birthdate || null,
      ]
    );
    
    return member;
  } catch (error) {
    console.error('Error creating member:', error);
    throw error;
  }
}

/**
 * Update an existing member
 * @param id - Member UUID
 * @param payload - UpdateMemberPayload
 * @returns Promise<Member | null>
 */
export async function updateMember(
  id: string,
  payload: UpdateMemberPayload
): Promise<Member | null> {
  try {
    const existing = await getMember(id);
    
    if (!existing) {
      return null;
    }
    
    if (payload.name !== undefined && !payload.name.trim()) {
      throw new Error('name cannot be empty');
    }
    
    const now = new Date().toISOString();
    
    const updated: Member = {
      ...existing,
      name: payload.name !== undefined ? payload.name.trim() : existing.name,
      isGuest: payload.isGuest !== undefined ? payload.isGuest : existing.isGuest,
      photoUri: payload.photoUri !== undefined ? payload.photoUri : existing.photoUri,
      birthdate: payload.birthdate !== undefined ? payload.birthdate : existing.birthdate,
      updatedAt: now,
    };
    
    await db.executeSql(
      `UPDATE Member 
       SET name = ?, isGuest = ?, photoUri = ?, birthdate = ?, updatedAt = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.isGuest ? 1 : 0,
        updated.photoUri || null,
        updated.birthdate || null,
        updated.updatedAt,
        id,
      ]
    );
    
    return updated;
  } catch (error) {
    console.error(`Error updating member ${id}:`, error);
    throw error;
  }
}

/**
 * Delete a member by ID
 * @param id - Member UUID
 * @returns Promise<boolean> - true if deleted, false if not found
 */
export async function deleteMember(id: string): Promise<boolean> {
  try {
    const existing = await getMember(id);
    
    if (!existing) {
      return false;
    }
    
    await db.executeSql('DELETE FROM Member WHERE id = ?', [id]);
    
    return true;
  } catch (error) {
    console.error(`Error deleting member ${id}:`, error);
    throw error;
  }
}
