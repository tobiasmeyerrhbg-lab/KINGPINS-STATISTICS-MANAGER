/**
 * Club Service
 * 
 * Provides CRUD operations for Club entities.
 * All operations interact with the SQLite Club table.
 * 
 * Rules:
 * - UUID generation via react-native-uuid
 * - Always update updatedAt when editing
 * - createdAt is set once on creation
 */

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';

export interface Club {
  id: string;
  name: string;
  logoUri?: string;
  maxMultiplier: number;
  timezone?: string; // IANA timezone (e.g., "America/New_York", "Europe/Berlin")
  currency?: string; // e.g., "$", "€"
  timeFormat?: string; // display format e.g., "HH:mm"
  createdAt: string;
  updatedAt: string;
}

export interface CreateClubPayload {
  name: string;
  logoUri?: string;
  maxMultiplier?: number; // Optional, defaults to 10
  timezone?: string; // IANA timezone identifier
  currency?: string;
  timeFormat?: string;
}

export interface UpdateClubPayload {
  name?: string;
  logoUri?: string;
  maxMultiplier?: number;
  timezone?: string;
  currency?: string;
  timeFormat?: string;
}

/**
 * Get all clubs from database
 * @returns Promise<Club[]>
 */
export async function getAllClubs(): Promise<Club[]> {
  try {
    const results = await db.getAllAsync(
      'SELECT id, name, logoUri, maxMultiplier, timezone, currency, timeFormat, createdAt, updatedAt FROM Club ORDER BY name ASC'
    );
    return (results as Club[]) || [];
  } catch (error) {
    console.error('Error fetching clubs:', error);
    throw error;
  }
}

/**
 * Get a single club by ID
 * @param id - Club UUID
 * @returns Promise<Club | null>
 */
export async function getClub(id: string): Promise<Club | null> {
  try {
    const result = await db.getFirstAsync(
      'SELECT * FROM Club WHERE id = ?',
      [id]
    );
    return (result as Club) || null;
    
    return null;
  } catch (error) {
    console.error(`Error fetching club ${id}:`, error);
    throw error;
  }
}

/**
 * Create a new club
 * @param payload - CreateClubPayload
 * @returns Promise<Club>
 */
export async function createClub(payload: CreateClubPayload): Promise<Club> {
  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    const maxMultiplier = payload.maxMultiplier ?? 10;

    const club: Club = {
      id,
      name: payload.name,
      logoUri: payload.logoUri,
      maxMultiplier,
      timezone: payload.timezone,
      currency: payload.currency,
      timeFormat: payload.timeFormat,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.executeSql(
      'INSERT INTO Club (id, name, logoUri, maxMultiplier, timezone, currency, timeFormat, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, payload.name, payload.logoUri || null, maxMultiplier, payload.timezone || null, payload.currency || null, payload.timeFormat || null, now, now]
    );
    
    return club;
  } catch (error) {
    console.error('Error creating club:', error);
    throw error;
  }
}

/**
 * Update an existing club
 * @param id - Club UUID
 * @param payload - UpdateClubPayload
 * @returns Promise<Club | null>
 */
export async function updateClub(
  id: string,
  payload: UpdateClubPayload
): Promise<Club | null> {
  try {
    const existing = await getClub(id);
    
    if (!existing) {
      return null;
    }
    
    const now = new Date().toISOString();
    
    const updated: Club = {
      ...existing,
      name: payload.name !== undefined ? payload.name : existing.name,
      logoUri: payload.logoUri !== undefined ? payload.logoUri : existing.logoUri,
      maxMultiplier: payload.maxMultiplier !== undefined ? payload.maxMultiplier : existing.maxMultiplier,
      timezone: payload.timezone !== undefined ? payload.timezone : existing.timezone,
      currency: payload.currency !== undefined ? payload.currency : existing.currency,
      timeFormat: payload.timeFormat !== undefined ? payload.timeFormat : existing.timeFormat,
      updatedAt: now,
    };
    
    const sets: string[] = [];
    const values: any[] = [];

    if (payload.name !== undefined) {
      sets.push('name = ?');
      values.push(payload.name);
    }
    if (payload.logoUri !== undefined) {
      sets.push('logoUri = ?');
      values.push(payload.logoUri || null);
    }
    if (payload.maxMultiplier !== undefined) {
      sets.push('maxMultiplier = ?');
      values.push(payload.maxMultiplier);
    }
    if (payload.timezone !== undefined) {
      sets.push('timezone = ?');
      values.push(payload.timezone || null);
    }
    if (payload.currency !== undefined) {
      sets.push('currency = ?');
      values.push(payload.currency || null);
    }
    if (payload.timeFormat !== undefined) {
      sets.push('timeFormat = ?');
      values.push(payload.timeFormat || null);
    }

    sets.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await db.executeSql(
      `UPDATE Club SET ${sets.join(', ')} WHERE id = ?`,
      values
    );
    
    return updated;
  } catch (error) {
    console.error(`Error updating club ${id}:`, error);
    throw error;
  }
}

/**
 * Delete a club by ID
 * @param id - Club UUID
 * @returns Promise<boolean> - true if deleted, false if not found
 */
export async function deleteClub(id: string): Promise<boolean> {
  try {
    const existing = await getClub(id);
    
    if (!existing) {
      return false;
    }
    
    await db.executeSql('DELETE FROM Club WHERE id = ?', [id]);
    
    return true;
  } catch (error) {
    console.error(`Error deleting club ${id}:`, error);
    throw error;
  }
}
