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

  // Cluster Assignments (nullable for unclustered)
  body_pose_cluster_256: number | null;
  body_pose_cluster_512: number | null;
  body_pose_cluster_768: number | null;
  hand_poses_cluster_32: number | null;          // new
  hand_gesture_cluster_32: number | null;       // keep old name nullable for backwards compatibility
  hand_gesture_cluster_64: number | null;
  hand_gesture_cluster_128: number | null;      // new
  arms_poses3D_cluster_64: number | null;       // new
  hand_position_cluster_128: number | null;
  hsv_cluster: number | null;
  meta_hsv_cluster: number | null;              // new
  face_cluster: number | null;
  arm_poses3D_cluster_128: number | null; // new (128 clusters)

  // Topic Model Results
  topic_id_1: number;
  topic_score_1: number;
  topic_id_2: number;
  topic_score_2: number;
  topic_id_3: number;
  topic_score_3: number;

  // Additional topic-derived fields
  is_not_face_topic_id: number | null;
  is_not_face_score: number;
  is_face_model_topic_id: number | null;
  is_face_model_score: number;
  affect_id: number | null;
  affect_score: number;

  // Detection Summaries
  obj_cluster: number | null; // future object cluster
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
  total_time_seconds?: number;
  average_rate_rows_per_sec?: number;
}

