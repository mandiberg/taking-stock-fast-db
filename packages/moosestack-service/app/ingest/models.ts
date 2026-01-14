// Analytical Data Model for Stock Photo Analysis
//
// This file defines the ClickHouse analytical table schema for consolidating
// MySQL metadata (~144 tables) and MongoDB embeddings into a single wide,
// denormalized table optimized for big data analytics.
//
// Design Principles:
// - Single wide table: All data flattened, no JOINs needed in ClickHouse queries
// - Arrays for many-to-many: Keywords and ethnicity stored as arrays
// - Dual ethnicity storage: Both array and boolean columns for flexible querying
// - Efficient data types: LowCardinality, appropriate numeric types
// - Minimize nullability: Use sentinel values (0, "", epoch date) instead of NULL for performance
// - Optimized ordering: Based on most common query patterns

import {
  OlapTable,
  LowCardinality,
  ClickHouseEngines,
  UInt8,
  UInt16,
  UInt32,
  Decimal,
  Float32,
  DateTime,
} from "@514labs/moose-lib";

/**
 * Images Analytical Table
 *
 * A fully denormalized fact table combining:
 * - Core image metadata from MySQL Images table
 * - Detection/encoding data from MySQL Encodings table
 * - Demographics (gender, age, location) denormalized from lookup tables
 * - Cluster assignments from various clustering tables
 * - Topic model results
 * - Keywords and ethnicity as arrays (many-to-many relationships)
 * - Detection summaries (aggregated from Detections table)
 *
 * Performance Note: Nullable columns have significant performance overhead in ClickHouse.
 * We use sentinel values instead:
 * - 0 = unknown/not applicable for IDs and counts
 * - "" = empty string for text fields
 * - toDate('1970-01-01') = epoch date for missing dates
 */
export interface ImagesAnalytical {
  /** Unique identifier for each image - supports 4B+ images */
  image_id: UInt32;

  // Site/Source Information
  /** Stock site ID (1-18: Getty, Shutterstock, Adobe, etc.) - Low cardinality, excellent for filtering */
  site_name_id: UInt8;
  /** Stock site name - LowCardinality for compression (18 unique values) */
  site_name: string & LowCardinality;
  /** Site-specific image identifier */
  site_image_id: string; // String

  // Demographics (denormalized from lookup tables)
  // Use 0 for unknown/not detected to avoid nullable performance penalty
  /** Gender ID - 0 = unknown/not detected */
  gender_id: UInt8; // 0 = unknown
  /** Gender name - LowCardinality for compression, empty string = unknown */
  gender: string & LowCardinality;
  /** Age category ID - 0 = unknown */
  age_id: UInt8; // 0 = unknown
  /** Age category name - LowCardinality for compression, empty string = unknown */
  age: string & LowCardinality;
  /** Detailed age category ID - 0 = unknown */
  age_detail_id: UInt8; // 0 = unknown
  /** Location ID - 0 = unknown */
  location_id: UInt16; // 0 = unknown
  /** ISO country code - LowCardinality for compression, empty string = unknown */
  country_code: string & LowCardinality; // LowCardinality(String), "" = unknown
  /** Geographic region - LowCardinality for compression, empty string = unknown */
  region: string & LowCardinality; // LowCardinality(String), "" = unknown

  // Many-to-Many Relationships (as arrays - no joins needed)
  /** All keyword IDs for this image - empty array [] if no keywords */
  keyword_ids: UInt32[];

