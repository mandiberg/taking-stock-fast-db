#!/usr/bin/env python3
import mysql.connector
import subprocess
import json
import types
from datetime import datetime
import time
    
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

# start a timer
start_time = time.time()

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
        -- Clusters (NULL for unclustered)
        bp256.cluster_id AS body_pose_cluster_256,
        bp512.cluster_id AS body_pose_cluster_512,
        bp768.cluster_id AS body_pose_cluster_768,
        hp32.cluster_id AS hand_poses_cluster_32,
        hg128.cluster_id AS hand_gesture_cluster_128,
        ap128.cluster_id AS arm_poses3D_cluster_128,
        hsv.cluster_id AS hsv_cluster,
        meta_hsv.cluster_id AS meta_hsv_cluster,
        c.cluster_id AS face_cluster,
        -- Topics
        t.topic_id AS topic_id_1,
        COALESCE(t.topic_score, 0.0) AS topic_score_1,
        t.topic_id2 AS topic_id_2,
        COALESCE(t.topic_score2, 0.0) AS topic_score_2,
        t.topic_id3 AS topic_id_3,
        COALESCE(t.topic_score3, 0.0) AS topic_score_3,
        tnf.topic_id AS is_not_face_topic_id,
        COALESCE(tnf.topic_score, 0) AS is_not_face_score,
        tnfm.topic_id AS is_face_model_topic_id,
        COALESCE(tnfm.topic_score, 0) AS is_face_model_score,
        ta.topic_id AS affect_id,
        COALESCE(ta.topic_score, 0.0) AS affect_score,
        -- Detection summaries
        COALESCE(det.detection_count, 0) AS detection_count,
        COALESCE(det.detection_top_class_id, 0) AS detection_top_class_id,
        COALESCE(det.detection_top_class_confidence, 0.0) AS detection_top_class_confidence,
        NULL AS obj_cluster,
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
        -- JOIN Clusters
    LEFT JOIN ImagesBodyPoses3D256 bp256 ON i.image_id = bp256.image_id
    LEFT JOIN ImagesBodyPoses3D512 bp512 ON i.image_id = bp512.image_id
    LEFT JOIN ImagesBodyPoses3D bp768 ON i.image_id = bp768.image_id
    LEFT JOIN ImagesHandsPoses hp32 ON i.image_id = hp32.image_id
    LEFT JOIN ImagesHandsGestures hg128 ON i.image_id = hg128.image_id
    LEFT JOIN ImagesArmsPoses3D ap128 ON i.image_id = ap128.image_id
    LEFT JOIN ImagesHSV hsv ON i.image_id = hsv.image_id
    LEFT JOIN ClustersMetaHSV meta_hsv ON hsv.cluster_id = meta_hsv.cluster_id
    LEFT JOIN ImagesClusters c ON i.image_id = c.image_id
        -- Topics
    LEFT JOIN ImagesTopics t ON i.image_id = t.image_id
    LEFT JOIN ImagesTopics_isnotface tnf ON i.image_id = tnf.image_id
    LEFT JOIN imagestopics_isnotface_isfacemodel tnfm ON i.image_id = tnfm.image_id
    LEFT JOIN imagestopics_affect ta ON i.image_id = ta.image_id
        -- Detections
    -- ADD in OBJ CLUSTER WHEN IT IS READY
    -- LEFT JOIN ImagesObjects obj ON i.image_id = obj.image_id
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

def fetch_array_map(mysql_conn, table_name, id_column, image_ids):
    """Return a dict mapping image_id -> list of ids from a many-to-many table"""
    if not image_ids:
        return {}
    cursor = mysql_conn.cursor()
    q = f"SELECT image_id, {id_column} FROM {table_name} WHERE image_id IN ({','.join(['%s']*len(image_ids))})"
    cursor.execute(q, tuple(image_ids))
    res = {}
    for image_id, val in cursor.fetchall():
        res.setdefault(image_id, []).append(val)
    return res


def format_date_for_ch(value):
    if value is None:
        return '1970-01-01 00:00:00'
    if isinstance(value, str):
        if ' ' in value:
            return value
        return f"{value} 00:00:00"
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%d %H:%M:%S')
    return str(value)


