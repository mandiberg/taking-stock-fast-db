# ClickHouse Performance Benchmarks

Performance benchmarks for the `images_analytical` table, demonstrating query speeds over **65 million rows** of stock photo metadata.

## Summary

| Query Type | Avg Time | Min | Max |
|------------|----------|-----|-----|
| Total count | 708ms | 484ms | 1513ms |
| Gender distribution | 649ms | 496ms | 1274ms |
| Ethnicity breakdown | 567ms | 429ms | 984ms |
| Top countries | 556ms | 480ms | 741ms |
| Face presence filter | 555ms | 436ms | 845ms |
| Gender by region | 550ms | 503ms | 788ms |
| Topic distribution | 551ms | 520ms | 795ms |
| Body pose clusters | 550ms | 457ms | 765ms |
| Multi-filter query | 551ms | 517ms | 787ms |
| Site demographics | 555ms | 494ms | 805ms |

**Key Takeaway**: Complex analytical queries over 65 million rows complete in ~500-700ms on average, enabling near-interactive data exploration.

## Data Size

| Metric | Value |
|--------|-------|
| **Rows** | 64.93 million |
| **Compressed size** | 7.88 GB |
| **Uncompressed size** | 15.17 GB |
| **Compression ratio** | 1.93x |

ClickHouse achieves ~25 GB/sec throughput scanning this data on a laptop.

**Note on timing**: The benchmark times (~550ms) include CLI overhead. Actual ClickHouse execution times from `system.query_log` show:
- Simple counts: **~10ms** (uses metadata)
- Complex cross-tabulations: **~300ms** (full 65M row scan)

## Methodology

### Test Environment

- **Database**: ClickHouse via MooseStack
- **Dataset**: 64,930,000 rows in `images_analytical` table
- **Hardware**: Mac (local development machine)
- **Date**: December 26, 2025

### Test Protocol

Each query was executed **10 times** consecutively. We report:
- **Average**: Mean execution time across all runs
- **Min/Max**: Best and worst case times
- **Std Dev**: Variation between runs

The first run often shows higher latency due to cold cache effects. Subsequent runs benefit from ClickHouse's caching.

### Why These Queries?

These queries represent the actual analytical workloads for the *Taking Stock* artwork:

1. **Demographic distributions** (gender, ethnicity, age) - Core questions about representation in stock photography
2. **Geographic analysis** - Which countries produce stock photos? What are the regional patterns?
3. **Cross-tabulations** - How do demographics vary by region, site, or topic?
4. **Filtering by presence** (face, body, hands) - Selecting subsets for composite image generation
5. **Cluster analysis** - Body pose and gesture clustering for visual pattern discovery
6. **Topic modeling** - What subjects dominate stock photography?

These are the exact types of questions an artist or researcher would ask when exploring patterns in commercial image databases.

## Detailed Results

### 1. Total Count (Baseline)

```sql
SELECT COUNT(*) as total FROM images_analytical
```

Full table scan baseline. Shows raw ClickHouse throughput.

| Metric | Value |
|--------|-------|
| Average | 707.9ms |
| Min | 484.4ms |
| Max | 1512.7ms |
| Std Dev | 293.6ms |

---

### 2. Gender Distribution

```sql
SELECT gender, COUNT(*) as count
FROM images_analytical
WHERE gender != ''
GROUP BY gender
ORDER BY count DESC
```

Simple grouping query - fundamental demographic breakdown.

| Metric | Value |
|--------|-------|
| Average | 649.1ms |
| Min | 495.9ms |
| Max | 1273.9ms |
| Std Dev | 237.7ms |

---

### 3. Ethnicity Breakdown

```sql
SELECT
    SUM(ethnicity_white) as white,
    SUM(ethnicity_black) as black,
    SUM(ethnicity_asian) as asian,
    SUM(ethnicity_hispanic) as hispanic,
    SUM(ethnicity_middle_eastern) as middle_eastern,
    SUM(ethnicity_mixed) as mixed
FROM images_analytical
```

