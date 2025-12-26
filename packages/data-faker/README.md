# Data Faker

Generate realistic test data for the `images_analytical` ClickHouse table to test database performance under realistic load conditions.

## Overview

This tool generates variant test data matching the `images_analytical` schema with realistic distributions based on actual data patterns. It supports:

- **Mad libs-style captions** - Realistic stock photo captions using template substitution
- **Checkpoint/resume** - Automatically saves progress and can resume after interruption
- **Graceful shutdown** - Safely stop with Ctrl+C, data is saved up to checkpoint
- **Progress tracking** - Real-time progress bars and performance metrics
- **10k batch optimization** - Enforces optimal batch sizes for ClickHouse performance
- **Memory efficient** - Generates and inserts data in batches, never loads all data into RAM

## Installation

Since this is part of the monorepo, dependencies are installed at the root:

```bash
# From project root - installs all packages including data-faker
pnpm install
```

### Prerequisites

- **MooseStack service must be running** - The data faker inserts data directly into ClickHouse via MooseStack
- **Tables must be created** - MooseStack automatically creates tables (including `images_analytical`) when it starts
- Start MooseStack service first: `pnpm dev:moose` (from project root)
- Wait until MooseStack fully starts and creates the tables before running the data faker
- If you see "Table does not exist" error, ensure MooseStack has fully initialized

## Quick Start

**Quick test (100 rows):**
```bash
# From project root
pnpm dev:faker --rows 100

# Or from packages/data-faker directory
pnpm start --rows 100
```

**Small test (1k rows):**
```bash
pnpm dev:faker --rows 1000
```

**Full scale (100GB, ~200M rows):**
```bash
pnpm dev:faker --rows 200000000
# Or use target size:
pnpm dev:faker --target-size 100GB
```

## Usage

### Basic Commands

```bash
# From project root (recommended)
pnpm dev:faker --rows 1000000
pnpm dev:faker --target-size 50GB
pnpm dev:faker  # Resume from checkpoint
pnpm dev:faker --rows 1000000 --reset
pnpm dev:faker --rows 1000000 --seed "my-seed-123"
pnpm dev:faker --count  # Query and display current row count

# Or from packages/data-faker directory
cd packages/data-faker
pnpm start --rows 1000000
pnpm start --count  # Query row count
```

### Configuration Options

- `--rows <number>` - Target number of rows (default: calculate from target-size)
- `--target-size <size>` - Target data size in GB/MB/KB (default: 100GB)
  - Examples: `100GB`, `50GB`, `1024MB`
- `--batch-size <number>` - Rows per insert batch (default: 10000, minimum: 10000 for optimal performance)
- `--seed <string>` - Random seed for reproducibility (default: random, saved in checkpoint)
- `--start-image-id <number>` - Starting image_id (default: from checkpoint or 1)
- `--reset` - Ignore existing checkpoint and start fresh
- `--checkpoint-interval <number>` - Batches between checkpoint saves (default: 1, save every batch)
- `--count` or `-c` - Query ClickHouse and display current row count in images_analytical table, then exit

### Examples

**Quick validation test:**
```bash
pnpm start --rows 100 --batch-size 10
```

**Medium test run:**
```bash
pnpm start --rows 1000000 --batch-size 10000
```

**Full production run:**
```bash
pnpm start --target-size 100GB --batch-size 10000
```

**Resume interrupted run:**
```bash
# Just run again - automatically detects checkpoint
pnpm start
```

## Memory Usage & Performance

### Memory Efficient Design

**Your laptop won't explode!** The data faker is designed to be memory-efficient:

- **Batch processing** - Only one batch (default 10,000 rows) is held in memory at a time
- **Streaming generation** - Rows are generated one at a time, not all at once
- **Immediate insertion** - Each batch is inserted and cleared before generating the next
- **Memory footprint** - ~5MB per batch (~500 bytes × 10,000 rows)

**For 100GB generation:**
- Memory usage stays constant at ~5MB regardless of total size
- Data is generated and inserted incrementally
- Can run for hours/days without memory issues
- Safe to run on laptops with limited RAM

