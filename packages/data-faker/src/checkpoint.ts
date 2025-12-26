import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { CheckpointData } from './types.js';

const CHECKPOINT_DIR = '.checkpoints';
const CHECKPOINT_FILE = join(CHECKPOINT_DIR, 'progress.json');

/**
 * Load checkpoint data if it exists
 */
export function loadCheckpoint(): CheckpointData | null {
  if (!existsSync(CHECKPOINT_FILE)) {
    return null;
  }

  try {
    const data = readFileSync(CHECKPOINT_FILE, 'utf-8');
    return JSON.parse(data) as CheckpointData;
  } catch (error) {
    console.error('Error loading checkpoint:', error);
    return null;
  }
}

/**
 * Save checkpoint data
 */
export function saveCheckpoint(data: CheckpointData): void {
  try {
    // Ensure checkpoint directory exists
    if (!existsSync(CHECKPOINT_DIR)) {
      mkdirSync(CHECKPOINT_DIR, { recursive: true });
    }

    // Update last checkpoint time
    data.last_checkpoint = new Date().toISOString();

    // Calculate average rate if we have timing data
    if (data.total_time_seconds && data.total_time_seconds > 0) {
      data.average_rate_rows_per_sec = data.rows_inserted / data.total_time_seconds;
    }

    // Write checkpoint file
    writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving checkpoint:', error);
    throw error;
  }
}

/**
 * Delete checkpoint file (for reset)
 */
export function deleteCheckpoint(): void {
  if (existsSync(CHECKPOINT_FILE)) {
    try {
      unlinkSync(CHECKPOINT_FILE);
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
    }
  }
}

/**
 * Create initial checkpoint data
 */
export function createInitialCheckpoint(
  seed: string,
  targetRows: number,
  batchSize: number,
  waitForAsyncInsert: boolean = true
): CheckpointData {
  const now = new Date().toISOString();
  return {
    last_image_id: 0,
    rows_inserted: 0,
    batches_completed: 0,
    start_time: now,
    last_checkpoint: now,
    seed,
    target_rows: targetRows,
    batch_size: batchSize,
    wait_for_async_insert: waitForAsyncInsert,
  };
}

/**
 * Update checkpoint with new progress
 */
export function updateCheckpoint(
  checkpoint: CheckpointData,
  lastImageId: number,
  rowsInserted: number,
  batchesCompleted: number,
  elapsedSeconds?: number
): CheckpointData {
  const updated: CheckpointData = {
    ...checkpoint,
    last_image_id: lastImageId,
    rows_inserted: rowsInserted,
    batches_completed: batchesCompleted,
    last_checkpoint: new Date().toISOString(),
  };

  if (elapsedSeconds !== undefined) {
    updated.total_time_seconds = elapsedSeconds;
    if (elapsedSeconds > 0) {
      updated.average_rate_rows_per_sec = rowsInserted / elapsedSeconds;
    }
  }

  return updated;
}