Aggregation using boolean columns - efficient for multi-category analysis.

| Metric | Value |
|--------|-------|
| Average | 566.7ms |
| Min | 429.1ms |
| Max | 983.9ms |
| Std Dev | 147.8ms |

---

### 4. Top Countries

```sql
SELECT country_code, COUNT(*) as count
FROM images_analytical
WHERE country_code != ''
GROUP BY country_code
ORDER BY count DESC
LIMIT 15
```

Geographic distribution with filtering and limiting.

| Metric | Value |
|--------|-------|
| Average | 555.9ms |
| Min | 480.4ms |
| Max | 741.1ms |
| Std Dev | 69.4ms |

---

### 5. Face Presence Filter

```sql
SELECT COUNT(*) as faces
FROM images_analytical
WHERE has_face = 1
```

Filter using the ordering key - optimally efficient in ClickHouse.

| Metric | Value |
|--------|-------|
| Average | 554.8ms |
| Min | 436.3ms |
| Max | 845.2ms |
| Std Dev | 104.7ms |

---

### 6. Gender by Region (Cross-Tabulation)

```sql
SELECT region, gender, COUNT(*) as count
FROM images_analytical
WHERE region != '' AND gender != ''
GROUP BY region, gender
ORDER BY region, count DESC
```

Multi-dimensional analysis - how demographics vary by geography.

| Metric | Value |
|--------|-------|
| Average | 550.0ms |
| Min | 503.3ms |
| Max | 788.3ms |
| Std Dev | 80.7ms |

---

### 7. Topic Distribution

```sql
SELECT topic_id_1, COUNT(*) as count
FROM images_analytical
WHERE topic_id_1 > 0
GROUP BY topic_id_1
ORDER BY count DESC
LIMIT 20
```

Topic model results - what subjects dominate stock photography.

| Metric | Value |
|--------|-------|
| Average | 551.0ms |
| Min | 520.4ms |
| Max | 794.6ms |
| Std Dev | 81.2ms |

---

### 8. Body Pose Clusters

```sql
SELECT body_pose_cluster_512, COUNT(*) as count
FROM images_analytical
WHERE body_pose_cluster_512 > 0
GROUP BY body_pose_cluster_512
ORDER BY count DESC
LIMIT 20
```

ML clustering results - body position analysis.

| Metric | Value |
|--------|-------|
| Average | 550.2ms |
| Min | 456.9ms |
| Max | 765.2ms |
| Std Dev | 81.2ms |

---

### 9. Multi-Filter Query

```sql
SELECT COUNT(*) as count
FROM images_analytical
WHERE has_face = 1
  AND has_body = 1
  AND detection_top_class_id > 0
```

Complex filter combining multiple conditions - uses ordering key prefix for efficiency.

| Metric | Value |
|--------|-------|
| Average | 550.8ms |
| Min | 516.7ms |
| Max | 787.1ms |
| Std Dev | 78.9ms |

---

### 10. Site Demographics

```sql
SELECT site_name, gender, COUNT(*) as count
FROM images_analytical
WHERE site_name != ''
GROUP BY site_name, gender
ORDER BY site_name, count DESC
```

Cross-tabulation by stock photo source - comparing Getty, Shutterstock, etc.

| Metric | Value |
|--------|-------|
| Average | 554.9ms |
| Min | 493.8ms |
| Max | 805.2ms |
| Std Dev | 86.1ms |

---

## Running the Benchmark

To re-run these benchmarks:

```bash
cd packages/moosestack-service
pnpm tsx scripts/benchmark.ts
```

Results are saved to `benchmark_results.json`.

## Notes

- First-run latency is typically higher due to cold cache
- Production performance would improve with dedicated hardware
- ClickHouse's columnar storage is optimized for these analytical patterns
- The ordering key (`has_face`, `detection_top_class_id`, `body_pose_cluster_512`, ...) enables efficient filtering on common query patterns