  // Ethnicity: Both array and boolean columns for flexible querying
  /** All ethnicity IDs as array - empty array [] if no ethnicity */
  ethnicity_ids: UInt8[];
  /** Boolean: 1 if image has white ethnicity, 0 otherwise */
  ethnicity_white: boolean;
  /** Boolean: 1 if image has black ethnicity, 0 otherwise */
  ethnicity_black: boolean;
  /** Boolean: 1 if image has Asian ethnicity, 0 otherwise */
  ethnicity_asian: boolean;
  /** Boolean: 1 if image has Hispanic ethnicity, 0 otherwise */
  ethnicity_hispanic: boolean;
  /** Boolean: 1 if image has Middle Eastern ethnicity, 0 otherwise */
  ethnicity_middle_eastern: boolean;
  /** Boolean: 1 if image has Native American ethnicity, 0 otherwise */
  ethnicity_native_american: boolean;
  /** Boolean: 1 if image has Pacific Islander ethnicity, 0 otherwise */
  ethnicity_pacific_islander: boolean;
  /** Boolean: 1 if image has mixed ethnicity, 0 otherwise */
  ethnicity_mixed: boolean;
  /** Boolean: 1 if image has other ethnicity, 0 otherwise */
  ethnicity_other: boolean;

  // Presence Flags (critical filters)
  // High selectivity boolean filters - most common query filters
  // These are in the ordering key for optimal query performance
  /** Face presence flag (0/1) - FIRST in ordering key (most common filter) */
  has_face: boolean;
  /** Body presence flag (0/1) */
  has_body: boolean;
  /** Feet presence flag (0/1) */
  has_feet: boolean;
  /** Hands presence flag (0/1) */
  has_hands: boolean;
  /** Left hand presence flag (0/1) */
  has_left_hand: boolean;
  /** Right hand presence flag (0/1) */
  has_right_hand: boolean;
  /** Face is distant flag (0/1) */
  is_face_distant: boolean;
  /** Image is small flag (0/1) */
  is_small: boolean;
  /** Face has no landmarks flag (0/1) */
  is_face_no_lms: boolean;

  // Face Orientation (for "looking at camera" queries)
  // Use 0.0 for unknown/missing face orientation to avoid nullable performance penalty
  /** Face yaw angle - 0.0 = unknown/no face */
  face_x: Decimal<6, 3>; // 0.0 = unknown
  /** Face pitch angle - 0.0 = unknown/no face */
  face_y: Decimal<6, 3>; // 0.0 = unknown
  /** Face roll angle - 0.0 = unknown/no face */
  face_z: Decimal<6, 3>; // 0.0 = unknown
  /** Mouth gap measurement - 0.0 = unknown/no face */
  mouth_gap: Decimal<6, 3>; // 0.0 = unknown

  // Cluster Assignments
  // Nullable for unclustered values (NULL = not clustered)
  /** Body pose cluster (256 clusters) - NULL = not clustered */
  body_pose_cluster_256: UInt16 | null; // NULL = not clustered
  /** Body pose cluster (512 clusters) - THIRD in ordering key, NULL = not clustered */
  body_pose_cluster_512: UInt16 | null; // NULL = not clustered
  /** Body pose cluster (768 clusters) - NULL = not clustered */
  body_pose_cluster_768: UInt16 | null; // NULL = not clustered
  /** Hand poses cluster (32 clusters) - NULL = not clustered (new) */
  hand_poses_cluster_32: UInt8 | null; // NULL = not clustered
  
  /** DELETE THIS Hand gesture cluster (32 clusters) - kept for compatibility - NULL = not clustered */
  hand_gesture_cluster_32: UInt8 | null; // NULL = not clustered
  /** DELETE THIS Hand gesture cluster (64 clusters) - NULL = not clustered */
  hand_gesture_cluster_64: UInt8 | null; // NULL = not clustered
  /** Hand gesture cluster (128 clusters) - NULL = not clustered (new) */
  hand_gesture_cluster_128: UInt8 | null; // NULL = not clustered
  /** Arm poses 3D cluster (64 clusters) - NULL = not clustered (new) */
  arms_poses3D_cluster_64: UInt8 | null; // NULL = not clustered
  /** Arm poses 3D cluster (128 clusters) - NULL = not clustered (new) */
  arm_poses3D_cluster_128: UInt8 | null; // NULL = not clustered
  /** DELETE THIS Hand position cluster (128 clusters) - FOURTH in ordering key - NULL = not clustered */
  hand_position_cluster_128: UInt8 | null; // NULL = not clustered
  /** HSV color cluster - NULL = not clustered */
  hsv_cluster: UInt16 | null; // NULL = not clustered
  /** Meta HSV color cluster - NULL = not clustered (new) */
  meta_hsv_cluster: UInt16 | null; // NULL = not clustered
  /** Face cluster - NULL = not clustered */
  face_cluster: UInt16 | null; // NULL = not clustered

