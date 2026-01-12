USE local;

SELECT *
FROM `images_analytical` i 
LIMIT 1000000;

SELECT COUNT(*)
FROM `images_analytical` i 
;

'''
I had to alter the table to reflect the changes in the data model
I ended up renaming the table and creating a new one because the col I was trying to alter was a pkey:

SQL Error [22000]: Code: 524. DB::Exception: ALTER of key column body_pose_cluster_512 from type UInt16 to type Nullable(UInt16) is not safe because it can change the representation of primary key. (ALTER_OF_COLUMN_IS_FORBIDDEN) (version 25.8.13.73 (official build)) 
'''

-- keep backup
RENAME TABLE local.images_analytical TO local.images_analytical_old;

-- then create the new table with the final schema (example)
CREATE TABLE IF NOT EXISTS local.images_analytical
(
    image_id UInt64,
    site_name_id UInt32,
    site_name String,
    site_image_id String,
    author String,
    caption String,
    content_url String,
    width UInt32,
    height UInt32,
    upload_date DateTime,

    -- Demographics
    gender_id UInt16,
    gender String,
    age_id UInt16,
    age String,
    age_detail_id UInt16,
    location_id UInt32,
    country_code String,
    region String,

    -- Many-to-many arrays
    keyword_ids Array(UInt32),
    ethnicity_ids Array(UInt16),

    -- Ethnicity flags
    ethnicity_white UInt8,
    ethnicity_black UInt8,
    ethnicity_asian UInt8,
    ethnicity_hispanic UInt8,
    ethnicity_middle_eastern UInt8,
    ethnicity_native_american UInt8,
    ethnicity_pacific_islander UInt8,
    ethnicity_mixed UInt8,
    ethnicity_other UInt8,

    -- Encoding flags
    has_face UInt8,
    has_body UInt8,
    has_feet UInt8,
    has_hands UInt8,
    has_left_hand UInt8,
    has_right_hand UInt8,
    is_face_distant UInt8,
    is_small UInt8,
    is_face_no_lms UInt8,

    -- Face orientation
    face_x Float32,
    face_y Float32,
    face_z Float32,
    mouth_gap Float32,

    -- Clusters (Nullable for non-clustered rows)
    body_pose_cluster_256 Nullable(UInt16),
    body_pose_cluster_512 Nullable(UInt16),
    body_pose_cluster_768 Nullable(UInt16),
    hand_poses_cluster_32 Nullable(UInt16),
    hand_gesture_cluster_32 Nullable(UInt16),
    hand_gesture_cluster_64 Nullable(UInt16),
    hand_gesture_cluster_128 Nullable(UInt16),
    arms_poses3D_cluster_64 Nullable(UInt16),
    arm_poses3D_cluster_128 Nullable(UInt16),
    hand_position_cluster_128 Nullable(UInt16),
    hsv_cluster Nullable(UInt16),
    meta_hsv_cluster Nullable(UInt16),
    face_cluster Nullable(UInt16),
    obj_cluster Nullable(UInt16),

    -- Topics / affect / model flags (nullable where source can be missing)
    is_not_face_topic_id Nullable(UInt16),
    is_not_face_score Nullable(Float32),
    is_face_model_topic_id Nullable(UInt16),
    is_face_model_score Nullable(Float32),
    affect_id Nullable(UInt16),
    affect_score Nullable(Float32),

    -- Topic id/score slots
    topic_id_1 Nullable(UInt16),
    topic_score_1 Nullable(Float32),
    topic_id_2 Nullable(UInt16),
    topic_score_2 Nullable(Float32),
    topic_id_3 Nullable(UInt16),
    topic_score_3 Nullable(Float32),

    -- Detections / classes
    detection_count UInt32,
    detection_classes Array(UInt16) DEFAULT [],
    detection_top_class_id UInt16,
    detection_top_class_confidence Float32,

    -- Misc / housekeeping
    is_dupe_of UInt64,
    updated_at DateTime
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(upload_date)
ORDER BY (site_name_id, upload_date, image_id);