### Performance

- **Insert rate**: ~10,000-50,000 rows/sec (depends on hardware)
- **100GB generation**: ~200M rows × 500 bytes = 100GB
- **Estimated time**: ~1-6 hours (depends on CPU, network, ClickHouse performance)

## Checkpoint & Resume

### How It Works

The tool automatically saves progress after each batch insert to `.checkpoints/progress.json`. This allows you to:

- **Resume after interruption** - Just run the command again
- **Stop and continue later** - Use Ctrl+C, data is safe up to last checkpoint
- **Track progress** - See exactly how much data has been generated

### Checkpoint File Format

```json
{
  "last_image_id": 123456,
  "rows_inserted": 123456,
  "batches_completed": 12,
  "start_time": "2024-01-01T00:00:00Z",
  "last_checkpoint": "2024-01-01T01:23:45Z",
  "seed": "abc123def456",
  "target_rows": 200000000,
  "batch_size": 10000,
  "total_time_seconds": 5023,
  "average_rate_rows_per_sec": 24567
}
```

### Resuming

To resume from a checkpoint, simply run the command again:

```bash
pnpm start
```

The tool will automatically detect the checkpoint and resume from `last_image_id + 1`.

### Starting Fresh

To ignore an existing checkpoint and start fresh:

```bash
pnpm start --rows 200000000 --reset
```

This will delete the checkpoint file and start from image_id 1.

## Graceful Shutdown

### How to Stop Safely

Press `Ctrl+C` (SIGINT) to stop the script gracefully. The script will:

1. Save checkpoint with current progress (last successfully inserted row)
2. Display summary (rows inserted, time taken, rate)
3. Exit cleanly

**Note:** If shutdown happens while accumulating a batch (before it reaches batch size), those rows won't be inserted immediately. However, they will be regenerated on resume since the checkpoint tracks the last successfully inserted `image_id`. This ensures no data loss - resume continues from the last checkpoint.

### Data Safety

- Data inserted up to the checkpoint is **immediately usable**
- Each batch insert is atomic - if interrupted mid-batch, previous checkpoint is safe
- Checkpoint is saved **after** successful batch insert, **before** starting next batch
- On resume, generation continues deterministically from the last checkpoint (same seed = same data)

### Example Shutdown Output

```
^C
Received SIGINT, shutting down gracefully...
Saving checkpoint...

Checkpoint saved:
  Rows inserted: 1,234,567
  Batches completed: 123
  Time elapsed: 1h 23m 45s
  Average rate: 24567 rows/sec
```

## Data Generation

### Mad Libs Captions

Instead of lorem ipsum, captions are generated using mad libs-style templates with variable substitution:

- **30 templates** - Realistic stock photo caption patterns
- **12 variable pools** - ~100 options each (person, action, location, emotion, etc.)
- **Massive uniqueness** - 30 templates × 100^12 = trillions of combinations
- **Deterministic** - Same seed + image_id = same caption (enables resume)

**Example captions:**
- "A young woman smiling outdoors during day"
- "Close-up of businessman confident using laptop in office"
- "Portrait of teenager happy at beach"

### Realistic Distributions

Data distributions match actual patterns from the source database:

- **Gender**: ~66% women, ~33% men, ~1% unknown
- **Age**: Adult (~50%), Young (~25%), Child/Teen (~15%), Baby/Old (~5% each)
- **Ethnicity**: White (~70%), Asian (~10%), Black (~8%), Hispanic (~5%), others (~7%)
- **Site**: Getty (~40%), Shutterstock/Adobe/iStock (~8% each), others distributed
- **Presence flags**: Correlated (has_face ~60%, has_body ~45%, etc.)
- **Clusters**: Realistic distributions with unclustered percentages

### Deterministic Generation

- Uses seeded random number generators (`seedrandom`)
- Same seed + image_id = same data
- Enables perfect resume - resuming generates identical data
- Seed is saved in checkpoint file

### Reproducibility