def get_clickhouse_max_image_id():
    """Return the maximum image_id currently in ClickHouse, or None if unavailable.

    Tries the configured port first, then falls back to port 9000. Handles missing table gracefully.
    """
    host = CLICKHOUSE_CONFIG.get('host', '127.0.0.1')
    if host == 'localhost':
        host = '127.0.0.1'
    username = CLICKHOUSE_CONFIG.get('username')
    password = CLICKHOUSE_CONFIG.get('password')
    database = CLICKHOUSE_CONFIG.get('database')

    def run_query_on_port(p):
        cmd = ['clickhouse-client', '--host', host, '--port', str(p), '--query']
        query = f"SELECT max(image_id) FROM {database + '.' if database else ''}images_analytical"
        cmd.append(query)
        if username is not None:
            cmd += ['--user', username]
        if password is not None:
            cmd += ['--password', password]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        except FileNotFoundError:
            return None, 'clickhouse-client not found'
        except Exception as e:
            return None, str(e)

        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or '').strip()
            # If the table does not exist, return None (no rows migrated yet)
            if 'does not exist' in err or 'UNKNOWN_TABLE' in err or 'NO_SUCH_TABLE' in err:
                return None, err
            return None, err

        out = (proc.stdout or '').strip()
        try:
            if out == '' or out.lower() == 'nan':
                return None, ''
            return int(out), ''
        except Exception as e:
            return None, f'parse error: {e} - output: {out}'

    # Try configured port first
    try:
        configured_port = int(CLICKHOUSE_CONFIG.get('port', 0))
    except Exception:
        configured_port = 0

    # Try configured port, then 9000
    for p in (configured_port, 9000):
        if not p:
            continue
        val, err = run_query_on_port(p)
        if val is not None:
            print(f"ClickHouse contains max(image_id)={val} on port {p}")
            return val
        # else keep trying
    print('Could not determine max(image_id) from ClickHouse (table may not exist or auth failed)')
    return None


