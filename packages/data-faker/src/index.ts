#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { loadCheckpoint, saveCheckpoint, deleteCheckpoint, createInitialCheckpoint, type CheckpointData } from './checkpoint.js';
import { generateData, getRowCount } from './generator.js';

const MIN_BATCH_SIZE = 10000;
const DEFAULT_BATCH_SIZE = 10000;
const DEFAULT_TARGET_SIZE_GB = 100;
const BYTES_PER_ROW_ESTIMATE = 500; // Estimated bytes per row

let isShuttingDown = false;
let currentCheckpoint: CheckpointData | null = null;

// Graceful shutdown handler
function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(chalk.yellow(`\n\nReceived ${signal}, shutting down gracefully...`));
    
    if (currentCheckpoint) {
      console.log(chalk.blue('Saving checkpoint...'));
      saveCheckpoint(currentCheckpoint);
      const elapsed = currentCheckpoint.total_time_seconds || 0;
      const rate = currentCheckpoint.average_rate_rows_per_sec || 0;
      console.log(chalk.green(`\nCheckpoint saved:`));
      console.log(`  Rows inserted: ${currentCheckpoint.rows_inserted.toLocaleString()}`);
      console.log(`  Batches completed: ${currentCheckpoint.batches_completed}`);
      console.log(`  Time elapsed: ${formatTime(elapsed)}`);
      console.log(`  Average rate: ${rate.toFixed(0)} rows/sec`);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) {
    return `${(bytes / 1e9).toFixed(2)} GB`;
  } else if (bytes >= 1e6) {
    return `${(bytes / 1e6).toFixed(2)} MB`;
  } else if (bytes >= 1e3) {
    return `${(bytes / 1e3).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

function calculateRowsFromSize(sizeGB: number): number {
  const bytes = sizeGB * 1e9;
  return Math.floor(bytes / BYTES_PER_ROW_ESTIMATE);
}

async function main() {
  const program = new Command();

  program
    .name('data-faker')
    .description('Generate realistic test data for images_analytical table')
    .option('-r, --rows <number>', 'Target number of rows', (val) => parseInt(val, 10))
    .option('-s, --target-size <size>', 'Target data size (e.g., 100GB)', (val) => {
      const match = val.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|KB)?$/i);
      if (!match) {
        throw new Error(`Invalid size format: ${val}. Use format like "100GB" or "100"`);
      }
      const num = parseFloat(match[1]);
      const unit = (match[2] || 'GB').toUpperCase();
      
      if (unit === 'GB') return num;
      if (unit === 'MB') return num / 1024;
      if (unit === 'KB') return num / (1024 * 1024);
      return num;
    })
    .option('-b, --batch-size <number>', `Rows per insert batch (default: ${DEFAULT_BATCH_SIZE}, minimum: ${MIN_BATCH_SIZE} for optimal performance)`, (val) => parseInt(val, 10), DEFAULT_BATCH_SIZE)
    .option('--seed <string>', 'Random seed for reproducibility', undefined)
    .option('--start-image-id <number>', 'Starting image_id (default: from checkpoint or 1)', (val) => parseInt(val, 10))
    .option('--reset', 'Ignore existing checkpoint and start fresh', false)
    .option('--checkpoint-interval <number>', 'Batches between checkpoint saves (default: 1)', (val) => parseInt(val, 10), 1)
    .option('-c, --count', 'Query ClickHouse and display current row count in images_analytical table', false)
    .parse(process.argv);

  const options = program.opts();

  // Handle --count option: query and display row count, then exit
  if (options.count) {
    try {
      console.log(chalk.blue('Querying ClickHouse for row count...'));
      const count = await getRowCount();
      console.log(chalk.green(`\nCurrent row count in images_analytical: ${count.toLocaleString()}`));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('\nError querying ClickHouse:'));
      console.error(error);
      process.exit(1);
    }
  }

  setupGracefulShutdown();

  // Determine target rows
  let targetRows: number;
  if (options.rows) {
    targetRows = options.rows;
  } else if (options.targetSize) {
    targetRows = calculateRowsFromSize(options.targetSize);
    console.log(chalk.blue(`Calculated target rows: ${targetRows.toLocaleString()} (from ${options.targetSize}GB)`));
  } else {
    targetRows = calculateRowsFromSize(DEFAULT_TARGET_SIZE_GB);
    console.log(chalk.blue(`Using default target: ${targetRows.toLocaleString()} rows (${DEFAULT_TARGET_SIZE_GB}GB)`));
  }

  // Validate batch size
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  if (batchSize < MIN_BATCH_SIZE && targetRows >= MIN_BATCH_SIZE) {
    console.warn(
      chalk.yellow(
        `Warning: Batch size ${batchSize} is less than optimal ${MIN_BATCH_SIZE} for ClickHouse performance`
      )
    );
  }

  // Load or create checkpoint
  let checkpoint: CheckpointData;
  if (options.reset) {
    console.log(chalk.yellow('Resetting checkpoint (--reset flag)'));
    deleteCheckpoint();
    const seed = options.seed || Math.random().toString(36).substring(2, 15);
    checkpoint = createInitialCheckpoint(seed, targetRows, batchSize);
    console.log(chalk.green(`Starting fresh with seed: ${seed}`));
  } else {
    const existing = loadCheckpoint();
    if (existing) {
      console.log(chalk.green('Resuming from checkpoint:'));
      console.log(`  Last image_id: ${existing.last_image_id.toLocaleString()}`);
      console.log(`  Rows inserted: ${existing.rows_inserted.toLocaleString()}`);
      console.log(`  Batches completed: ${existing.batches_completed}`);
      console.log(`  Seed: ${existing.seed}`);
      
      // Update target if changed
      if (options.rows) {
        existing.target_rows = targetRows;
      }
      if (options.batchSize) {
        existing.batch_size = batchSize;
      }
      checkpoint = existing;
    } else {
      const seed = options.seed || Math.random().toString(36).substring(2, 15);
      checkpoint = createInitialCheckpoint(seed, targetRows, batchSize);
      console.log(chalk.green(`Starting fresh with seed: ${seed}`));
    }
  }

  // Override start image_id if specified
  if (options.startImageId !== undefined) {
    checkpoint.last_image_id = options.startImageId - 1;
    checkpoint.rows_inserted = options.startImageId - 1;
    console.log(chalk.blue(`Starting from image_id: ${options.startImageId}`));
  }

  currentCheckpoint = checkpoint;

  // Check if already complete
  if (checkpoint.rows_inserted >= checkpoint.target_rows) {
    console.log(chalk.green('Target already reached!'));
    return;
  }

  const remainingRows = checkpoint.target_rows - checkpoint.rows_inserted;
  const totalBatches = Math.ceil(remainingRows / checkpoint.batch_size);

  console.log(chalk.blue('\nStarting data generation...'));
  console.log(`  Target rows: ${checkpoint.target_rows.toLocaleString()}`);
  console.log(`  Remaining rows: ${remainingRows.toLocaleString()}`);
  console.log(`  Batch size: ${checkpoint.batch_size.toLocaleString()}`);
  console.log(`  Estimated batches: ${totalBatches.toLocaleString()}\n`);

  // Create progress bar
  const progressBar = new cliProgress.SingleBar(
    {
      format: chalk.cyan('Progress') + ' |{bar}| {percentage}% | {value}/{total} rows | {rate} rows/sec | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  progressBar.start(checkpoint.target_rows, checkpoint.rows_inserted);

  try {
    await generateData(checkpoint, (progress) => {
      currentCheckpoint = checkpoint;
      progressBar.update(progress.rowsInserted, {
        rate: Math.round(progress.rate).toLocaleString(),
      });
    });

    progressBar.stop();
    console.log(chalk.green('\n\nData generation complete!'));
    
    const finalCheckpoint = loadCheckpoint();
    if (finalCheckpoint) {
      const elapsed = finalCheckpoint.total_time_seconds || 0;
      const rate = finalCheckpoint.average_rate_rows_per_sec || 0;
      const dataSize = finalCheckpoint.rows_inserted * BYTES_PER_ROW_ESTIMATE;
      
      console.log(chalk.green('\nSummary:'));
      console.log(`  Rows inserted: ${finalCheckpoint.rows_inserted.toLocaleString()}`);
      console.log(`  Batches completed: ${finalCheckpoint.batches_completed}`);
      console.log(`  Data size: ${formatBytes(dataSize)}`);
      console.log(`  Time elapsed: ${formatTime(elapsed)}`);
      console.log(`  Average rate: ${rate.toFixed(0)} rows/sec`);
      console.log(`  Throughput: ${formatBytes(rate * BYTES_PER_ROW_ESTIMATE)}/sec`);
    }
  } catch (error) {
    progressBar.stop();
    console.error(chalk.red('\n\nError during data generation:'));
    console.error(error);
    
    if (currentCheckpoint) {
      console.log(chalk.yellow('\nCheckpoint saved. You can resume by running the command again.'));
    }
    
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});

