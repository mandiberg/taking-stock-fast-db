// Realistic distribution functions based on actual data patterns
// Uses weighted random selection to match real-world distributions

type RNG = () => number;

// Site names mapping (from CLAUDE.md)
const SITE_NAMES = [
  { id: 1, name: 'Getty' },
  { id: 2, name: 'Shutterstock' },
  { id: 3, name: 'Adobe' },
  { id: 4, name: 'iStock' },
  { id: 5, name: 'Pexels' },
  { id: 6, name: 'Unsplash' },
  { id: 7, name: 'Pond5' },
  { id: 8, name: '123rf' },
  { id: 9, name: 'Alamy' },
  { id: 10, name: 'VCG' },
  { id: 11, name: 'Picxy' },
  { id: 12, name: 'Pixerf' },
  { id: 13, name: 'ImagesBazaar' },
  { id: 14, name: 'IndiaPicture' },
  { id: 15, name: 'Iwaria' },
  { id: 16, name: 'Nappy' },
  { id: 17, name: 'Picha' },
  { id: 18, name: 'Afripics' },
];

// Gender distribution: ~66% women, ~33% men, ~1% unknown
export function generateGender(rng: RNG): { id: number; name: string } {
  const rand = rng();
  if (rand < 0.66) return { id: 1, name: 'woman' };
  if (rand < 0.99) return { id: 2, name: 'man' };
  return { id: 0, name: '' };
}

// Age distribution: Adult (~50%), Young (~25%), Child/Teen (~15%), Baby/Old (~5% each)
export function generateAge(rng: RNG): { id: number; name: string } {
  const rand = rng();
  if (rand < 0.50) return { id: 6, name: 'adult' };
  if (rand < 0.75) return { id: 5, name: 'young' };
  if (rand < 0.85) return { id: 4, name: 'teenager' };
  if (rand < 0.90) return { id: 3, name: 'child' };
  if (rand < 0.95) return { id: 1, name: 'baby' };
  if (rand < 1.0) return { id: 7, name: 'old' };
  return { id: 0, name: '' };
}

// Age detail (simplified - mostly adult variations)
export function generateAgeDetail(rng: RNG): number {
  const rand = rng();
  if (rand < 0.3) return 0; // unknown
  return Math.floor(rng() * 20) + 1; // 1-20
}

// Site distribution: Getty (~40%), Shutterstock/Adobe/iStock (~8% each), others distributed
export function generateSite(rng: RNG): { id: number; name: string } {
  const rand = rng();
  if (rand < 0.40) return SITE_NAMES[0]; // Getty
  if (rand < 0.48) return SITE_NAMES[1]; // Shutterstock
  if (rand < 0.56) return SITE_NAMES[2]; // Adobe
  if (rand < 0.64) return SITE_NAMES[3]; // iStock
  if (rand < 0.69) return SITE_NAMES[4]; // Pexels
  if (rand < 0.74) return SITE_NAMES[5]; // Unsplash
  // Remaining 26% distributed across sites 7-18
  const remainingSites = SITE_NAMES.slice(6);
  const index = Math.floor(rng() * remainingSites.length);
  return remainingSites[index];
}

// Ethnicity distribution: White (~70%), Asian (~10%), Black (~8%), Hispanic (~5%), others (~7%)
export function generateEthnicity(rng: RNG): {
  ids: number[];
  white: boolean;
  black: boolean;
  asian: boolean;
  hispanic: boolean;
  middle_eastern: boolean;
  native_american: boolean;
  pacific_islander: boolean;
  mixed: boolean;
  other: boolean;
} {
  const rand = rng();
  const ids: number[] = [];
  const flags = {
    white: false,
    black: false,
    asian: false,
    hispanic: false,
    middle_eastern: false,
    native_american: false,
    pacific_islander: false,
    mixed: false,
    other: false,
  };

  // Single ethnicity (most common)
  if (rand < 0.70) {
    ids.push(1);
    flags.white = true;
  } else if (rand < 0.80) {
    ids.push(2);
    flags.asian = true;
  } else if (rand < 0.88) {
    ids.push(3);
    flags.black = true;
  } else if (rand < 0.93) {
    ids.push(4);
    flags.hispanic = true;
  } else if (rand < 0.96) {
    ids.push(5);
    flags.middle_eastern = true;
  } else if (rand < 0.98) {
    ids.push(6);
    flags.native_american = true;
  } else if (rand < 0.99) {
    ids.push(7);
    flags.pacific_islander = true;
  } else if (rand < 0.995) {
    ids.push(8);
    flags.mixed = true;
  } else {
    ids.push(9);
    flags.other = true;
  }

  return { ids, ...flags };
}