def transform_row(row, keywords_dict, ethnicity_dict):
    """Transform MySQL row to ClickHouse JSON row format"""
    image_id = row['image_id']

    keyword_ids = keywords_dict.get(image_id, []) if keywords_dict is not None else []
    ethnicity_ids = ethnicity_dict.get(image_id, []) if ethnicity_dict is not None else []

    # Ethnicity boolean flags - heuristic: check presence of known IDs (this may be adjusted based on real ids)
    ethnicity_white = 1 if 1 in ethnicity_ids else 0
    ethnicity_black = 1 if 2 in ethnicity_ids else 0
    ethnicity_asian = 1 if 3 in ethnicity_ids else 0
    ethnicity_hispanic = 1 if 4 in ethnicity_ids else 0
    ethnicity_middle_eastern = 1 if 5 in ethnicity_ids else 0
    ethnicity_native_american = 1 if 6 in ethnicity_ids else 0
    ethnicity_pacific_islander = 1 if 7 in ethnicity_ids else 0
    ethnicity_mixed = 1 if 8 in ethnicity_ids else 0
    ethnicity_other = 1 if 9 in ethnicity_ids else 0

    # detection_classes not extracted in SELECT - leave empty list for now
    detection_classes = []

    transformed = {
        'image_id': image_id,
        'site_name_id': row.get('site_name_id', 0),
        'site_name': row.get('site_name', ''),
        'site_image_id': row.get('site_image_id', ''),
        'gender_id': row.get('gender_id', 0),
        'gender': row.get('gender', ''),
        'age_id': row.get('age_id', 0),
        'age': row.get('age', ''),
        'age_detail_id': row.get('age_detail_id', 0),
        'location_id': row.get('location_id', 0),
        'country_code': row.get('country_code', ''),
        'region': row.get('region', ''),
        'keyword_ids': keyword_ids,
        'ethnicity_ids': ethnicity_ids,
        'ethnicity_white': ethnicity_white,
        'ethnicity_black': ethnicity_black,
        'ethnicity_asian': ethnicity_asian,
        'ethnicity_hispanic': ethnicity_hispanic,
        'ethnicity_middle_eastern': ethnicity_middle_eastern,
        'ethnicity_native_american': ethnicity_native_american,
        'ethnicity_pacific_islander': ethnicity_pacific_islander,
        'ethnicity_mixed': ethnicity_mixed,
        'ethnicity_other': ethnicity_other,
        'has_face': row.get('has_face', 0),
        'has_body': row.get('has_body', 0),
        'has_feet': row.get('has_feet', 0),
        'has_hands': row.get('has_hands', 0),
        'has_left_hand': row.get('has_left_hand', 0),
        'has_right_hand': row.get('has_right_hand', 0),
        'is_face_distant': row.get('is_face_distant', 0),
        'is_small': row.get('is_small', 0),
        'is_face_no_lms': row.get('is_face_no_lms', 0),
        'face_x': float(row.get('face_x', 0.0)),
        'face_y': float(row.get('face_y', 0.0)),
        'face_z': float(row.get('face_z', 0.0)),
        'mouth_gap': float(row.get('mouth_gap', 0.0)),
        # Clusters - pass through None for NULL
        'body_pose_cluster_256': row.get('body_pose_cluster_256'),
        'body_pose_cluster_512': row.get('body_pose_cluster_512'),
        'body_pose_cluster_768': row.get('body_pose_cluster_768'),
        'hand_poses_cluster_32': row.get('hand_poses_cluster_32'),
        'hand_gesture_cluster_32': row.get('hand_gesture_cluster_32'),
        'hand_gesture_cluster_64': row.get('hand_gesture_cluster_64'),
        'hand_gesture_cluster_128': row.get('hand_gesture_cluster_128'),
        'arms_poses3D_cluster_64': row.get('arms_poses3D_cluster_64'),
        'arm_poses3D_cluster_128': row.get('arm_poses3D_cluster_128'),
        'hand_position_cluster_128': row.get('hand_position_cluster_128'),
        'hsv_cluster': row.get('hsv_cluster'),
        'meta_hsv_cluster': row.get('meta_hsv_cluster'),
        'face_cluster': row.get('face_cluster'),
        'is_not_face_topic_id': row.get('is_not_face_topic_id'),
        'is_not_face_score': float(row.get('is_not_face_score', 0.0)),
        'is_face_model_topic_id': row.get('is_face_model_topic_id'),
        'is_face_model_score': float(row.get('is_face_model_score', 0.0)),
        'affect_id': row.get('affect_id'),
        'affect_score': float(row.get('affect_score', 0.0)),
        'obj_cluster': row.get('obj_cluster'),
        'topic_id_1': row.get('topic_id_1', 0),
        'topic_score_1': float(row.get('topic_score_1', 0.0)),
        'topic_id_2': row.get('topic_id_2', 0),
        'topic_score_2': float(row.get('topic_score_2', 0.0)),
        'topic_id_3': row.get('topic_id_3', 0),
        'topic_score_3': float(row.get('topic_score_3', 0.0)),
        'detection_count': int(row.get('detection_count', 0)),
        'detection_classes': detection_classes,
        'detection_top_class_id': int(row.get('detection_top_class_id', 0)),
        'detection_top_class_confidence': float(row.get('detection_top_class_confidence', 0.0)),
        'upload_date': format_date_for_ch(row.get('upload_date')),
        'author': row.get('author', ''),
        'caption': row.get('caption', ''),
        'content_url': row.get('content_url', ''),
        'width': int(row.get('width', 0)),
        'height': int(row.get('height', 0)),
        'is_dupe_of': int(row.get('is_dupe_of', 0)),
        'updated_at': format_date_for_ch(row.get('updated_at')),
    }

    return transformed

def insert_batch(rows):
    """Insert batch into ClickHouse using JSONEachRow for safe NULL/array handling"""
    if not rows:
        return

    # Column list must match the JSON object keys and the table schema
    columns = [
        'image_id','site_name_id','site_name','site_image_id','gender_id','gender','age_id','age','age_detail_id','location_id','country_code','region',
        'keyword_ids','ethnicity_ids','ethnicity_white','ethnicity_black','ethnicity_asian','ethnicity_hispanic','ethnicity_middle_eastern','ethnicity_native_american','ethnicity_pacific_islander','ethnicity_mixed','ethnicity_other',
        'has_face','has_body','has_feet','has_hands','has_left_hand','has_right_hand','is_face_distant','is_small','is_face_no_lms',
        'face_x','face_y','face_z','mouth_gap',
        'body_pose_cluster_256','body_pose_cluster_512','body_pose_cluster_768','hand_poses_cluster_32','hand_gesture_cluster_32','hand_gesture_cluster_64','hand_gesture_cluster_128','arms_poses3D_cluster_64','arm_poses3D_cluster_128','hand_position_cluster_128','hsv_cluster','meta_hsv_cluster','face_cluster',
        'is_not_face_topic_id','is_not_face_score','is_face_model_topic_id','is_face_model_score','affect_id','affect_score','obj_cluster',
        'topic_id_1','topic_score_1','topic_id_2','topic_score_2','topic_id_3','topic_score_3',
        'detection_count','detection_classes','detection_top_class_id','detection_top_class_confidence',
        'upload_date','author','caption','content_url','width','height','is_dupe_of','updated_at'
    ]

    # Qualify table with configured database if provided to avoid default DB issues
    database = CLICKHOUSE_CONFIG.get('database')
    table_name = f"{database}.images_analytical" if database else 'images_analytical'

    insert_query = f"INSERT INTO {table_name} ({', '.join(columns)}) FORMAT JSONEachRow"

    # Use grouped insertion helper to avoid partition explosion
    insert_grouped_rows(rows, insert_query)
    return


