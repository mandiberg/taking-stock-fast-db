#!/usr/bin/env python3
import mysql.connector
import subprocess
import json
from datetime import datetime
    
import myPasswords 
# Connection configs
MYSQL_CONFIG = myPasswords.mysql
CLICKHOUSE_CONFIG = myPasswords.clickhouse

# I am importing these via myPasswords using this format:
# MYSQL_CONFIG = {
#     'host': '<mysql_host>',
#     'user': '<mysql_user>',
#     'password': '<mysql_password>',
#     'database': '<mysql_database>'
# }

# CLICKHOUSE_CONFIG = {
#     'host': '<clickhouse_host>',
#     'port': 9000,
#     'username': '<clickhouse_user>',
#     'password': '<clickhouse_password>',
#     'database': '<clickhouse_database>'
# }

BATCH_SIZE = 10000

def extract_batch(mysql_conn, start_id, end_id):
    """Extract and transform a batch of images"""
    cursor = mysql_conn.cursor(dictionary=True)
    
    # Main query (use the comprehensive query from above)
    query = """
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
    WHERE i.image_id >= %s AND i.image_id < %s
    ORDER BY i.image_id;
        """
    
    cursor.execute(query, (start_id, end_id))
    return cursor.fetchall()

def transform_row(row, keywords_dict, ethnicity_dict):
    """Transform MySQL row to ClickHouse format"""
    # Add arrays and handle sentinel values
    # ... transformation logic ...
    return transformed_row

def insert_batch(rows):
    """Insert batch into ClickHouse using native protocol"""
    if not rows:
        return
    
    # Format rows for INSERT statement
    values = []
    for row in rows:
        values.append((
            row['image_id'],
            row['site_name_id'],
            row['site_name'],
            # ... all columns ...
            row['updated_at']
        ))
    
    # Build INSERT statement
    if not values:
        return
    
    # Convert tuples to VALUES clause format
    values_str = ','.join([str(v) for v in values])
    insert_query = f"INSERT INTO images_analytical VALUES {values_str}"
    
    # Execute via clickhouse-client using native protocol
    try:
        result = subprocess.run(
            [
                'clickhouse-client',
                '--host', CLICKHOUSE_CONFIG['host'],
                '--port', str(CLICKHOUSE_CONFIG['port']),
                '--user', CLICKHOUSE_CONFIG['username'],
                '--password', CLICKHOUSE_CONFIG['password'],
                '--database', CLICKHOUSE_CONFIG['database'],
                '--query', insert_query
            ],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"✗ Insert failed: {result.stderr}")
            raise Exception(f"ClickHouse insert error: {result.stderr}")
    except subprocess.TimeoutExpired:
        print(f"✗ Insert timed out")
        raise
    except Exception as e:
        print(f"✗ Insert error: {e}")
        raise

def migrate_range(start_id, end_id):
    """Migrate a range of image_ids"""
    mysql_conn = mysql.connector.connect(**MYSQL_CONFIG)
    
    current_id = start_id
    while current_id < end_id:
        batch_end = min(current_id + BATCH_SIZE, end_id)
        
        # Extract
        mysql_rows = extract_batch(mysql_conn, current_id, batch_end)
        print(f"Extracted {len(mysql_rows)} rows from MySQL for IDs {current_id} to {batch_end}")
        
        # save mySQL_rows for review
        with open(f'mysql_rows_{current_id}_{batch_end}.json', 'w') as f:
            json.dump(mysql_rows, f, default=str, indent=2)
        

        # Transform
        transformed_rows = [transform_row(row, keywords_dict, ethnicity_dict) for row in mysql_rows]
        
        # Insert
        insert_batch(transformed_rows)
        
        print(f"Migrated {current_id} to {batch_end}")
        current_id = batch_end
    
    mysql_conn.close()

if __name__ == '__main__':
    # Get total range
    mysql_conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = mysql_conn.cursor()
    cursor.execute("SELECT MIN(image_id), MAX(image_id) FROM Images")
    min_id, max_id = cursor.fetchone()
    mysql_conn.close()
    
    migrate_range(min_id, max_id)