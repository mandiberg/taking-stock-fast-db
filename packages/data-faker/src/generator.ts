import seedrandom from 'seedrandom';
import { getMooseUtils } from '@514labs/moose-lib';
import type { ImagesAnalyticalRow } from './types.js';
import { generateCaption } from './captions.js';
import * as dist from './distributions.js';
import { updateCheckpoint, saveCheckpoint } from './checkpoint.js';
import type { CheckpointData } from './types.js';
import { createClient } from '@clickhouse/client';

// Note: We use raw SQL INSERT instead of OlapTable.insert() because:
// 1. tsx doesn't reliably apply compiler plugins to cross-package imports
// 2. The compiler plugin needs to transform OlapTable at compile time
// 3. Raw SQL INSERT works reliably and is efficient for batch inserts

const MIN_BATCH_SIZE = 10000;

/**
 * Create a seeded RNG function for deterministic generation
 */
function createRNG(seed: string, imageId: number): () => number {
  const rng = seedrandom(`${seed}-${imageId}`);
  return () => rng();
}

/**
 * Generate a single row of data
 */
function generateRow(imageId: number, seed: string): ImagesAnalyticalRow {
  const rng = createRNG(seed, imageId);
  const gender = dist.generateGender(rng);
  const age = dist.generateAge(rng);
  const site = dist.generateSite(rng);
  const location = dist.generateLocation(rng);
  const ethnicity = dist.generateEthnicity(rng);
  const presenceFlags = dist.generatePresenceFlags(rng);
  const faceOrientation = dist.generateFaceOrientation(rng, presenceFlags.has_face);
  const keywords = dist.generateKeywordIds(rng);
  const detections = dist.generateDetectionClasses(rng);
  const topics = dist.generateTopics(rng);
  const dimensions = dist.generateDimensions(rng);
  const author = dist.generateAuthor(rng);
  const uploadDate = dist.generateUploadDate(rng);
  const caption = generateCaption(imageId, seed);

  const now = new Date();

  return {
    image_id: imageId,
    site_name_id: site.id,
    site_name: site.name,
    site_image_id: `site-${site.id}-${imageId}-${Math.floor(rng() * 1000000)}`,
    gender_id: gender.id,
    gender: gender.name,
    age_id: age.id,
    age: age.name,
    age_detail_id: dist.generateAgeDetail(rng),
    location_id: location.id,
    country_code: location.country_code,
    region: location.region,
    keyword_ids: keywords,
    ethnicity_ids: ethnicity.ids,
    ethnicity_white: ethnicity.white,
    ethnicity_black: ethnicity.black,
    ethnicity_asian: ethnicity.asian,
    ethnicity_hispanic: ethnicity.hispanic,
    ethnicity_middle_eastern: ethnicity.middle_eastern,
    ethnicity_native_american: ethnicity.native_american,
    ethnicity_pacific_islander: ethnicity.pacific_islander,
    ethnicity_mixed: ethnicity.mixed,
    ethnicity_other: ethnicity.other,
    ...presenceFlags,
    ...faceOrientation,
    body_pose_cluster_256: dist.generateCluster(rng, 256, 0.30),
    body_pose_cluster_512: dist.generateCluster(rng, 512, 0.30),
    body_pose_cluster_768: dist.generateCluster(rng, 768, 0.30),
    hand_poses_cluster_32: dist.generateCluster(rng, 32, 0.50),
    hand_gesture_cluster_32: dist.generateCluster(rng, 32, 0.50),
    hand_gesture_cluster_64: dist.generateCluster(rng, 64, 0.50),
    hand_gesture_cluster_128: dist.generateCluster(rng, 128, 0.50),
    arm_poses3D_cluster_128: dist.generateCluster(rng, 128, 0.60),
    arms_poses3D_cluster_64: dist.generateCluster(rng, 64, 0.60),
    hand_position_cluster_128: dist.generateCluster(rng, 128, 0.40),
    hsv_cluster: dist.generateCluster(rng, 512, 0.25),
    meta_hsv_cluster: dist.generateCluster(rng, 256, 0.25),
    face_cluster: dist.generateCluster(rng, 256, 0.20),
    // Topic-derived example fields (simulated)
    is_not_face_topic_id: (rng() < 0.10) ? Math.floor(rng() * 200) + 1 : null,
    is_not_face_score: (rng() < 0.10) ? Math.round(rng() * 1000) / 1000 : 0.0,
    is_face_model_topic_id: (rng() < 0.05) ? Math.floor(rng() * 200) + 1 : null,
    is_face_model_score: (rng() < 0.05) ? Math.round(rng() * 1000) / 1000 : 0.0,
    affect_id: (rng() < 0.20) ? Math.floor(rng() * 50) + 1 : null,
    affect_score: (rng() < 0.20) ? Math.round(rng() * 1000) / 1000 : 0.0,
    obj_cluster: null, // future: object cluster assignment
    ...topics,
    detection_count: detections.count,
    detection_classes: detections.classes,
    detection_top_class_id: detections.top_class_id,
    detection_top_class_confidence: detections.top_class_confidence,
    upload_date: uploadDate,
    author: author,
    caption: caption,
    content_url: `https://example.com/images/${imageId}.jpg`,
    width: dimensions.width,
    height: dimensions.height,
    is_dupe_of: 0,
    updated_at: now,
  };
}

