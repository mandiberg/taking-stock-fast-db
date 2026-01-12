
USE Stock;

-- this query successfully exports data (you have to put in actual start and end ids at bottom)
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
    NULLIF(bp256.cluster_id, 0) AS body_pose_cluster_256,
    NULLIF(bp512.cluster_id, 0) AS body_pose_cluster_512,
    NULLIF(bp768.cluster_id, 0) AS body_pose_cluster_768,
    NULLIF(hp32.cluster_id, 0) AS hand_poses_cluster_32,
    NULLIF(hg32.cluster_id, 0) AS hand_gesture_cluster_32,
    NULLIF(hg64.cluster_id, 0) AS hand_gesture_cluster_64,
    NULLIF(hp128.cluster_id, 0) AS hand_position_cluster_128,
    NULLIF(hsv.cluster_id, 0) AS hsv_cluster,
    NULLIF(hg128.cluster_id, 0) AS hand_gesture_cluster_128,
    NULLIF(ap128.cluster_id, 0) AS arm_poses3D_cluster_128,
    NULLIF(meta_hsv.cluster_id, 0) AS meta_hsv_cluster,
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
LEFT JOIN ImagesHandsPoses hp32 ON i.image_id = hp32.image_id
LEFT JOIN ImagesHandsGestures32 hg32 ON i.image_id = hg32.image_id
LEFT JOIN ImagesHandsGestures64 hg64 ON i.image_id = hg64.image_id
LEFT JOIN ImagesHandsPositions128 hp128 ON i.image_id = hp128.image_id
LEFT JOIN ImagesHandsGestures128 hg128 ON i.image_id = hg128.image_id
LEFT JOIN ImagesArmsPoses3D ap128 ON i.image_id = ap128.image_id
LEFT JOIN ImagesHSV hsv ON i.image_id = hsv.image_id
LEFT JOIN ClustersMetaHSV meta_hsv ON hsv.cluster_id = meta_hsv.cluster_id
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