To generate the same data twice:

```bash
# First run
pnpm start --rows 1000000 --seed "my-seed-123"

# Second run (same data)
pnpm start --rows 1000000 --seed "my-seed-123"
```

## Performance

### Why 10k Batch Size?

ClickHouse performs best with large batches (10k+ rows). The tool enforces this:

- **Default batch size**: 10,000 rows
- **Minimum recommended**: 10,000 rows for optimal performance
- **Small tests**: For < 10k total rows, accumulates all rows then inserts (with warning)

### Expected Performance

- **Throughput**: 20k-50k rows/sec (depends on hardware and ClickHouse configuration)
- **Bottleneck**: ClickHouse network I/O and serialization (not string generation)
- **Memory**: Minimal - batches are streamed, not held in memory

### Performance Tips

1. **Use 10k+ batch size** - Smaller batches are slower
2. **Monitor ClickHouse** - Ensure ClickHouse can handle the insert rate
3. **Network latency** - Local ClickHouse is faster than remote
4. **Hardware** - More CPU/RAM helps with ClickHouse processing

## Troubleshooting

### Common Issues

**Error: "Cannot connect to ClickHouse"**
- Ensure MooseStack service is running: `pnpm dev:moose`
- Check ClickHouse connection settings in `moose.config.toml`

**Error: "Batch size too small"**
- Use `--batch-size 10000` or larger for optimal performance
- For quick tests (< 10k rows), warning is expected

**Error: "Checkpoint file corrupted"**
- Delete `.checkpoints/progress.json` and use `--reset` flag
- Or manually edit checkpoint file if you know the correct values

**Slow performance**
- Ensure batch size is 10k+
- Check ClickHouse server performance
- Verify network connection if using remote ClickHouse

### Debug Tips

1. **Check checkpoint file** - Look at `.checkpoints/progress.json` to see current state
2. **Monitor progress** - Progress bar shows real-time rate
3. **Check ClickHouse logs** - Look for errors or warnings
4. **Test with small batches** - Use `--rows 100` to verify setup

## Advanced Usage

### Custom Seeds

Use a custom seed for reproducible data generation:

```bash
pnpm start --rows 1000000 --seed "production-test-2024"
```

The seed is saved in the checkpoint, so resuming uses the same seed automatically.

### Resuming from Specific Image ID

Start from a specific image_id (useful for testing):

```bash
pnpm start --rows 1000000 --start-image-id 50000
```

### Monitoring Progress

The progress bar shows:
- Current progress percentage
- Rows inserted / target rows
- Insertion rate (rows/sec)
- Estimated time remaining

### Integration Examples

**Run in background:**
```bash
nohup pnpm start --rows 200000000 > faker.log 2>&1 &
```

**Monitor checkpoint file:**
```bash
watch -n 5 cat .checkpoints/progress.json
```

**Check progress without stopping:**
```bash
cat .checkpoints/progress.json | jq '.rows_inserted, .batches_completed'
```

## Architecture

### File Structure

```
data-faker/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── generator.ts       # Main data generation logic
│   ├── distributions.ts  # Realistic distribution functions
│   ├── captions.ts       # Mad libs caption templates
│   ├── checkpoint.ts     # Checkpoint save/load
│   └── types.ts          # Type definitions
├── .checkpoints/         # Checkpoint files (gitignored)
└── README.md            # This file
```

### Key Components

1. **Generator** - Creates rows matching `ImagesAnalytical` schema
2. **Distributions** - Weighted random selection for realistic patterns
3. **Captions** - Mad libs template substitution
4. **Checkpoint** - Progress tracking and resume support
5. **CLI** - Argument parsing, progress display, signal handling

## Notes

- Data is inserted directly into ClickHouse via MooseStack's `imagesAnalytical` table
- Uses MooseStack connection/config from `packages/moosestack-service`
- Checkpoint files are gitignored (in `.gitignore`)
- Long-running processes (100GB) may take hours - use checkpoint/resume
- All data is synthetic - no actual image URLs or copyrighted content