  // Topic Model Results (top 3 topics per image)
  // Use 0 for missing topics to avoid nullable performance penalty
  /** Primary topic ID - 0 = no topic */
  topic_id_1: UInt16; // 0 = no topic
  /** Primary topic score - Float32 sufficient precision, 0.0 = no topic */
  topic_score_1: Float32; // 0.0 = no topic
  /** Secondary topic ID - 0 = no secondary topic */
  topic_id_2: UInt16; // 0 = no secondary topic
  /** Secondary topic score - 0.0 = no secondary topic */
  topic_score_2: Float32; // 0.0 = no secondary topic
  /** Tertiary topic ID - 0 = no tertiary topic */
  topic_id_3: UInt16; // 0 = no tertiary topic
  /** Tertiary topic score - 0.0 = no tertiary topic */
  topic_score_3: Float32; // 0.0 = no tertiary topic

  // Additional topic-derived fields
  /** Topic id indicating 'not face' detection - NULL = none */
  is_not_face_topic_id: UInt16 | null;
  /** Score for is_not_face topic - 0.0 = none */
  is_not_face_score: Float32; // 0.0 = none
  /** Topic id for face model - NULL = none */
  is_face_model_topic_id: UInt16 | null;
  /** Score for is_face_model topic - 0.0 = none */
  is_face_model_score: Float32; // 0.0 = none
  /** Affect topic id - NULL = none */
  affect_id: UInt16 | null;
  /** Affect score - 0.0 = none */
  affect_score: Float32; // 0.0 = none

  // Detection Summaries (aggregated from Detections table during ETL)
  /** Total number of detections */
  detection_count: UInt16;
  /** Unique class IDs detected - empty array [] if no detections */
  detection_classes: UInt8[];
  /** Most common detected class - SECOND in ordering key, 0 = no detections */
  detection_top_class_id: UInt8; // 0 = no detections
  /** Confidence score of top detected class - 0.0 = no detections */
  detection_top_class_confidence: Float32; // 0.0 = no detections

  /** Object cluster - NULL = not clustered (future) */
  obj_cluster: UInt16 | null; // NULL = not clustered

  // Metadata
  /** Upload date - toDate('1970-01-01') = unknown (epoch date) */
  upload_date: Date;
  /** Image author - LowCardinality for compression, empty string = unknown */
  author: string & LowCardinality;
  /** Image caption - empty string = no caption */
  caption: string;
  /** Image content URL */
  content_url: string;
  /** Image width in pixels - 0 = unknown */
  width: UInt16; // 0 = unknown
  /** Image height in pixels - 0 = unknown */
  height: UInt16; // 0 = unknown

  // Duplicate Handling
  /** References duplicate image_id if this is a duplicate - 0 = not a duplicate */
  is_dupe_of: UInt32; // 0 = not a duplicate

  // Version column for ReplacingMergeTree
  /** Version column for deduplication - latest version wins */
  updated_at: DateTime;
}