# Helper: grouped insert to avoid too many partitions in a single insert
def insert_grouped_rows(rows_to_insert, insert_query):
    from collections import defaultdict
    import urllib.parse

    host = CLICKHOUSE_CONFIG.get('host', '127.0.0.1')
    if host == 'localhost':
        host = '127.0.0.1'
    username = CLICKHOUSE_CONFIG.get('username')
    password = CLICKHOUSE_CONFIG.get('password')
    database = CLICKHOUSE_CONFIG.get('database')

    try:
        port_num = int(CLICKHOUSE_CONFIG.get('port', 0))
    except Exception:
        port_num = 0

    bucket_size = int(CLICKHOUSE_CONFIG.get('partition_bucket_size', 1000000))
    chunk_size = int(CLICKHOUSE_CONFIG.get('chunk_size', min(1000, BATCH_SIZE)))

    def run_client(p, payload_local):
        cmd = ['clickhouse-client', '--host', host, '--port', str(p), '--query', insert_query]
        if username is not None:
            cmd += ['--user', username]
        if password is not None:
            cmd += ['--password', password]
        if database is not None:
            cmd += ['--database', database]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, input=payload_local, timeout=60)
        except FileNotFoundError:
            return (False, f'clickhouse-client not found on port {p}')
        except Exception as e:
            return (False, str(e))
        out = proc.stderr or proc.stdout or ''
        ok = (proc.returncode == 0 and not str(out).strip().startswith('Code:'))
        return (ok, out)

    def http_post(p, payload_local):
        db_part = f"&database={urllib.parse.quote_plus(database)}" if database else ''
        url = f"http://{host}:{p}/?query={urllib.parse.quote_plus(insert_query)}{db_part}"
        curl_cmd = ['curl', '-sS', '-X', 'POST', url, '--data-binary', '@-']
        if username is not None and password is not None:
            curl_cmd += ['--user', f"{username}:{password}"]
        try:
            r = subprocess.run(curl_cmd, input=payload_local, capture_output=True, text=True, timeout=60)
            out = r.stderr or r.stdout or ''
            ok = (r.returncode == 0 and not str(out).strip().startswith('Code:'))
            return (ok, out)
        except Exception as e:
            return (False, str(e))

    groups = defaultdict(list)
    for row in rows_to_insert:
        try:
            img = int(row.get('image_id', 0))
        except Exception:
            img = 0
        groups[img // bucket_size].append(row)

    for bucket, grp in groups.items():
        print(f"Inserting bucket {bucket} ({len(grp)} rows) in chunks of {chunk_size}...")
        for i in range(0, len(grp), chunk_size):
            chunk = grp[i:i+chunk_size]
            payload_chunk = '\n'.join([json.dumps(r, default=str) for r in chunk])

            ok, out = (False, '')

            if port_num != 9000:
                print('  trying clickhouse-client on port 9000')
                ok, out = run_client(9000, payload_chunk)
                if ok:
                    continue

            print(f'  trying clickhouse-client on configured port {port_num}')
            ok, out = run_client(port_num, payload_chunk)
            if ok:
                continue

            for p in ([port_num] if port_num in (18123, 8123) else []) + [18123, 8123]:
                if p is None:
                    continue
                print(f'  trying HTTP POST to {host}:{p}')
                ok, out = http_post(p, payload_chunk)
                if ok:
                    break

            if not ok:
                print(f"  ✗ Insert failed for bucket {bucket} chunk starting at {i}: {out}")
                raise Exception(f"ClickHouse insert error: {out}")




def migrate_range(start_id, end_id):
    """Migrate a range of image_ids"""
    mysql_conn = mysql.connector.connect(**MYSQL_CONFIG)
    
    this_round_start = time.time()
    current_id = start_id
    while current_id < end_id:
        batch_end = min(current_id + BATCH_SIZE, end_id)
        
        # Extract
        mysql_rows = extract_batch(mysql_conn, current_id, batch_end)
        print(f"Extracted {len(mysql_rows)} rows from MySQL for IDs {current_id} to {batch_end}")
        this_msql_time = time.time() - this_round_start
        print(f"  MySQL query time: {this_msql_time:.2f} seconds")
        # save mySQL_rows for review

        # with open(f'mysql_rows_{current_id}_{batch_end}.json', 'w') as f:
        #     json.dump(mysql_rows, f, default=str, indent=2)

        # Fetch many-to-many arrays for this batch
        image_ids = [r['image_id'] for r in mysql_rows]
        keywords_dict = fetch_array_map(mysql_conn, 'ImagesKeywords', 'keyword_id', image_ids)
        ethnicity_dict = fetch_array_map(mysql_conn, 'ImagesEthnicity', 'ethnicity_id', image_ids)
        mysql_array_time = time.time() - this_round_start - this_msql_time
        print(f"  MySQL array fetch time: {mysql_array_time:.2f} seconds")

        # Transform
        transformed_rows = [transform_row(row, keywords_dict, ethnicity_dict) for row in mysql_rows]

        # Insert
        insert_batch(transformed_rows)
        insert_time = time.time() - this_round_start - this_msql_time - mysql_array_time
        print(f"  ClickHouse insert time: {insert_time:.2f} seconds")

        print(f"Migrated {current_id} to {batch_end}")
        current_id = batch_end
    
    mysql_conn.close()

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Migrate images from MySQL to ClickHouse')
    parser.add_argument('--start', type=int, default=None, help='Start image_id (inclusive)')
    parser.add_argument('--end', type=int, default=None, help='End image_id (exclusive)')
    parser.add_argument('--dry-run', action='store_true', help='Do not insert; print transformed rows for inspection')
    parser.add_argument('--limit', type=int, default=10, help='Number of transformed rows to print in dry-run')
    args = parser.parse_args()

    # Determine overall min/max from MySQL if not provided
    mysql_conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = mysql_conn.cursor()
    cursor.execute("SELECT MIN(image_id), MAX(image_id) FROM Images")
    min_id, max_id = cursor.fetchone()

    start = args.start if args.start is not None else min_id
    end = args.end if args.end is not None else max_id

    # Bump start to avoid reprocessing rows already present in ClickHouse: use max(image_id)+1 if it's larger
    ch_max = get_clickhouse_max_image_id()
    if ch_max is not None:
        bumped = max(start, ch_max + 1)
        if bumped != start:
            print(f"Adjusting start from {start} to {bumped} because ClickHouse already contains rows up to image_id={ch_max}")
            start = bumped

    if start is None or end is None:
        print("Could not determine image ID range from database and no --start/--end provided")
        mysql_conn.close()
        raise SystemExit(1)

    if args.dry_run:
        # Extract a single batch for inspection
        batch_end = min(start + BATCH_SIZE, end)
        print(f"Dry-run: extracting {start} to {batch_end}")
        mysql_rows = extract_batch(mysql_conn, start, batch_end)
        print(f"Extracted {len(mysql_rows)} rows from MySQL")
        image_ids = [r['image_id'] for r in mysql_rows]
        keywords_dict = fetch_array_map(mysql_conn, 'ImagesKeywords', 'keyword_id', image_ids)
        ethnicity_dict = fetch_array_map(mysql_conn, 'ImagesEthnicity', 'ethnicity_id', image_ids)
        transformed_rows = [transform_row(row, keywords_dict, ethnicity_dict) for row in mysql_rows]

        print(f"Printing up to {args.limit} transformed rows (JSON):")
        for r in transformed_rows[:args.limit]:
            print(json.dumps(r, default=str))

        mysql_conn.close()
        raise SystemExit(0)

    mysql_conn.close()

    # using start_time print how long the SQL query took
    migrate_range(start, end)