/**
 * Convert row to ClickHouse-compatible format
 */
function rowToClickHouseFormat(row: ImagesAnalyticalRow): any {
  // Format dates for ClickHouse (YYYY-MM-DD HH:MM:SS format)
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  return {
    image_id: row.image_id,
    site_name_id: row.site_name_id,
    site_name: row.site_name,
    site_image_id: row.site_image_id,
    gender_id: row.gender_id,
    gender: row.gender,
    age_id: row.age_id,
    age: row.age,
    age_detail_id: row.age_detail_id,
    location_id: row.location_id,
    country_code: row.country_code,
    region: row.region,
    keyword_ids: row.keyword_ids,
    ethnicity_ids: row.ethnicity_ids,
    ethnicity_white: row.ethnicity_white ? 1 : 0,
    ethnicity_black: row.ethnicity_black ? 1 : 0,
    ethnicity_asian: row.ethnicity_asian ? 1 : 0,
    ethnicity_hispanic: row.ethnicity_hispanic ? 1 : 0,
    ethnicity_middle_eastern: row.ethnicity_middle_eastern ? 1 : 0,
    ethnicity_native_american: row.ethnicity_native_american ? 1 : 0,
    ethnicity_pacific_islander: row.ethnicity_pacific_islander ? 1 : 0,
    ethnicity_mixed: row.ethnicity_mixed ? 1 : 0,
    ethnicity_other: row.ethnicity_other ? 1 : 0,
    has_face: row.has_face ? 1 : 0,
    has_body: row.has_body ? 1 : 0,
    has_feet: row.has_feet ? 1 : 0,
    has_hands: row.has_hands ? 1 : 0,
    has_left_hand: row.has_left_hand ? 1 : 0,
    has_right_hand: row.has_right_hand ? 1 : 0,
    is_face_distant: row.is_face_distant ? 1 : 0,
    is_small: row.is_small ? 1 : 0,
    is_face_no_lms: row.is_face_no_lms ? 1 : 0,
    face_x: row.face_x,
    face_y: row.face_y,
    face_z: row.face_z,
    mouth_gap: row.mouth_gap,
    body_pose_cluster_256: row.body_pose_cluster_256,
    body_pose_cluster_512: row.body_pose_cluster_512,
    body_pose_cluster_768: row.body_pose_cluster_768,
    hand_poses_cluster_32: row.hand_poses_cluster_32,
    hand_gesture_cluster_32: row.hand_gesture_cluster_32,
    hand_gesture_cluster_64: row.hand_gesture_cluster_64,
    hand_gesture_cluster_128: row.hand_gesture_cluster_128,
    arms_poses3D_cluster_64: row.arms_poses3D_cluster_64,
    hand_position_cluster_128: row.hand_position_cluster_128,
    hsv_cluster: row.hsv_cluster,
    meta_hsv_cluster: row.meta_hsv_cluster,
    face_cluster: row.face_cluster,
    arm_poses3D_cluster_128: row.arm_poses3D_cluster_128,
    is_not_face_topic_id: row.is_not_face_topic_id,
    is_not_face_score: row.is_not_face_score,
    is_face_model_topic_id: row.is_face_model_topic_id,
    is_face_model_score: row.is_face_model_score,
    affect_id: row.affect_id,
    affect_score: row.affect_score,
    obj_cluster: row.obj_cluster,
    topic_id_1: row.topic_id_1,
    topic_score_1: row.topic_score_1,
    topic_id_2: row.topic_id_2,
    topic_score_2: row.topic_score_2,
    topic_id_3: row.topic_id_3,
    topic_score_3: row.topic_score_3,
    detection_count: row.detection_count,
    detection_classes: row.detection_classes,
    detection_top_class_id: row.detection_top_class_id,
    detection_top_class_confidence: row.detection_top_class_confidence,
    upload_date: formatDate(row.upload_date),
    author: row.author,
    caption: row.caption,
    content_url: row.content_url,
    width: row.width,
    height: row.height,
    is_dupe_of: row.is_dupe_of,
    updated_at: formatDate(row.updated_at),
  };
}

/**
 * Insert batch into ClickHouse using raw SQL INSERT with JSONEachRow format
 * 
 * We use raw SQL instead of OlapTable.insert() because tsx doesn't reliably
 * apply compiler plugins to cross-package imports. The OlapTable requires
 * compiler plugin transformation which works in moosestack-service but
 * not when imported from data-faker.
 * 
 * This approach:
 * - Works reliably with tsx
 * - Is efficient for batch inserts (JSONEachRow format)
 * - Provides the same functionality as OlapTable.insert()
 */
// Reuse a single ClickHouse client instance for all inserts
let clickhouseClientInstance: ReturnType<typeof createClient> | null = null;

