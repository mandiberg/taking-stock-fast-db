# Data Model Optimization TODO

Future optimizations to improve query performance and storage efficiency for the `images_analytical` table.

## Ordering Key Optimization

### High Priority
- [ ] **Reduce ordering key columns for faster inserts** - Fewer columns in the ordering key means faster sorting during inserts. Current 8-column key (`has_face`, `detection_top_class_id`, `body_pose_cluster_512`, `hand_position_cluster_128`, `site_name_id`, `location_id`, `upload_date`, `image_id`) causes significant insert overhead (~30k rows/sec sustained). Consider removing columns that aren't frequently filtered on to improve insert performance.
- [ ] **Remove `upload_date` from ordering key** - Since upload_date is not used in query filters, removing it from the ordering key will improve the efficiency of the remaining columns AND speed up inserts. The ordering key should only include columns that are frequently filtered on.
- [ ] **Re-evaluate ordering key based on actual query patterns** - Profile production queries to determine the most common filter combinations and reorder the key accordingly. Consider:
  - Moving frequently filtered boolean flags higher (e.g., `has_body`, `has_hands`, `ethnicity_*` booleans)
  - Promoting high-selectivity filters that are often combined with `has_face`
  - Consider if `location_id` is actually filtered frequently enough to warrant its position
  - **Trade-off**: Fewer columns = faster inserts but potentially slower queries (if queries filter by removed columns)

### Medium Priority
- [ ] **Consider adding more presence flags to ordering key** - If queries frequently filter by combinations like `has_face AND has_body AND has_hands`, consider adding these to the ordering key (after `has_face`).
- [ ] **Evaluate if `site_name_id` position is optimal** - If site filtering is rare, consider moving it later in the ordering key or removing it entirely.

## Partitioning Strategy

### High Priority
- [ ] **Change partitioning strategy** - Since `upload_date` is not filtered, monthly partitioning by date provides no benefit. Consider:
  - **Option 1**: Partition by `site_name_id` if queries often filter by site (enables partition pruning)
  - **Option 2**: Partition by `toYYYYMM(updated_at)` if you need time-based partition management
  - **Option 3**: No partitioning (single partition) if data volume doesn't require it - simpler and faster merges
- [ ] **Evaluate partition size** - If keeping partitioning, ensure partition size is optimal (not too many small partitions, not too few large ones).

## Indexing and Skip Indexes

### High Priority
- [ ] **Add skip indexes for array columns** - Array columns (`keyword_ids`, `ethnicity_ids`, `detection_classes`) cannot be efficiently filtered without skip indexes. Consider:
  - `INDEX idx_keywords keyword_ids TYPE bloom_filter(0.01) GRANULARITY 4` for keyword lookups
  - `INDEX idx_ethnicity ethnicity_ids TYPE bloom_filter(0.01) GRANULARITY 4` for ethnicity array filtering
  - `INDEX idx_detection_classes detection_classes TYPE bloom_filter(0.01) GRANULARITY 4` for detection class filtering
- [ ] **Add skip index for `is_dupe_of`** - If duplicate filtering is common, add a skip index: `INDEX idx_dupe is_dupe_of TYPE set(100) GRANULARITY 4`

### Medium Priority
- [ ] **Consider skip indexes for frequently filtered columns not in ordering key** - If queries filter by columns not in the ordering key prefix, add skip indexes:
  - `gender_id`, `age_id` if frequently filtered independently
  - `face_cluster`, `hsv_cluster` if cluster-based queries are common
  - `topic_id_1`, `topic_id_2`, `topic_id_3` if topic filtering is frequent

## Data Type Optimization

### Medium Priority
- [ ] **Review numeric type sizes** - Ensure types are optimally sized:
  - `UInt16` for `body_pose_cluster_*` (max 768) - could be `UInt16` but verify actual max values
  - `UInt16` for `hsv_cluster` and `face_cluster` - verify actual cardinality
  - `UInt32` for `keyword_ids` array - verify if `UInt16` would suffice
- [ ] **Consider FixedString for fixed-length strings** - If `site_image_id` has a fixed or maximum length, consider `FixedString(N)` instead of `String` for better compression.
- [ ] **Evaluate Decimal precision** - `Decimal(6, 3)` for face orientation may be overkill. Consider `Decimal(5, 2)` or `Float32` if precision requirements allow.

## Compression and Storage

### Medium Priority
- [ ] **Add compression codec to high-cardinality columns** - Consider `CODEC(ZSTD(3))` or `CODEC(LZ4HC)` for:
  - `caption` (if long text)
  - `content_url` (URLs compress well)
  - `site_image_id` (if long strings)
- [ ] **Review LowCardinality usage** - Ensure all appropriate string columns use `LowCardinality`:
  - Verify `author` cardinality is low enough to benefit
  - Consider if `country_code` and `region` benefit from LowCardinality (they likely do)

## Query Performance Optimizations

### High Priority
- [ ] **Create materialized views for common aggregations** - If queries frequently aggregate by demographics, clusters, or topics, create materialized views:
  - Aggregations by `gender`, `age`, `country_code`
  - Counts by `body_pose_cluster_512`, `hand_position_cluster_128`
  - Topic distribution views
- [ ] **Consider projections** - ClickHouse projections can pre-aggregate data for specific query patterns without separate materialized views.

### Medium Priority
- [ ] **Optimize array operations** - If queries use array functions (`hasAny`, `arrayIntersect`), ensure skip indexes are in place and consider if denormalization would help.
- [ ] **Review query patterns for ethnicity filtering** - Since both `ethnicity_ids` array and boolean columns exist, document which to use:
  - Boolean columns (`ethnicity_white`, etc.) are faster for single ethnicity filters
  - Array column is needed for multi-ethnicity queries
  - Consider if queries need both or if one can be removed

## Schema Design

### Low Priority
- [ ] **Consider removing unused cluster columns** - If certain cluster granularities (`body_pose_cluster_256`, `body_pose_cluster_768`, `hand_gesture_cluster_32`, `hand_gesture_cluster_64`) are rarely queried, consider removing them to reduce storage and improve insert performance.
- [ ] **Evaluate topic model storage** - If only `topic_id_1` is frequently used, consider if `topic_id_2` and `topic_id_3` are necessary.
- [ ] **Review duplicate handling** - If `is_dupe_of` relationships are rare, consider if the column is necessary or if duplicates are handled entirely via `ReplacingMergeTree`.

## Engine and Merge Strategy

### Low Priority
- [ ] **Evaluate ReplacingMergeTree vs MergeTree** - If duplicates are rare or handled upstream, `MergeTree` might be faster (no version column overhead).
- [ ] **Consider TTL** - If old data can be archived or deleted, add TTL: `TTL upload_date + INTERVAL 5 YEAR` (or appropriate retention period).

## Monitoring and Profiling

### High Priority
- [ ] **Profile actual query patterns** - Use ClickHouse query log to identify:
  - Most common WHERE clause combinations
  - Most common GROUP BY columns
  - Query execution times and scan sizes
  - Columns that are never queried
- [ ] **Monitor table statistics** - Track:
  - Partition sizes and merge performance
  - Compression ratios
  - Query cache hit rates
  - Storage size per column

## Documentation

### Medium Priority
- [ ] **Document optimal query patterns** - Update comments in `models.ts` to reflect the optimized ordering key and provide examples of optimal vs suboptimal queries.
- [ ] **Create query performance guide** - Document best practices for querying the table based on the final optimized schema.

