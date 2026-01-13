# Data Migration Guide

This guide walks you through migrating ~200GB of MySQL data and MongoDB collections into the ClickHouse `images_analytical` table for the MooseStack service.

## Table of Contents

1. [Prerequisites & Setup](#prerequisites--setup)
2. [Understanding the Data Flow](#understanding-the-data-flow)
3. [Migration Strategy for Large Data Volumes](#migration-strategy-for-large-data-volumes)
4. [MySQL Data Extraction](#mysql-data-extraction)
5. [MongoDB Data Extraction](#mongodb-data-extraction)
6. [Data Transformation & Denormalization](#data-transformation--denormalization)
7. [ClickHouse Insert Methods](#clickhouse-insert-methods)
8. [Local Mac Studio Migration](#local-mac-studio-migration)
9. [Boreal Hosting Migration](#boreal-hosting-migration)
10. [Verification & Testing](#verification--testing)
11. [Troubleshooting](#troubleshooting)

## Prerequisites & Setup

### Required Tools

Install the following tools on your system:

```bash
# MySQL client (if not already installed)
brew install mysql-client  # macOS
# or
sudo apt-get install mysql-client  # Linux

# MongoDB tools
brew install mongodb-database-tools  # macOS
# or
sudo apt-get install mongodb-database-tools  # Linux

# ClickHouse client
curl https://clickhouse.com/ | sh
# or download from https://clickhouse.com/docs/en/integrations/clickhouse-clients
```

### Verify Database Access

**MySQL:**
```bash
mysql -h <mysql_host> -u <username> -p <database_name> -e "SELECT COUNT(*) FROM Images;"
```

**MongoDB:**
```bash
mongosh "mongodb://<host>:<port>/<database>" --eval "db.encodings.countDocuments()"
```

**ClickHouse (Local):**
```bash
clickhouse-client --host localhost --port 9000 --user panda --password pandapass --database local
```

**ClickHouse (Boreal):**
```bash
clickhouse-client --host <boreal_host> --port <boreal_port> --user <username> --password <password> --database <database>
```

### Understand Target Schema

The target table `images_analytical` is defined in `packages/moosestack-service/app/ingest/models.ts`. Key points:

- **Denormalized wide table**: All data flattened into a single table
- **Sentinel values**: Use `0` for unknown IDs, `""` for unknown strings, `'1970-01-01'` for unknown dates
- **Arrays for many-to-many**: Keywords and ethnicity stored as arrays
- **ReplacingMergeTree**: Uses `updated_at` for deduplication

Review the schema file and `context/mandiberg_sql_columns_202512251655.csv` for source table structures.

## Understanding the Data Flow

### Source Data

**MySQL (~144 tables):**
- `Images` - Core image metadata
- `Encodings` - Face/body detection flags and measurements
- `Detections` - Object detection results
- `ImagesKeywords` - Many-to-many keyword relationships
- `ImagesEthnicity` - Many-to-many ethnicity relationships
- `ImagesTopics` - Topic model assignments
- `ImagesBodyPoses3D256/512/768` - Body pose cluster assignments
- `ImagesHandsGestures32/64` - Hand gesture cluster assignments
- `ImagesHandsPositions128` - Hand position cluster assignments
- `ImagesHSV` - HSV color cluster assignments
- Lookup tables: `Site`, `Gender`, `Age`, `AgeDetail`, `Location`, `Ethnicity`, `Keywords`

**MongoDB Collections:**
- `encodings` - Face/body landmarks (binary BSON)
- `body_world_landmarks` - Body world landmarks (binary BSON)
- `body_landmarks_norm` - Normalized body landmarks (binary BSON)
- `hand_landmarks` - Hand landmarks (binary BSON)

### Target Table

Single denormalized `images_analytical` table combining:
- All MySQL metadata flattened into columns
- MongoDB presence flags derived from binary data existence
- Arrays for many-to-many relationships (keywords, ethnicity)
- Boolean columns for ethnicity categories

## Migration Strategy for Large Data Volumes

### Batch Processing Approach

For ~200GB of MySQL data, process in batches to avoid memory issues:

1. **Process by image_id ranges**: Split migration into chunks (e.g., 10K-100K images per batch)
2. **Parallel processing**: Run multiple batches in parallel if safe (non-overlapping ranges)
3. **Progress tracking**: Log progress and checkpoint ranges for resumability
4. **Incremental updates**: Use `updated_at` timestamp to handle updates vs full migration

### Recommended Batch Size

- **Small batches (10K rows)**: For initial testing and validation
- **Medium batches (50K rows)**: For steady migration progress
- **Large batches (100K+ rows)**: For faster migration once validated

Adjust based on:
- Available memory
- Network bandwidth (for Boreal)
- ClickHouse insert performance

## MySQL Data Extraction

### Core Image Metadata Query

Extract core image data with denormalized lookups:

```sql
SELECT 
    i.image_id,
    COALESCE(i.site_name_id, 0) AS site_name_id,
    COALESCE(s.site_name, '') AS site_name,
    COALESCE(i.site_image_id, '') AS site_image_id,
    COALESCE(i.author, '') AS author,
    COALESCE(i.caption, '') AS caption,
    COALESCE(i.contentUrl, '') AS content_url,
    COALESCE(i.w, 0) AS width,
    COALESCE(i.h, 0) AS height,
    COALESCE(i.uploadDate, '1970-01-01') AS upload_date,
    COALESCE(i.gender_id, 0) AS gender_id,
    COALESCE(g.gender, '') AS gender,
    COALESCE(i.age_id, 0) AS age_id,
    COALESCE(a.age, '') AS age,
    COALESCE(i.age_detail_id, 0) AS age_detail_id,
    COALESCE(i.location_id, 0) AS location_id,
    COALESCE(l.code_alpha3, '') AS country_code,
    COALESCE(l.region, '') AS region,
    COALESCE(e.is_dupe_of, 0) AS is_dupe_of
FROM Images i
LEFT JOIN Site s ON i.site_name_id = s.site_name_id
LEFT JOIN Gender g ON i.gender_id = g.gender_id
LEFT JOIN Age a ON i.age_id = a.age_id
LEFT JOIN Location l ON i.location_id = l.location_id
LEFT JOIN Encodings e ON i.image_id = e.image_id
WHERE i.image_id >= ? AND i.image_id < ?
ORDER BY i.image_id;
```

### Encoding/Detection Data Query

Extract face/body detection flags and measurements:

```sql
SELECT 
    e.image_id,
    COALESCE(e.is_face, 0) AS has_face,
    COALESCE(e.is_body, 0) AS has_body,
    COALESCE(e.is_feet, 0) AS has_feet,
    COALESCE(e.is_hand_left, 0) AS has_left_hand,
    COALESCE(e.is_hand_right, 0) AS has_right_hand,
    CASE WHEN e.is_hand_left = 1 OR e.is_hand_right = 1 THEN 1 ELSE 0 END AS has_hands,
    COALESCE(e.is_face_distant, 0) AS is_face_distant,
    COALESCE(e.is_small, 0) AS is_small,
    COALESCE(e.is_face_no_lms, 0) AS is_face_no_lms,
    COALESCE(e.face_x, 0.0) AS face_x,
    COALESCE(e.face_y, 0.0) AS face_y,
    COALESCE(e.face_z, 0.0) AS face_z,
    COALESCE(e.mouth_gap, 0.0) AS mouth_gap
FROM Encodings e
WHERE e.image_id >= ? AND e.image_id < ?;
```

### Keywords Array Extraction

Extract keywords as array for each image:

```sql
SELECT 
    ik.image_id,
    GROUP_CONCAT(ik.keyword_id ORDER BY ik.keyword_id) AS keyword_ids
FROM ImagesKeywords ik
WHERE ik.image_id >= ? AND ik.image_id < ?
GROUP BY ik.image_id;
```

**Note**: Convert comma-separated string to array in transformation step.

### Ethnicity Array and Booleans Extraction

Extract ethnicity relationships and create boolean flags:

```sql
SELECT 
    ie.image_id,
    GROUP_CONCAT(ie.ethnicity_id ORDER BY ie.ethnicity_id) AS ethnicity_ids,
    MAX(CASE WHEN e.ethnicity LIKE '%white%' OR e.ethnicity LIKE '%caucasian%' THEN 1 ELSE 0 END) AS ethnicity_white,
    MAX(CASE WHEN e.ethnicity LIKE '%black%' THEN 1 ELSE 0 END) AS ethnicity_black,
    MAX(CASE WHEN e.ethnicity LIKE '%asian%' OR e.ethnicity LIKE '%eastasian%' OR e.ethnicity LIKE '%southasian%' OR e.ethnicity LIKE '%southeastasian%' THEN 1 ELSE 0 END) AS ethnicity_asian,
    MAX(CASE WHEN e.ethnicity LIKE '%hispanic%' OR e.ethnicity LIKE '%latino%' OR e.ethnicity LIKE '%afrolatinx%' THEN 1 ELSE 0 END) AS ethnicity_hispanic,
    MAX(CASE WHEN e.ethnicity LIKE '%middleeastern%' THEN 1 ELSE 0 END) AS ethnicity_middle_eastern,
    MAX(CASE WHEN e.ethnicity LIKE '%nativeamerican%' OR e.ethnicity LIKE '%firstnations%' THEN 1 ELSE 0 END) AS ethnicity_native_american,
    MAX(CASE WHEN e.ethnicity LIKE '%pacificislander%' THEN 1 ELSE 0 END) AS ethnicity_pacific_islander,
    MAX(CASE WHEN e.ethnicity LIKE '%mixed%' OR e.ethnicity LIKE '%mixedrace%' THEN 1 ELSE 0 END) AS ethnicity_mixed,
    MAX(CASE WHEN e.ethnicity NOT LIKE '%white%' AND e.ethnicity NOT LIKE '%black%' AND e.ethnicity NOT LIKE '%asian%' AND e.ethnicity NOT LIKE '%hispanic%' AND e.ethnicity NOT LIKE '%middleeastern%' AND e.ethnicity NOT LIKE '%nativeamerican%' AND e.ethnicity NOT LIKE '%pacificislander%' AND e.ethnicity NOT LIKE '%mixed%' THEN 1 ELSE 0 END) AS ethnicity_other
FROM ImagesEthnicity ie
LEFT JOIN Ethnicity e ON ie.ethnicity_id = e.ethnicity_id
WHERE ie.image_id >= ? AND ie.image_id < ?
GROUP BY ie.image_id;
```

### Cluster Assignments Extraction

Extract body pose, hand gesture, and position clusters:

```sql
SELECT 
    image_id,
    COALESCE(MAX(CASE WHEN cluster_id IS NOT NULL THEN cluster_id ELSE 0 END), 0) AS body_pose_cluster_256
FROM ImagesBodyPoses3D256
WHERE image_id >= ? AND image_id < ?
GROUP BY image_id;

SELECT 
    image_id,
    COALESCE(MAX(CASE WHEN cluster_id IS NOT NULL THEN cluster_id ELSE 0 END), 0) AS body_pose_cluster_512
FROM ImagesBodyPoses3D512
WHERE image_id >= ? AND image_id < ?
GROUP BY image_id;

SELECT 
    image_id,
    COALESCE(MAX(CASE WHEN cluster_id IS NOT NULL THEN cluster_id ELSE 0 END), 0) AS body_pose_cluster_768
FROM ImagesBodyPoses3D768
WHERE image_id >= ? AND image_id < ?
GROUP BY image_id;

SELECT 
    image_id,
    COALESCE(MAX(CASE WHEN cluster_id IS NOT NULL THEN cluster_id ELSE 0 END), 0) AS hand_gesture_cluster_32
FROM ImagesHandsGestures32
WHERE image_id >= ? AND image_id < ?
GROUP BY image_id;

SELECT 
    image_id,
    COALESCE(MAX(CASE WHEN cluster_id IS NOT NULL THEN cluster_id ELSE 0 END), 0) AS hand_gesture_cluster_64
FROM ImagesHandsGestures64
WHERE image_id >= ? AND image_id < ?
GROUP BY image_id;

SELECT 
    image_id,
    COALESCE(MAX(CASE WHEN cluster_id IS NOT NULL THEN cluster_id ELSE 0 END), 0) AS hand_position_cluster_128
FROM ImagesHandsPositions128
WHERE image_id >= ? AND image_id < ?
GROUP BY image_id;

SELECT 
    image_id,
    COALESCE(MAX(CASE WHEN cluster_id IS NOT NULL THEN cluster_id ELSE 0 END), 0) AS hsv_cluster
FROM ImagesHSV
WHERE image_id >= ? AND image_id < ?
GROUP BY image_id;
```

### Topic Model Results Extraction

Extract top 3 topics per image:

```sql
SELECT 
    image_id,
    COALESCE(MAX(CASE WHEN topic_id IS NOT NULL THEN topic_id ELSE 0 END), 0) AS topic_id_1,
    COALESCE(MAX(CASE WHEN topic_id IS NOT NULL THEN topic_score ELSE 0.0 END), 0.0) AS topic_score_1,
    COALESCE(MAX(CASE WHEN topic_id2 IS NOT NULL THEN topic_id2 ELSE 0 END), 0) AS topic_id_2,
    COALESCE(MAX(CASE WHEN topic_id2 IS NOT NULL THEN topic_score2 ELSE 0.0 END), 0.0) AS topic_score_2,
    COALESCE(MAX(CASE WHEN topic_id3 IS NOT NULL THEN topic_id3 ELSE 0 END), 0) AS topic_id_3,
    COALESCE(MAX(CASE WHEN topic_id3 IS NOT NULL THEN topic_score3 ELSE 0.0 END), 0.0) AS topic_score_3
FROM ImagesTopics
WHERE image_id >= ? AND image_id < ?
GROUP BY image_id;
```

### Detection Summaries Extraction

Aggregate detection data:

```sql
SELECT 
    d.image_id,
    COUNT(*) AS detection_count,
    GROUP_CONCAT(DISTINCT d.class_id ORDER BY d.class_id) AS detection_classes,
    (
        SELECT class_id 
        FROM Detections d2 
        WHERE d2.image_id = d.image_id 
        GROUP BY class_id 
        ORDER BY COUNT(*) DESC, MAX(d2.conf) DESC 
        LIMIT 1
    ) AS detection_top_class_id,
    (
        SELECT MAX(conf) 
        FROM Detections d3 
        WHERE d3.image_id = d.image_id 
        AND d3.class_id = (
            SELECT class_id 
            FROM Detections d2 
            WHERE d2.image_id = d.image_id 
            GROUP BY class_id 
            ORDER BY COUNT(*) DESC, MAX(d2.conf) DESC 
            LIMIT 1
        )
    ) AS detection_top_class_confidence
FROM Detections d
WHERE d.image_id >= ? AND d.image_id < ?
GROUP BY d.image_id;
```

## MongoDB Data Extraction

### Check MongoDB Collection Sizes

```bash
mongosh "mongodb://<host>:<port>/<database>" --eval "
db.encodings.countDocuments();
db.body_world_landmarks.countDocuments();
db.body_landmarks_norm.countDocuments();
db.hand_landmarks.countDocuments();
"
```

### Extract Presence Flags from MongoDB

MongoDB collections contain binary BSON data. We only need to check for existence to set presence flags:

```javascript
// Extract image_ids with face/body landmarks from encodings collection
db.encodings.aggregate([
  {
    $project: {
      image_id: 1,
      has_face_landmarks: { $cond: [{ $ifNull: ["$face_landmarks", false] }, 1, 0] },
      has_body_landmarks: { $cond: [{ $ifNull: ["$body_landmarks", false] }, 1, 0] },
      has_face_encodings: { $cond: [{ $ifNull: ["$face_encodings68", false] }, 1, 0] }
    }
  },
  { $match: { image_id: { $gte: <start_id>, $lt: <end_id> } } },
  { $out: "mongo_encodings_flags_temp" }
]);

// Extract body world landmarks presence
db.body_world_landmarks.aggregate([
  {
    $project: {
      image_id: 1,
      has_body_world_landmarks: 1
    }
  },
  { $match: { image_id: { $gte: <start_id>, $lt: <end_id> } } },
  { $out: "mongo_body_world_flags_temp" }
]);

// Extract normalized landmarks presence
db.body_landmarks_norm.aggregate([
  {
    $project: {
      image_id: 1,
      has_body_landmarks_norm: 1
    }
  },
  { $match: { image_id: { $gte: <start_id>, $lt: <end_id> } } },
  { $out: "mongo_body_norm_flags_temp" }
]);

// Extract hand landmarks presence
db.hand_landmarks.aggregate([
  {
    $project: {
      image_id: 1,
      has_left_hand: { $cond: [{ $ifNull: ["$left_hand", false] }, 1, 0] },
      has_right_hand: { $cond: [{ $ifNull: ["$right_hand", false] }, 1, 0] }
    }
  },
  { $match: { image_id: { $gte: <start_id>, $lt: <end_id> } } },
  { $out: "mongo_hand_flags_temp" }
]);
```

### Export MongoDB Flags to CSV

```bash
# Export encodings flags
mongoexport --uri="mongodb://<host>:<port>/<database>" \
  --collection=mongo_encodings_flags_temp \
  --type=csv \
  --fields=image_id,has_face_landmarks,has_body_landmarks,has_face_encodings \
  --out=encodings_flags.csv

# Export body world landmarks flags
mongoexport --uri="mongodb://<host>:<port>/<database>" \
  --collection=mongo_body_world_flags_temp \
  --type=csv \
  --fields=image_id,has_body_world_landmarks \
  --out=body_world_flags.csv

# Export normalized landmarks flags
mongoexport --uri="mongodb://<host>:<port>/<database>" \
  --collection=mongo_body_norm_flags_temp \
  --type=csv \
  --fields=image_id,has_body_landmarks_norm \
  --out=body_norm_flags.csv

# Export hand landmarks flags
mongoexport --uri="mongodb://<host>:<port>/<database>" \
  --collection=mongo_hand_flags_temp \
  --type=csv \
  --fields=image_id,has_left_hand,has_right_hand \
  --out=hand_flags.csv
```

## Data Transformation & Denormalization

### Combine MySQL Queries into Single Denormalized Query

Create a comprehensive query that joins all MySQL tables:

```sql
SELECT 
    -- Core image metadata
    i.image_id,
    COALESCE(i.site_name_id, 0) AS site_name_id,
    COALESCE(s.site_name, '') AS site_name,
    COALESCE(i.site_image_id, '') AS site_image_id,
    COALESCE(i.author, '') AS author,
    COALESCE(i.caption, '') AS caption,
    COALESCE(i.contentUrl, '') AS content_url,
    COALESCE(i.w, 0) AS width,
    COALESCE(i.h, 0) AS height,
    COALESCE(i.uploadDate, '1970-01-01') AS upload_date,
    
    -- Demographics
    COALESCE(i.gender_id, 0) AS gender_id,
    COALESCE(g.gender, '') AS gender,
    COALESCE(i.age_id, 0) AS age_id,
    COALESCE(a.age, '') AS age,
    COALESCE(i.age_detail_id, 0) AS age_detail_id,
    COALESCE(i.location_id, 0) AS location_id,
    COALESCE(l.code_alpha3, '') AS country_code,
    COALESCE(l.region, '') AS region,
    
    -- Encoding flags
    COALESCE(e.is_face, 0) AS has_face,
    COALESCE(e.is_body, 0) AS has_body,
    COALESCE(e.is_feet, 0) AS has_feet,
    COALESCE(e.is_hand_left, 0) AS has_left_hand,
    COALESCE(e.is_hand_right, 0) AS has_right_hand,
    CASE WHEN e.is_hand_left = 1 OR e.is_hand_right = 1 THEN 1 ELSE 0 END AS has_hands,
    COALESCE(e.is_face_distant, 0) AS is_face_distant,
    COALESCE(e.is_small, 0) AS is_small,
    COALESCE(e.is_face_no_lms, 0) AS is_face_no_lms,
    
    -- Face orientation
    COALESCE(e.face_x, 0.0) AS face_x,
    COALESCE(e.face_y, 0.0) AS face_y,
    COALESCE(e.face_z, 0.0) AS face_z,
    COALESCE(e.mouth_gap, 0.0) AS mouth_gap,
    
    -- Clusters
    COALESCE(bp256.cluster_id, 0) AS body_pose_cluster_256,
    COALESCE(bp512.cluster_id, 0) AS body_pose_cluster_512,
    COALESCE(bp768.cluster_id, 0) AS body_pose_cluster_768,
    COALESCE(hg32.cluster_id, 0) AS hand_gesture_cluster_32,
    COALESCE(hg64.cluster_id, 0) AS hand_gesture_cluster_64,
    COALESCE(hp128.cluster_id, 0) AS hand_position_cluster_128,
    COALESCE(hsv.cluster_id, 0) AS hsv_cluster,
    
    -- Topics
    COALESCE(t.topic_id, 0) AS topic_id_1,
    COALESCE(t.topic_score, 0.0) AS topic_score_1,
    COALESCE(t.topic_id2, 0) AS topic_id_2,
    COALESCE(t.topic_score2, 0.0) AS topic_score_2,
    COALESCE(t.topic_id3, 0) AS topic_id_3,
    COALESCE(t.topic_score3, 0.0) AS topic_score_3,
    
    -- Detection summaries
    COALESCE(det.detection_count, 0) AS detection_count,
    COALESCE(det.detection_top_class_id, 0) AS detection_top_class_id,
    COALESCE(det.detection_top_class_confidence, 0.0) AS detection_top_class_confidence,
    
    -- Duplicate handling
    COALESCE(e.is_dupe_of, 0) AS is_dupe_of,
    
    -- Updated timestamp (use current time for migration)
    NOW() AS updated_at
    
FROM Images i
LEFT JOIN Site s ON i.site_name_id = s.site_name_id
LEFT JOIN Gender g ON i.gender_id = g.gender_id
LEFT JOIN Age a ON i.age_id = a.age_id
LEFT JOIN Location l ON i.location_id = l.location_id
LEFT JOIN Encodings e ON i.image_id = e.image_id
LEFT JOIN ImagesBodyPoses3D256 bp256 ON i.image_id = bp256.image_id
LEFT JOIN ImagesBodyPoses3D512 bp512 ON i.image_id = bp512.image_id
LEFT JOIN ImagesBodyPoses3D768 bp768 ON i.image_id = bp768.image_id
LEFT JOIN ImagesHandsGestures32 hg32 ON i.image_id = hg32.image_id
LEFT JOIN ImagesHandsGestures64 hg64 ON i.image_id = hg64.image_id
LEFT JOIN ImagesHandsPositions128 hp128 ON i.image_id = hp128.image_id
LEFT JOIN ImagesHSV hsv ON i.image_id = hsv.image_id
LEFT JOIN ImagesTopics t ON i.image_id = t.image_id
LEFT JOIN (
    SELECT 
        image_id,
        COUNT(*) AS detection_count,
        (
            SELECT class_id 
            FROM Detections d2 
            WHERE d2.image_id = d.image_id 
            GROUP BY class_id 
            ORDER BY COUNT(*) DESC, MAX(d2.conf) DESC 
            LIMIT 1
        ) AS detection_top_class_id,
        (
            SELECT MAX(conf) 
            FROM Detections d3 
            WHERE d3.image_id = d.image_id 
            AND d3.class_id = (
                SELECT class_id 
                FROM Detections d2 
                WHERE d2.image_id = d.image_id 
                GROUP BY class_id 
                ORDER BY COUNT(*) DESC, MAX(d2.conf) DESC 
                LIMIT 1
            )
        ) AS detection_top_class_confidence
    FROM Detections d
    GROUP BY image_id
) det ON i.image_id = det.image_id
WHERE i.image_id >= ? AND i.image_id < ?
ORDER BY i.image_id;
```

### Add Keywords and Ethnicity Arrays

After extracting keywords and ethnicity separately, merge them into the main dataset:

```python
# Pseudocode for transformation script
def transform_row(mysql_row, keywords_dict, ethnicity_dict):
    image_id = mysql_row['image_id']
    
    # Add keyword array
    mysql_row['keyword_ids'] = keywords_dict.get(image_id, [])
    
    # Add ethnicity array and booleans
    ethnicity_data = ethnicity_dict.get(image_id, {})
    mysql_row['ethnicity_ids'] = ethnicity_data.get('ethnicity_ids', [])
    mysql_row['ethnicity_white'] = ethnicity_data.get('ethnicity_white', 0)
    mysql_row['ethnicity_black'] = ethnicity_data.get('ethnicity_black', 0)
    # ... other ethnicity booleans
    
    return mysql_row
```

### Handle Sentinel Values

Ensure all NULL values are converted to sentinel values:

- **IDs**: `NULL` → `0`
- **Strings**: `NULL` → `""`
- **Dates**: `NULL` → `'1970-01-01'`
- **Floats**: `NULL` → `0.0`
- **Arrays**: `NULL` → `[]`

## ClickHouse Insert Methods

### Direct SQL INSERT (Recommended)

For large volumes, use direct INSERT statements with VALUES format:

```sql
INSERT INTO images_analytical VALUES
(1, 1, 'Getty', 'getty-123', 0, '', 0, '', 0, 0, '', '', [], [], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0, 0.0, 0.0, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0, 0, 0.0, 0, 0.0, 0, [], 0, 0.0, '1970-01-01', '', '', '', 0, 0, 0, '2024-01-01 00:00:00'),
(2, 2, 'Shutterstock', 'shutterstock-456', 1, 'male', 2, 'adult', 0, 1, 'USA', 'North America', [1, 2, 3], [1], 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.5, -0.2, 0.1, 0.3, 42, 100, 0, 5, 10, 15, 0, 0, 10, 0.85, 20, 0.75, 30, 0.65, 2, [67, 68], 67, 0.92, '2024-01-15', 'John Doe', 'Portrait', 'https://example.com/image.jpg', 1920, 1080, 0, '2024-01-15 12:00:00');
```

### Using clickhouse-client

**Local:**
```bash
clickhouse-client --host localhost --port 9000 --user panda --password pandapass --database local \
  --query "INSERT INTO images_analytical FORMAT CSV" < data_batch.csv
```

**Boreal:**
```bash
clickhouse-client --host <boreal_host> --port <boreal_port> --user <username> --password <password> --database <database> \
  --query "INSERT INTO images_analytical FORMAT CSV" < data_batch.csv
```

### Batch Insert Script Example

```python
#!/usr/bin/env python3
import mysql.connector
import clickhouse_connect
import json
from datetime import datetime

# Connection configs
MYSQL_CONFIG = {
    'host': '<mysql_host>',
    'user': '<mysql_user>',
    'password': '<mysql_password>',
    'database': '<mysql_database>'
}

CLICKHOUSE_CONFIG = {
    'host': '<clickhouse_host>',
    'port': 9000,
    'username': '<clickhouse_user>',
    'password': '<clickhouse_password>',
    'database': '<clickhouse_database>'
}

BATCH_SIZE = 10000

def extract_batch(mysql_conn, start_id, end_id):
    """Extract and transform a batch of images"""
    cursor = mysql_conn.cursor(dictionary=True)
    
    # Main query (use the comprehensive query from above)
    query = """
    SELECT ... FROM Images i ...
    WHERE i.image_id >= %s AND i.image_id < %s
    """
    
    cursor.execute(query, (start_id, end_id))
    return cursor.fetchall()

def transform_row(row, keywords_dict, ethnicity_dict):
    """Transform MySQL row to ClickHouse format"""
    # Add arrays and handle sentinel values
    # ... transformation logic ...
    return transformed_row

def insert_batch(clickhouse_client, rows):
    """Insert batch into ClickHouse"""
    if not rows:
        return
    
    # Format rows for INSERT
    values = []
    for row in rows:
        values.append((
            row['image_id'],
            row['site_name_id'],
            row['site_name'],
            # ... all columns ...
            row['updated_at']
        ))
    
    clickhouse_client.insert('images_analytical', values)

def migrate_range(start_id, end_id):
    """Migrate a range of image_ids"""
    mysql_conn = mysql.connector.connect(**MYSQL_CONFIG)
    clickhouse_client = clickhouse_connect.get_client(**CLICKHOUSE_CONFIG)
    
    current_id = start_id
    while current_id < end_id:
        batch_end = min(current_id + BATCH_SIZE, end_id)
        
        # Extract
        mysql_rows = extract_batch(mysql_conn, current_id, batch_end)
        
        # Transform
        transformed_rows = [transform_row(row, keywords_dict, ethnicity_dict) for row in mysql_rows]
        
        # Insert
        insert_batch(clickhouse_client, transformed_rows)
        
        print(f"Migrated {current_id} to {batch_end}")
        current_id = batch_end
    
    mysql_conn.close()
    clickhouse_client.close()

if __name__ == '__main__':
    # Get total range
    mysql_conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = mysql_conn.cursor()
    cursor.execute("SELECT MIN(image_id), MAX(image_id) FROM Images")
    min_id, max_id = cursor.fetchone()
    mysql_conn.close()
    
    migrate_range(min_id, max_id)
```

### Handling ReplacingMergeTree Deduplication

The `images_analytical` table uses `ReplacingMergeTree(updated_at)`. To ensure proper deduplication:

1. **Set `updated_at` to current timestamp** for all migrated rows
2. **For updates**, set `updated_at` to a newer timestamp than existing rows
3. **Deduplication happens automatically** during background merges
4. **Force merge** if needed: `OPTIMIZE TABLE images_analytical FINAL;`

## Local Mac Studio Migration

### Prerequisites

1. Ensure MooseStack service is running locally
2. Verify ClickHouse is accessible at `localhost:9000`
3. Check credentials in `packages/moosestack-service/moose.config.toml`

### Connection Details

From `moose.config.toml`:
- Host: `localhost`
- Port: `9000` (native) or `18123` (HTTP)
- User: `panda`
- Password: `pandapass`
- Database: `local`

### Migration Steps

1. **Test connection:**
```bash
clickhouse-client --host localhost --port 9000 --user panda --password pandapass --database local \
  --query "SELECT COUNT(*) FROM images_analytical"
```

2. **Run migration script** (adjust connection details):
```bash
python3 migrate_data.py --mysql-host <host> --mysql-user <user> --mysql-password <password> \
  --clickhouse-host localhost --clickhouse-user panda --clickhouse-password pandapass \
  --database local --batch-size 50000
```

3. **Monitor progress:**
```bash
# Check row count
clickhouse-client --host localhost --port 9000 --user panda --password pandapass --database local \
  --query "SELECT COUNT(*) FROM images_analytical"

# Check latest migrated image_id
clickhouse-client --host localhost --port 9000 --user panda --password pandapass --database local \
  --query "SELECT MAX(image_id) FROM images_analytical"
```

### Resource Monitoring

Monitor system resources during migration:

```bash
# CPU and memory
top -l 1 | grep -E "CPU|Mem"

# Disk I/O
iostat -w 1

# ClickHouse system tables
clickhouse-client --host localhost --port 9000 --user panda --password pandapass --database local \
  --query "SELECT * FROM system.processes"
```

## Boreal Hosting Migration

### Prerequisites

1. Obtain Boreal ClickHouse connection details
2. Ensure network access from your machine to Boreal
3. Verify credentials and database name

### Connection Details

Update connection details in your migration script:

```python
CLICKHOUSE_CONFIG = {
    'host': '<boreal_host>',  # Provided by Boreal
    'port': <boreal_port>,     # Usually 9000 or 9440 (SSL)
    'username': '<boreal_username>',
    'password': '<boreal_password>',
    'database': '<boreal_database>',
    'secure': True  # If using SSL
}
```

### Migration Steps

1. **Test connection:**
```bash
clickhouse-client --host <boreal_host> --port <boreal_port> --user <username> --password <password> \
  --database <database> --secure \
  --query "SELECT COUNT(*) FROM images_analytical"
```

2. **Run migration with network considerations:**
   - Use smaller batch sizes (10K-50K) to avoid timeouts
   - Monitor network bandwidth
   - Consider running during off-peak hours
   - Use compression if available

3. **Monitor remote progress:**
```bash
clickhouse-client --host <boreal_host> --port <boreal_port> --user <username> --password <password> \
  --database <database> --secure \
  --query "SELECT COUNT(*) FROM images_analytical"
```

### Network Optimization

For large data transfers to Boreal:

1. **Use compression:**
```bash
clickhouse-client --compression true --host <boreal_host> ...
```

2. **Increase timeout:**
```python
CLICKHOUSE_CONFIG = {
    # ... other config ...
    'connect_timeout': 300,
    'send_receive_timeout': 600
}
```

3. **Batch size tuning:**
   - Start with 10K rows per batch
   - Increase if network is stable
   - Monitor for timeouts and adjust

## Verification & Testing

### Row Count Verification

Compare source and target row counts:

**MySQL:**
```sql
SELECT COUNT(*) FROM Images;
```

**ClickHouse:**
```sql
SELECT COUNT(*) FROM images_analytical;
```

### Spot-Check Data Accuracy

Compare specific records:

**MySQL:**
```sql
SELECT * FROM Images i
LEFT JOIN Encodings e ON i.image_id = e.image_id
LEFT JOIN Site s ON i.site_name_id = s.site_name_id
WHERE i.image_id = 12345;
```

**ClickHouse:**
```sql
SELECT * FROM images_analytical WHERE image_id = 12345;
```

### Validate Sentinel Values

Ensure no NULL values exist:

```sql
SELECT 
    COUNT(*) AS total_rows,
    COUNT(CASE WHEN site_name_id = 0 THEN 1 END) AS unknown_site,
    COUNT(CASE WHEN gender_id = 0 THEN 1 END) AS unknown_gender,
    COUNT(CASE WHEN upload_date = '1970-01-01' THEN 1 END) AS unknown_date
FROM images_analytical;
```

### Test Query Performance

Run sample queries to verify performance:

```sql
-- Face presence filter (uses ordering key)
SELECT COUNT(*) FROM images_analytical WHERE has_face = 1;

-- Combined filters (uses ordering key prefix)
SELECT COUNT(*) FROM images_analytical 
WHERE has_face = 1 AND detection_top_class_id = 67;

-- Array queries
SELECT COUNT(*) FROM images_analytical 
WHERE hasArray(ethnicity_ids, 1);
```

### Validate Arrays

Check array columns are populated correctly:

```sql
SELECT 
    image_id,
    keyword_ids,
    ethnicity_ids,
    detection_classes
FROM images_analytical
WHERE length(keyword_ids) > 0
LIMIT 10;
```

## Troubleshooting

### Common Issues

**1. Connection Timeouts**

**Problem:** ClickHouse connection times out during large inserts.

**Solution:**
- Reduce batch size
- Increase timeout settings
- Check network stability (for Boreal)

**2. Memory Issues**

**Problem:** Out of memory errors during transformation.

**Solution:**
- Process smaller batches
- Stream data instead of loading into memory
- Use generator functions in Python

**3. Duplicate Key Errors**

**Problem:** ReplacingMergeTree shows duplicates before merge.

**Solution:**
- This is expected - duplicates are removed during background merges
- Force merge: `OPTIMIZE TABLE images_analytical FINAL;`
- Check `updated_at` values are set correctly

**4. Array Format Errors**

**Problem:** ClickHouse rejects array values.

**Solution:**
- Ensure arrays are formatted as `[1, 2, 3]` not `"1,2,3"`
- Use `array()` function: `array(1, 2, 3)`
- Handle empty arrays as `[]` not `NULL`

**5. Date Format Errors**

**Problem:** Date values rejected.

**Solution:**
- Use format `'YYYY-MM-DD'` for dates
- Use `'YYYY-MM-DD HH:MM:SS'` for DateTime
- Convert epoch dates: `'1970-01-01'`

### Performance Optimization Tips

1. **Batch Size Tuning:**
   - Start with 10K rows
   - Increase gradually (50K, 100K)
   - Monitor memory and network usage

2. **Parallel Processing:**
   - Process non-overlapping image_id ranges in parallel
   - Use separate database connections per process
   - Monitor ClickHouse insert queue

3. **Index Usage:**
   - ClickHouse automatically uses ordering key
   - Queries filtering by `has_face` will be fastest
   - Avoid queries that skip ordering key columns

4. **Time-range Queries:**
   - Queries filtering by `upload_date` can limit scanned data
   - Use date ranges in WHERE clauses

### Error Recovery

**Resume from Checkpoint:**

If migration fails partway through:

1. **Find last migrated image_id:**
```sql
SELECT MAX(image_id) FROM images_analytical;
```

2. **Resume from next batch:**
```bash
python3 migrate_data.py --start-id <last_migrated_id + 1> ...
```

**Handle Partial Batches:**

If a batch fails partway through:

1. **Identify failed range:**
```sql
SELECT MIN(image_id), MAX(image_id) FROM images_analytical 
WHERE updated_at >= '<batch_start_time>' AND updated_at < '<batch_end_time>';
```

2. **Re-run failed range:**
```bash
python3 migrate_data.py --start-id <failed_start> --end-id <failed_end> ...
```

### Getting Help

If you encounter issues:

1. Check ClickHouse logs: `tail -f /var/log/clickhouse-server/clickhouse-server.log`
2. Check system tables: `SELECT * FROM system.errors ORDER BY last_error_time DESC LIMIT 10;`
3. Verify schema matches: Compare source schema with target schema in `packages/moosestack-service/app/ingest/models.ts`
4. Review MooseStack documentation: https://docs.moosejs.com

## Next Steps

After successful migration:

1. **Run OPTIMIZE:** Force merge to remove duplicates
   ```sql
   OPTIMIZE TABLE images_analytical FINAL;
   ```

2. **Create materialized views** if needed for common aggregations

3. **Set up incremental updates** for new data:
   - Use `updated_at` timestamp to identify new/updated rows
   - Run migration script periodically with date filters

4. **Monitor query performance** and adjust ordering key if needed

5. **Backup migrated data** before making schema changes