// Location/country codes (simplified - common countries)
const COMMON_COUNTRIES = [
  { id: 1, code: 'US', region: 'North America' },
  { id: 2, code: 'GB', region: 'Europe' },
  { id: 3, code: 'CA', region: 'North America' },
  { id: 4, code: 'AU', region: 'Oceania' },
  { id: 5, code: 'DE', region: 'Europe' },
  { id: 6, code: 'FR', region: 'Europe' },
  { id: 7, code: 'IT', region: 'Europe' },
  { id: 8, code: 'ES', region: 'Europe' },
  { id: 9, code: 'JP', region: 'Asia' },
  { id: 10, code: 'CN', region: 'Asia' },
  { id: 11, code: 'IN', region: 'Asia' },
  { id: 12, code: 'BR', region: 'South America' },
  { id: 13, code: 'MX', region: 'North America' },
  { id: 14, code: 'RU', region: 'Europe' },
  { id: 15, code: 'UA', region: 'Europe' },
];

export function generateLocation(rng: RNG): {
  id: number;
  country_code: string;
  region: string;
} {
  const rand = rng();
  // ~30% unknown
  if (rand < 0.30) {
    return { id: 0, country_code: '', region: '' };
  }
  // Remaining distributed across common countries
  const index = Math.floor(rng() * COMMON_COUNTRIES.length);
  return COMMON_COUNTRIES[index];
}

// Presence flags - correlated (has_face often implies has_body)
export function generatePresenceFlags(rng: RNG): {
  has_face: boolean;
  has_body: boolean;
  has_feet: boolean;
  has_hands: boolean;
  has_left_hand: boolean;
  has_right_hand: boolean;
  is_face_distant: boolean;
  is_small: boolean;
  is_face_no_lms: boolean;
} {
  const hasFace = rng() < 0.60;
  const hasBody = hasFace ? rng() < 0.75 : rng() < 0.20;
  const hasHands = hasBody ? rng() < 0.50 : rng() < 0.10;
  const hasLeftHand = hasHands ? rng() < 0.60 : false;
  const hasRightHand = hasHands ? rng() < 0.60 : false;
  const hasFeet = hasBody ? rng() < 0.55 : rng() < 0.05;
  const isFaceDistant = hasFace ? rng() < 0.15 : false;
  const isSmall = rng() < 0.10;
  const isFaceNoLms = hasFace ? rng() < 0.05 : false;

  return {
    has_face: hasFace,
    has_body: hasBody,
    has_feet: hasFeet,
    has_hands: hasHands,
    has_left_hand: hasLeftHand,
    has_right_hand: hasRightHand,
    is_face_distant: isFaceDistant,
    is_small: isSmall,
    is_face_no_lms: isFaceNoLms,
  };
}

// Face orientation (for "looking at camera" queries)
// Realistic ranges: yaw -33 to -27, pitch -2 to 2, roll -2 to 2
export function generateFaceOrientation(
  rng: RNG,
  hasFace: boolean
): {
  face_x: number;
  face_y: number;
  face_z: number;
  mouth_gap: number;
} {
  if (!hasFace) {
    return { face_x: 0.0, face_y: 0.0, face_z: 0.0, mouth_gap: 0.0 };
  }

  // Yaw: -33 to -27 (looking at camera range)
  const face_x = -33 + rng() * 6;
  // Pitch: -2 to 2
  const face_y = -2 + rng() * 4;
  // Roll: -2 to 2
  const face_z = -2 + rng() * 4;
  // Mouth gap: 0 to 0.5
  const mouth_gap = rng() * 0.5;

  return {
    face_x: Math.round(face_x * 1000) / 1000,
    face_y: Math.round(face_y * 1000) / 1000,
    face_z: Math.round(face_z * 1000) / 1000,
    mouth_gap: Math.round(mouth_gap * 1000) / 1000,
  };
}

// Cluster generation with unclustered percentages
export function generateCluster(
  rng: RNG,
  maxClusters: number,
  unclusteredProb: number
): number {
  if (rng() < unclusteredProb) return 0;
  return Math.floor(rng() * maxClusters) + 1;
}

// Keywords: Variable array sizes (0-20 keywords, weighted toward 2-8)
export function generateKeywordIds(rng: RNG): number[] {
  const rand = rng();
  let count = 0;

  // Weighted distribution
  if (rand < 0.10) count = 0;
  else if (rand < 0.30) count = Math.floor(rng() * 3) + 1; // 1-3
  else if (rand < 0.60) count = Math.floor(rng() * 6) + 2; // 2-7
  else if (rand < 0.80) count = Math.floor(rng() * 8) + 5; // 5-12
  else if (rand < 0.95) count = Math.floor(rng() * 6) + 10; // 10-15
  else count = Math.floor(rng() * 6) + 15; // 15-20

  const keywords: number[] = [];
  for (let i = 0; i < count; i++) {
    keywords.push(Math.floor(rng() * 10000) + 1); // keyword IDs 1-10000
  }
  return keywords;
}