async function getClickHouseClient() {
  if (!clickhouseClientInstance) {
    // Read config from moose.config.toml via getMooseUtils
    // For now, hardcode the values (they match moose.config.toml)
    clickhouseClientInstance = createClient({
      url: 'http://localhost:18123',
      username: 'panda',
      password: 'pandapass',
      database: 'local',
    });
  }
  return clickhouseClientInstance;
}

/**
 * Query ClickHouse to get the current row count in images_analytical table
 */
export async function getRowCount(): Promise<number> {
  const client = await getClickHouseClient();
  
  const result = await client.query({
    query: 'SELECT count() as count FROM images_analytical',
    format: 'JSONEachRow',
  });
  
  // Typed response shape so TypeScript can validate `count`
  type CountRow = { count: number };
  const data = (await result.json()) as CountRow | CountRow[];
  const rows = Array.isArray(data) ? data : [data];
  
  if (rows.length === 0 || !rows[0] || typeof rows[0].count !== 'number') {
    throw new Error('Unexpected response format from ClickHouse');
  }
  
  return rows[0].count;
}

async function insertBatch(rows: ImagesAnalyticalRow[]): Promise<void> {
  // Convert rows to ClickHouse format
  const formattedRows = rows.map(rowToClickHouseFormat);

  // Get ClickHouse client
  const client = await getClickHouseClient();

  // Insert using the native ClickHouse client insert method
  // This properly handles JSONEachRow format
  await client.insert({
    table: 'images_analytical',
    values: formattedRows,
    format: 'JSONEachRow',
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 1,
    },
  });
}

/**
 * Generate and insert data with checkpoint/resume support
 */
export async function generateData(
  checkpoint: CheckpointData,
  onProgress?: (progress: {
    rowsInserted: number;
    batchesCompleted: number;
    currentBatch: number;
    totalBatches: number;
    rate: number;
  }) => void
): Promise<void> {
  const startImageId = checkpoint.last_image_id + 1;
  const targetRows = checkpoint.target_rows;
  const batchSize = checkpoint.batch_size;
  const seed = checkpoint.seed;
  const startTime = Date.now();

  let currentImageId = startImageId;
  let rowsInserted = checkpoint.rows_inserted;
  let batchesCompleted = checkpoint.batches_completed;
  const batch: ImagesAnalyticalRow[] = [];
  const totalBatches = Math.ceil((targetRows - rowsInserted) / batchSize);

  // Warn if batch size is less than optimal
  if (batchSize < MIN_BATCH_SIZE && targetRows >= MIN_BATCH_SIZE) {
    console.warn(
      `Warning: Batch size ${batchSize} is less than optimal ${MIN_BATCH_SIZE} for ClickHouse performance`
    );
  }

  try {
    while (currentImageId < startImageId + (targetRows - rowsInserted)) {
      // Generate row
      const row = generateRow(currentImageId, seed);
      batch.push(row);
      currentImageId++;

      // Insert batch when it reaches batch size
      if (batch.length >= batchSize) {
        await insertBatch(batch);
        rowsInserted += batch.length;
        batchesCompleted++;
        batch.length = 0; // Clear batch

        // Update checkpoint
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const updatedCheckpoint = updateCheckpoint(
          checkpoint,
          currentImageId - 1,
          rowsInserted,
          batchesCompleted,
          elapsedSeconds
        );
        saveCheckpoint(updatedCheckpoint);
        checkpoint = updatedCheckpoint;

        // Report progress
        if (onProgress) {
          const rate = elapsedSeconds > 0 ? rowsInserted / elapsedSeconds : 0;
          onProgress({
            rowsInserted,
            batchesCompleted,
            currentBatch: batchesCompleted,
            totalBatches,
            rate,
          });
        }
      }
    }

    // Insert remaining rows if any
    if (batch.length > 0) {
      if (batch.length < MIN_BATCH_SIZE && targetRows >= MIN_BATCH_SIZE) {
        console.warn(
          `Warning: Inserting ${batch.length} rows (less than optimal ${MIN_BATCH_SIZE})`
        );
      }
      await insertBatch(batch);
      rowsInserted += batch.length;
      batchesCompleted++;

      // Final checkpoint update
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const updatedCheckpoint = updateCheckpoint(
        checkpoint,
        currentImageId - 1,
        rowsInserted,
        batchesCompleted,
        elapsedSeconds
      );
      saveCheckpoint(updatedCheckpoint);

      if (onProgress) {
        const rate = elapsedSeconds > 0 ? rowsInserted / elapsedSeconds : 0;
        onProgress({
          rowsInserted,
          batchesCompleted,
          currentBatch: batchesCompleted,
          totalBatches,
          rate,
        });
      }
    }
  } catch (error) {
    // Save checkpoint on error
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const updatedCheckpoint = updateCheckpoint(
      checkpoint,
      currentImageId - 1,
      rowsInserted,
      batchesCompleted,
      elapsedSeconds
    );
    saveCheckpoint(updatedCheckpoint);
    throw error;
  }
}

