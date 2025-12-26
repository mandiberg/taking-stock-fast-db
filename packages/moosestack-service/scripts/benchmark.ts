/**
 * Performance Benchmark Script for images_analytical table
 * Runs each query 10 times and records timing
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";

const ITERATIONS = 10;

interface QueryInfo {
  query: string;
  description: string;
}

interface QueryResult {
  description: string;
  query: string;
  times_ms: number[];
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  std_ms: number;
}

// Queries designed to represent typical analytical workloads
const QUERIES: Record<string, QueryInfo> = {
  "01_total_count": {
    query: "SELECT COUNT(*) as total FROM images_analytical",
    description: "Simple full table count - baseline measurement",
  },
  "02_gender_distribution": {
    query:
      "SELECT gender, COUNT(*) as count FROM images_analytical WHERE gender != '' GROUP BY gender ORDER BY count DESC",
    description: "Gender breakdown with grouping - demographic analysis",
  },
  "03_ethnicity_breakdown": {
    query: `SELECT
      SUM(ethnicity_white) as white,
      SUM(ethnicity_black) as black,
      SUM(ethnicity_asian) as asian,
      SUM(ethnicity_hispanic) as hispanic,
      SUM(ethnicity_middle_eastern) as middle_eastern,
      SUM(ethnicity_mixed) as mixed
    FROM images_analytical`,
    description: "Ethnicity distribution using boolean columns",
  },
  "04_top_countries": {
    query:
      "SELECT country_code, COUNT(*) as count FROM images_analytical WHERE country_code != '' GROUP BY country_code ORDER BY count DESC LIMIT 15",
    description: "Geographic distribution - top 15 countries",
  },
  "05_face_presence_filter": {
    query: "SELECT COUNT(*) as faces FROM images_analytical WHERE has_face = 1",
    description: "Filtered count using ordering key (optimal)",
  },
  "06_gender_by_region": {
    query:
      "SELECT region, gender, COUNT(*) as count FROM images_analytical WHERE region != '' AND gender != '' GROUP BY region, gender ORDER BY region, count DESC",
    description: "Cross-tabulation - gender distribution by region",
  },
  "07_topic_distribution": {
    query:
      "SELECT topic_id_1, COUNT(*) as count FROM images_analytical WHERE topic_id_1 > 0 GROUP BY topic_id_1 ORDER BY count DESC LIMIT 20",
    description: "Topic model results - top 20 topics",
  },
  "08_body_pose_clusters": {
    query:
      "SELECT body_pose_cluster_512, COUNT(*) as count FROM images_analytical WHERE body_pose_cluster_512 > 0 GROUP BY body_pose_cluster_512 ORDER BY count DESC LIMIT 20",
    description: "Body pose cluster distribution",
  },
  "09_multi_filter": {
    query:
      "SELECT COUNT(*) as count FROM images_analytical WHERE has_face = 1 AND has_body = 1 AND detection_top_class_id > 0",
    description: "Multi-condition filter using ordering key prefix",
  },
  "10_site_demographics": {
    query:
      "SELECT site_name, gender, COUNT(*) as count FROM images_analytical WHERE site_name != '' GROUP BY site_name, gender ORDER BY site_name, count DESC",
    description: "Cross-tabulation - demographics by stock photo site",
  },
};

function runQuery(query: string): number {
  const start = performance.now();
  execSync(`moose query "${query.replace(/"/g, '\\"')}"`, {
    stdio: "pipe",
    cwd: process.cwd(),
  });
  const end = performance.now();
  return end - start;
}

function calculateStats(times: number[]): {
  avg: number;
  min: number;
  max: number;
  std: number;
} {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const variance =
    times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
  const std = Math.sqrt(variance);
  return { avg, min, max, std };
}

function round(n: number, decimals = 1): number {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

async function main() {
  console.log(`Running benchmark with ${ITERATIONS} iterations per query...`);
  console.log(`Testing ${Object.keys(QUERIES).length} different query types\n`);

  const results: {
    benchmark_date: string;
    iterations: number;
    queries: Record<string, QueryResult>;
  } = {
    benchmark_date: new Date().toISOString(),
    iterations: ITERATIONS,
    queries: {},
  };

  const queryNames = Object.keys(QUERIES).sort();

  for (const name of queryNames) {
    const { query, description } = QUERIES[name];
    console.log(`Running ${name}: ${description}`);

    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const elapsed = runQuery(query);
      times.push(elapsed);
      console.log(`  Iteration ${i + 1}: ${round(elapsed)}ms`);
    }

    const stats = calculateStats(times);

    results.queries[name] = {
      description,
      query: query.replace(/\s+/g, " ").trim(),
      times_ms: times.map((t) => round(t)),
      avg_ms: round(stats.avg),
      min_ms: round(stats.min),
      max_ms: round(stats.max),
      std_ms: round(stats.std),
    };

    console.log(
      `  Average: ${round(stats.avg)}ms (min: ${round(stats.min)}, max: ${round(stats.max)}, std: ${round(stats.std)})\n`
    );
  }

  // Write JSON results
  writeFileSync("benchmark_results.json", JSON.stringify(results, null, 2));
  console.log("\nResults saved to benchmark_results.json");

  // Print summary table
  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(
    `${"Query".padEnd(30)} ${"Avg (ms)".padEnd(12)} ${"Min".padEnd(10)} ${"Max".padEnd(10)}`
  );
  console.log("-".repeat(70));

  for (const name of queryNames) {
    const q = results.queries[name];
    console.log(
      `${name.padEnd(30)} ${String(q.avg_ms).padEnd(12)} ${String(q.min_ms).padEnd(10)} ${String(q.max_ms).padEnd(10)}`
    );
  }
}

main().catch(console.error);
