# Testing Guide for Data Faker

## Prerequisites

1. **Install dependencies** (if not already done):
   ```bash
   # From project root
   pnpm install
   ```

2. **Start MooseStack/ClickHouse**:
   ```bash
   # From project root - starts ClickHouse and MooseStack service
   pnpm dev:moose
   ```
   
   **Important:** Wait until MooseStack fully starts and creates the tables. You should see:
   - ClickHouse is ready
   - Tables are created (including `images_analytical`)
   - Service is running on `http://localhost:4000`
   
   If you see "Table does not exist" errors, MooseStack hasn't finished creating tables yet. Wait a bit longer and try again.

## Testing Steps

### Step 1: Quick Validation (100 rows)

Test that the basic functionality works:

```bash
# From project root
pnpm dev:faker --rows 100
```

**What to check:**
- Script runs without errors
- Progress bar appears and updates
- Captions look realistic (not lorem ipsum)
- Checkpoint file is created in `.checkpoints/progress.json`
- Data is inserted into ClickHouse

**Verify data was inserted:**
```bash
# Query ClickHouse to verify (if you have access)
# Or check MooseStack logs for insert confirmations
```

### Step 2: Verify Caption Quality (1k rows)

Test that captions are realistic and varied:

```bash
pnpm dev:faker --rows 1000
```

**What to check:**
- Captions are realistic stock photo descriptions
- Captions are varied (not repetitive)
- Progress shows reasonable insertion rate

**Sample captions to expect:**
- "A young woman smiling outdoors during day"
- "Close-up of businessman confident using laptop in office"
- "Portrait of teenager happy at beach"

### Step 3: Test Checkpoint/Resume (10k rows)

Test that checkpoint/resume works correctly:

```bash
# Start generation
pnpm dev:faker --rows 10000

# While it's running, press Ctrl+C to interrupt it
# Then run again - it should resume from checkpoint
pnpm dev:faker
```

**What to check:**
- After Ctrl+C, checkpoint is saved
- When you run again, it resumes from the last checkpoint
- No duplicate data is generated (same seed + image_id = same data)
- Progress continues from where it left off

**Verify checkpoint file:**
```bash
cat packages/data-faker/.checkpoints/progress.json
```

Should show:
- `last_image_id`: Last successfully inserted image_id
- `rows_inserted`: Total rows inserted
- `seed`: Seed used (same seed = same data)

### Step 4: Test Graceful Shutdown

Test that Ctrl+C works safely:

```bash
# Start a longer run
pnpm dev:faker --rows 50000

# Wait a few seconds, then press Ctrl+C
# Should see:
# - "Received SIGINT, shutting down gracefully..."
# - "Saving checkpoint..."
# - Summary of progress
```

**What to check:**
- Script stops cleanly
- Checkpoint is saved
- Summary shows correct progress (rows inserted, batches completed, rate)
- No errors or data loss
- Resume works correctly (run `pnpm dev:faker` again to verify it continues from checkpoint)

**Note:** If shutdown happens while accumulating a batch (before reaching batch size), those rows won't be inserted immediately but will be regenerated on resume. This is expected behavior - the checkpoint tracks the last successfully inserted row, ensuring no data loss.

### Step 5: Test Data Distributions (100k rows)

Verify that distributions match expected patterns:

```bash
pnpm dev:faker --rows 100000
```

**What to check:**
- Gender distribution: ~66% women, ~33% men
- Site distribution: Getty should be most common (~40%)
- Presence flags: has_face ~60%, correlated with has_body
- Clusters: Some unclustered (0 values), some clustered

**Query ClickHouse to verify distributions:**
```sql
-- Check gender distribution
SELECT gender, count() as cnt 
FROM images_analytical 
GROUP BY gender 
ORDER BY cnt DESC;

-- Check site distribution
SELECT site_name, count() as cnt 
FROM images_analytical 
GROUP BY site_name 
ORDER BY cnt DESC 
LIMIT 5;

-- Check presence flags
SELECT 
  sum(has_face) as faces,
  sum(has_body) as bodies,
  count() as total
FROM images_analytical;
```

### Step 6: Test Reset Functionality

Test starting fresh:

```bash
# Generate some data
pnpm dev:faker --rows 1000

# Reset and start fresh
pnpm dev:faker --rows 1000 --reset
```

**What to check:**
- `--reset` deletes checkpoint
- Starts from image_id 1
- New seed is generated (or uses provided seed)

### Step 7: Test Custom Seed

Test reproducibility:

```bash
# Generate with specific seed
pnpm dev:faker --rows 1000 --seed "test-seed-123"

# Generate again with same seed
pnpm dev:faker --rows 1000 --seed "test-seed-123" --reset
```

**What to check:**
- Same seed produces same data
- Captions are identical for same image_ids
- Distributions are identical

### Step 8: Scale Up (Optional)

Once everything works, scale up:

```bash
# Medium test (1M rows)
pnpm dev:faker --rows 1000000

# Large test (10M rows)
pnpm dev:faker --rows 10000000

# Full scale (100GB, ~200M rows) - may take hours
pnpm dev:faker --rows 200000000
```

## Troubleshooting

### Error: "Cannot connect to ClickHouse"
- Ensure MooseStack is running: `pnpm dev:moose`
- Check ClickHouse is accessible
- Verify connection settings in `packages/moosestack-service/moose.config.toml`

### Error: "Table images_analytical does not exist"
- MooseStack needs to create the table first
- Run `pnpm dev:moose` to start MooseStack (it creates tables on startup)
- Or manually create the table using MooseStack's table definition

### Error: "Batch size too small"
- This is a warning, not an error
- For quick tests (< 10k rows), it's expected
- For production runs, use `--batch-size 10000` or larger

### Checkpoint file issues
- Delete `.checkpoints/progress.json` and use `--reset`
- Or manually edit checkpoint file if you know correct values

## Verification Queries

After generating data, verify it in ClickHouse:

```sql
-- Count total rows
SELECT count() FROM images_analytical;

-- Check data distribution
SELECT 
  site_name,
  gender,
  count() as cnt
FROM images_analytical
GROUP BY site_name, gender
ORDER BY cnt DESC
LIMIT 20;

-- Check caption quality (sample)
SELECT image_id, caption 
FROM images_analytical 
LIMIT 10;

-- Check checkpoint resume worked (no gaps)
SELECT 
  min(image_id) as min_id,
  max(image_id) as max_id,
  count() as total,
  max(image_id) - min(image_id) + 1 as expected,
  (max(image_id) - min(image_id) + 1) - count() as gaps
FROM images_analytical;
```

## Expected Performance

- **Small batches (< 10k)**: Slower due to ClickHouse batch size requirements
- **Optimal batches (10k+)**: 20k-50k rows/sec (depends on hardware)
- **100GB generation**: May take several hours, use checkpoint/resume

## Success Criteria

✅ All tests pass if:
1. Script runs without errors
2. Captions are realistic and varied
3. Checkpoint/resume works correctly
4. Graceful shutdown saves progress
5. Data distributions match expected patterns
6. No duplicate data on resume
7. Performance is reasonable (20k+ rows/sec for 10k+ batches)

