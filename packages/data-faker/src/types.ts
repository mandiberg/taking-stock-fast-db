// Type definitions matching ImagesAnalytical interface
// Used for data generation - types match the ClickHouse schema

export interface ImagesAnalyticalRow {
  image_id: number;

  // Site/Source Information
  site_name_id: number;
  site_name: string;
  site_image_id: string;

  // Demographics
  gender_id: number;
  gender: string;
  age_id: number;
  age: string;
  age_detail_id: number;
  location_id: number;
  country_code: string;
  region: string;

  // Many-to-Many Relationships
  keyword_ids: number[];

  // Ethnicity
  ethnicity_ids: number[];
  ethnicity_white: boolean;
  ethnicity_black: boolean;
  ethnicity_asian: boolean;
  ethnicity_hispanic: boolean;
  ethnicity_middle_eastern: boolean;
  ethnicity_native_american: boolean;
  ethnicity_pacific_islander: boolean;
  ethnicity_mixed: boolean;
  ethnicity_other: boolean;

  // Presence Flags
  has_face: boolean;
  has_body: boolean;
  has_feet: boolean;
  has_hands: boolean;
  has_left_hand: boolean;
  has_right_hand: boolean;
  is_face_distant: boolean;
  is_small: boolean;
  is_face_no_lms: boolean;

  // Face Orientation
  face_x: number;
  face_y: number;
  face_z: number;
  mouth_gap: number;

  // Cluster Assignments
  body_pose_cluster_256: number;
  body_pose_cluster_512: number;
  body_pose_cluster_768: number;
  hand_gesture_cluster_32: number;
  hand_gesture_cluster_64: number;
  hand_position_cluster_128: number;
  hsv_cluster: number;
  face_cluster: number;

  // Topic Model Results
  topic_id_1: number;
  topic_score_1: number;
  topic_id_2: number;
  topic_score_2: number;
  topic_id_3: number;
  topic_score_3: number;

  // Detection Summaries
  detection_count: number;
  detection_classes: number[];
  detection_top_class_id: number;
  detection_top_class_confidence: number;

  // Metadata
  upload_date: Date;
  author: string;
  caption: string;
  content_url: string;
  width: number;
  height: number;

  // Duplicate Handling
  is_dupe_of: number;

  // Version column
  updated_at: Date;
}

export interface CheckpointData {
  last_image_id: number;
  rows_inserted: number;
  batches_completed: number;
  start_time: string;
  last_checkpoint: string;
  seed: string;
  target_rows: number;
  batch_size: number;
  wait_for_async_insert?: boolean; // Whether to wait for async insert completion (default: true)
  total_time_seconds?: number;
  average_rate_rows_per_sec?: number;
}