// Detection classes: Variable array sizes (0-15 classes, weighted toward 1-5)
export function generateDetectionClasses(rng: RNG): {
  count: number;
  classes: number[];
  top_class_id: number;
  top_class_confidence: number;
} {
  const rand = rng();
  let count = 0;

  // Weighted distribution
  if (rand < 0.20) count = 0;
  else if (rand < 0.50) count = 1;
  else if (rand < 0.75) count = Math.floor(rng() * 3) + 2; // 2-4
  else if (rand < 0.90) count = Math.floor(rng() * 5) + 3; // 3-7
  else count = Math.floor(rng() * 9) + 8; // 8-15

  const classes: number[] = [];
  for (let i = 0; i < count; i++) {
    classes.push(Math.floor(rng() * 80) + 1); // class IDs 1-80 (COCO classes)
  }

  const topClassId = count > 0 ? classes[0] : 0;
  const topClassConfidence = count > 0 ? 0.5 + rng() * 0.5 : 0.0; // 0.5-1.0

  return {
    count,
    classes,
    top_class_id: topClassId,
    top_class_confidence: Math.round(topClassConfidence * 1000) / 1000,
  };
}

// Topic model results (top 3 topics)
export function generateTopics(rng: RNG): {
  topic_id_1: number;
  topic_score_1: number;
  topic_id_2: number;
  topic_score_2: number;
  topic_id_3: number;
  topic_score_3: number;
} {
  const hasTopic1 = rng() < 0.80; // 80% have at least one topic
  const hasTopic2 = hasTopic1 && rng() < 0.60; // 60% of those have second
  const hasTopic3 = hasTopic2 && rng() < 0.40; // 40% of those have third

  return {
    topic_id_1: hasTopic1 ? Math.floor(rng() * 100) + 1 : 0,
    topic_score_1: hasTopic1 ? Math.round((0.3 + rng() * 0.7) * 1000) / 1000 : 0.0,
    topic_id_2: hasTopic2 ? Math.floor(rng() * 100) + 1 : 0,
    topic_score_2: hasTopic2 ? Math.round((0.2 + rng() * 0.5) * 1000) / 1000 : 0.0,
    topic_id_3: hasTopic3 ? Math.floor(rng() * 100) + 1 : 0,
    topic_score_3: hasTopic3 ? Math.round((0.1 + rng() * 0.3) * 1000) / 1000 : 0.0,
  };
}

// Upload date: Distributed across 2020-2024 for monthly partitioning
export function generateUploadDate(rng: RNG): Date {
  const startYear = 2020;
  const endYear = 2024;
  const year = startYear + Math.floor(rng() * (endYear - startYear + 1));
  const month = Math.floor(rng() * 12);
  const day = Math.floor(rng() * 28) + 1; // Avoid month-end issues
  return new Date(year, month, day);
}

// Author name (simplified)
export function generateAuthor(rng: RNG): string {
  const firstNames = [
    'John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa',
    'Robert', 'Maria', 'James', 'Anna', 'Michael', 'Emma', 'William', 'Olivia',
    'Richard', 'Sophia', 'Joseph', 'Isabella', 'Thomas', 'Charlotte', 'Charles', 'Amelia',
  ];
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor',
    'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Sanchez',
  ];
  const firstName = firstNames[Math.floor(rng() * firstNames.length)];
  const lastName = lastNames[Math.floor(rng() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

// Image dimensions (common stock photo sizes)
export function generateDimensions(rng: RNG): { width: number; height: number } {
  const rand = rng();
  if (rand < 0.10) {
    return { width: 0, height: 0 }; // unknown
  }

  const commonSizes = [
    { width: 1920, height: 1080 }, // HD
    { width: 3840, height: 2160 }, // 4K
    { width: 2560, height: 1440 }, // 2K
    { width: 1600, height: 1200 }, // 4:3
    { width: 2048, height: 1536 }, // 4:3
    { width: 1920, height: 1280 }, // 3:2
    { width: 2400, height: 1600 }, // 3:2
    { width: 1200, height: 800 }, // 3:2
    { width: 1024, height: 768 }, // 4:3
    { width: 800, height: 600 }, // 4:3
  ];

  const size = commonSizes[Math.floor(rng() * commonSizes.length)];
  // Add some variation
  const widthVariation = Math.floor(rng() * 100) - 50;
  const heightVariation = Math.floor(rng() * 100) - 50;
  return {
    width: Math.max(100, size.width + widthVariation),
    height: Math.max(100, size.height + heightVariation),
  };
}