/**
 * Images Analytical Table Definition
 *
 * ORDERING KEY RATIONALE:
 * Order by: (has_face, detection_top_class_id, body_pose_cluster_512, hand_position_cluster_128,
 *            site_name_id, location_id, upload_date, image_id)
 *
 * This ordering optimizes the most common query patterns:
 * 1. has_face (FIRST) - Most queries filter by face presence: WHERE has_face = 1
 *    Query impact: Face analysis queries are the primary use case
 *    Example: WHERE has_face = 1 → scans only face images (optimal)
 *
 * 2. detection_top_class_id (SECOND) - Object detection: WHERE has_face = 1 AND detection_top_class_id = X
 *    Query impact: Object detection queries are very efficient when combined with face filter
 *    Example: WHERE has_face = 1 AND detection_top_class_id = 67 → scans face images with phones (optimal)
 *
 * 3. body_pose_cluster_512 (THIRD) - Body pose analysis: WHERE has_face = 1 AND detection_top_class_id = X AND body_pose_cluster_512 = Y
 *    Query impact: Pose analysis queries benefit from face + object + pose filtering
 *    Example: WHERE has_face = 1 AND detection_top_class_id = 67 AND body_pose_cluster_512 = 42 → very efficient
 *
 * 4. hand_position_cluster_128 (FOURTH) - Hand/arm position: WHERE ... AND hand_position_cluster_128 = Z
 *    Query impact: Hand position queries are efficient when combined with previous filters
 *    Example: WHERE has_face = 1 AND hand_position_cluster_128 = 15 → efficient
 *
 * 5. site_name_id (FIFTH) - Site filtering: WHERE has_face = 1 AND site_name_id = 1
 *    Query impact: Site filtering is efficient when combined with face/object/pose filters
 *
 * 6. location_id (SIXTH) - Geographic analysis: WHERE has_face = 1 AND location_id = X
 *    Query impact: Geographic queries benefit when combined with previous filters
 *
 * 7. upload_date (SEVENTH) - Time-based queries: WHERE has_face = 1 AND upload_date >= X
 *    Query impact: Time-range queries are efficient when combined with prefix filters
 *    Also used for partitioning (PARTITION BY toYYYYMM(upload_date))
 *
 * 8. image_id (LAST) - Final uniqueness
 *    Query impact: Point queries by image_id are efficient (in ordering key)
 *
 * OPTIMAL QUERY PATTERNS (uses ordering key prefix):
 * - WHERE has_face = 1 → uses first column (optimal)
 * - WHERE has_face = 1 AND detection_top_class_id = 67 → uses first 2 columns (optimal)
 * - WHERE has_face = 1 AND detection_top_class_id = 67 AND body_pose_cluster_512 = 42 → uses first 3 columns (optimal)
 *
 * SUBOPTIMAL QUERY PATTERNS (skips ordering key columns):
 * - WHERE site_name_id = 1 → skips has_face, scans more data
 * - WHERE body_pose_cluster_512 = 42 → skips first 2 columns, relies on partitioning only
 *
 * ENGINE:
 * ReplacingMergeTree(updated_at) - handles duplicates from MySQL
 * - Uses updated_at as version column for deduplication
 * - Handles MySQL duplicates via is_dupe_of relationships
 * - Latest version wins during merges
 * - Deduplication happens in background after inserts
 */
export const imagesAnalytical = new OlapTable<ImagesAnalytical>(
  "images_analytical",
  {
    // ReplacingMergeTree engine handles duplicates via updated_at version column
    engine: ClickHouseEngines.ReplacingMergeTree,
    ver: "updated_at", // Version column for deduplication

    // Ordering key optimizes most common query patterns:
    // face presence → object detection → pose → hand position → site → location → date
    orderByFields: [
      "has_face", // FIRST: Most common filter
      "detection_top_class_id", // SECOND: Object presence filter
      "body_pose_cluster_512", // THIRD: Body pose analysis
      "hand_position_cluster_128", // FOURTH: Hand/arm position
      "site_name_id", // FIFTH: Site filtering
      "location_id", // SIXTH: Geographic analysis
      "upload_date", // SEVENTH: Time-based queries
      "image_id", // LAST: Final uniqueness
    ],

    // Monthly partitions enable efficient time-range queries
    // upload_date is non-nullable (uses epoch date for unknown), so no coalesce needed
    // No table partitioning is configured; use upload_date filters in WHERE clauses
    settings: {
      allow_nullable_key: "1"  // Enable nullable columns in ORDER BY (string value required by type)
    }
  },
);

