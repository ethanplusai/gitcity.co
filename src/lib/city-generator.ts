/**
 * City Generator — transforms GitHub repo data into an IsoCity-compatible Tile[][] grid.
 */

import { Tile, Building, BuildingType } from '@/types/game';
import { RepoFile } from './github-api';

// Map file extensions to IsoCity building types
const FILE_TO_BUILDING: Record<string, BuildingType> = {
  // TypeScript / JavaScript — commercial (offices)
  ts: 'office_low',
  tsx: 'office_high',
  js: 'shop_medium',
  jsx: 'shop_medium',
  mjs: 'shop_small',
  cjs: 'shop_small',

  // Python — university / research
  py: 'university',
  pyi: 'school',
  ipynb: 'museum',

  // Systems languages — industrial
  go: 'factory_medium',
  rs: 'factory_large',
  c: 'factory_small',
  cpp: 'factory_medium',
  h: 'warehouse',
  hpp: 'warehouse',

  // Java / Kotlin / C#
  java: 'office_high',
  kt: 'office_high',
  cs: 'office_low',

  // Ruby / PHP / Perl
  rb: 'house_medium',
  php: 'house_medium',
  pl: 'house_small',

  // Config files — small shops
  json: 'shop_small',
  yaml: 'shop_small',
  yml: 'shop_small',
  toml: 'shop_small',
  ini: 'shop_small',
  env: 'shop_small',

  // Styles — mansions (colorful)
  css: 'mansion',
  scss: 'mansion',
  sass: 'mansion',
  less: 'mansion',

  // HTML / templates
  html: 'house_medium',
  htm: 'house_medium',
  ejs: 'house_small',
  hbs: 'house_small',
  pug: 'house_small',

  // Docs — parks
  md: 'park',
  txt: 'park',
  rst: 'park',
  adoc: 'park',

  // Vue / Svelte / frameworks
  vue: 'office_low',
  svelte: 'office_low',
  astro: 'office_low',

  // Shell / scripting
  sh: 'community_center',
  bash: 'community_center',
  zsh: 'community_center',
  fish: 'community_center',
  ps1: 'community_center',

  // SQL / databases
  sql: 'warehouse',

  // Dockerfiles, etc
  dockerfile: 'power_plant',

  // Swift / Dart
  swift: 'apartment_high',
  dart: 'apartment_low',

  // Terraform / IaC
  tf: 'water_tower',
  hcl: 'water_tower',

  // Proto / GraphQL
  proto: 'rail_station',
  graphql: 'rail_station',
  gql: 'rail_station',
};

// Entry files get landmark buildings
const ENTRY_BUILDINGS: BuildingType[] = ['city_hall', 'stadium', 'hospital', 'museum', 'airport'];

// Default building for unknown file types
const DEFAULT_BUILDING: BuildingType = 'house_small';

function createBuilding(type: BuildingType, level: number = 1): Building {
  return {
    type,
    level: type === 'grass' || type === 'empty' || type === 'water' || type === 'road' || type === 'tree' ? 0 : level,
    population: 0,
    jobs: 0,
    powered: true,
    watered: true,
    onFire: false,
    fireProgress: 0,
    age: 100,
    constructionProgress: 100,
    abandoned: false,
  };
}

// Determine building level (height) from line count
// Level 1 = tiny file, Level 5 = massive file (skyscraper)
function getLevelFromLines(lines: number): number {
  if (lines >= 500) return 5;  // skyscraper
  if (lines >= 200) return 4;  // tall
  if (lines >= 100) return 3;  // medium-tall
  if (lines >= 50) return 2;   // medium
  return 1;                     // small
}

function createTile(x: number, y: number, buildingType: BuildingType = 'grass', level: number = 1): Tile {
  return {
    x,
    y,
    zone: 'none',
    building: createBuilding(buildingType, level),
    landValue: 50,
    pollution: 0,
    crime: 0,
    traffic: 0,
    hasSubway: false,
  };
}

function getBuildingForFile(file: RepoFile, entryIndex: number): BuildingType {
  if (file.isEntry && entryIndex < ENTRY_BUILDINGS.length) {
    return ENTRY_BUILDINGS[entryIndex];
  }

  const base = FILE_TO_BUILDING[file.type] || DEFAULT_BUILDING;

  // Upgrade to taller variants for large files
  if (file.lines >= 300) {
    // Big files get tall commercial/residential variants
    if (base === 'office_low') return 'office_high';
    if (base === 'shop_small') return 'shop_medium';
    if (base === 'shop_medium') return 'office_high';
    if (base === 'house_small') return 'apartment_low';
    if (base === 'house_medium') return 'apartment_high';
    if (base === 'factory_small') return 'factory_medium';
    if (base === 'factory_medium') return 'factory_large';
    if (base === 'school') return 'university';
  } else if (file.lines >= 150) {
    if (base === 'shop_small') return 'shop_medium';
    if (base === 'house_small') return 'house_medium';
    if (base === 'factory_small') return 'factory_medium';
  }

  return base;
}

const ZONE_MAP: Record<string, 'residential' | 'commercial' | 'industrial'> = {
  house_small: 'residential', house_medium: 'residential', mansion: 'residential',
  apartment_low: 'residential', apartment_high: 'residential', cabin_house: 'residential',
  shop_small: 'commercial', shop_medium: 'commercial', office_low: 'commercial',
  office_high: 'commercial', mall: 'commercial',
  factory_small: 'industrial', factory_medium: 'industrial', factory_large: 'industrial',
  warehouse: 'industrial',
};

// Deterministic seeded random
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Get the directory key for a file at a given depth.
 * For depth=2 and path "src/lib/utils.ts", returns "src/lib".
 * For root files, returns ".".
 */
function getDirKey(path: string, depth: number): string {
  const parts = path.split('/');
  if (parts.length <= 1) return '.';
  return parts.slice(0, Math.min(depth, parts.length - 1)).join('/');
}

/**
 * Group files into directory buckets, splitting large groups recursively.
 * Aims for groups of maxPerGroup or fewer files.
 */
function groupFiles(files: RepoFile[], maxPerGroup: number): Map<string, RepoFile[]> {
  // Start with 2-level grouping
  let groups = new Map<string, RepoFile[]>();
  for (const file of files) {
    const key = getDirKey(file.path, 2);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(file);
  }

  // If any group is still too large, split it deeper (up to depth 4)
  for (let depth = 3; depth <= 4; depth++) {
    const newGroups = new Map<string, RepoFile[]>();
    for (const [key, groupFiles] of groups) {
      if (groupFiles.length <= maxPerGroup) {
        newGroups.set(key, groupFiles);
      } else {
        // Split this group deeper
        for (const file of groupFiles) {
          const newKey = getDirKey(file.path, depth);
          if (!newGroups.has(newKey)) newGroups.set(newKey, []);
          newGroups.get(newKey)!.push(file);
        }
      }
    }
    groups = newGroups;
  }

  return groups;
}

/**
 * Generate a city grid from repo data.
 *
 * Algorithm:
 * 1. Group files by directory (2+ levels deep, splitting large groups)
 * 2. Sort directories by file count
 * 3. Calculate block sizes proportional to file count
 * 4. Lay out blocks in a grid with road borders
 * 5. Place buildings mapped from file types
 * 6. Fill gaps with trees, surround with water
 */
export function generateCityFromRepo(
  files: RepoFile[],
  gridSize: number = 40,
): { grid: Tile[][]; buildingPositions: Map<string, { x: number; y: number }> } {
  const rand = seededRandom(42);
  const buildingPositions = new Map<string, { x: number; y: number }>();

  // Initialize grid with grass
  const grid: Tile[][] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < gridSize; x++) {
      row.push(createTile(x, y, 'grass'));
    }
    grid.push(row);
  }

  // Limit total files to what we can fit (cap at gridSize^2 * 0.5)
  const maxTotalFiles = Math.floor(gridSize * gridSize * 0.5);
  const cappedFiles = files.slice(0, maxTotalFiles);

  // Target block inner size: ~6-10 files per side
  const targetBlockInner = 7;
  const maxPerGroup = targetBlockInner * targetBlockInner; // ~49 files per group

  const groups = groupFiles(cappedFiles, maxPerGroup);

  // Sort groups: root first, then by file count descending
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
    if (a[0] === '.') return -1;
    if (b[0] === '.') return 1;
    return b[1].length - a[1].length;
  });

  const totalGroups = sortedGroups.length;
  const blocksPerSide = Math.ceil(Math.sqrt(totalGroups));

  // Reserve border for water (2 tiles) + margin (1 tile)
  const usableStart = 3;
  const usableEnd = gridSize - 3;
  const usableSize = usableEnd - usableStart;

  // Block size: divide usable area evenly
  const blockSize = Math.max(4, Math.floor(usableSize / blocksPerSide));

  let entryIndex = 0;

  // Place each directory group as a city block
  sortedGroups.forEach(([, groupFiles], groupIndex) => {
    const blockRow = Math.floor(groupIndex / blocksPerSide);
    const blockCol = groupIndex % blocksPerSide;

    const blockStartX = usableStart + blockCol * blockSize;
    const blockStartY = usableStart + blockRow * blockSize;

    // Inner area (1 tile road border on each side)
    const innerStartX = blockStartX + 1;
    const innerStartY = blockStartY + 1;
    const innerSize = blockSize - 2;

    if (innerSize <= 0) return;
    if (blockStartX + blockSize > gridSize || blockStartY + blockSize > gridSize) return;

    // Place road border around the block
    for (let i = 0; i < blockSize && blockStartX + i < gridSize; i++) {
      const rx = blockStartX + i;
      // Top road
      if (blockStartY < gridSize) {
        grid[blockStartY][rx] = createTile(rx, blockStartY, 'road');
      }
      // Bottom road
      const by = blockStartY + blockSize - 1;
      if (by < gridSize) {
        grid[by][rx] = createTile(rx, by, 'road');
      }
    }
    for (let i = 0; i < blockSize && blockStartY + i < gridSize; i++) {
      const ry = blockStartY + i;
      // Left road
      if (blockStartX < gridSize) {
        grid[ry][blockStartX] = createTile(blockStartX, ry, 'road');
      }
      // Right road
      const bx = blockStartX + blockSize - 1;
      if (bx < gridSize) {
        grid[ry][bx] = createTile(bx, ry, 'road');
      }
    }

    // Place buildings for files
    const maxFiles = innerSize * innerSize;
    const filesToPlace = groupFiles.slice(0, maxFiles);

    filesToPlace.forEach((file, fileIndex) => {
      const fx = innerStartX + (fileIndex % innerSize);
      const fy = innerStartY + Math.floor(fileIndex / innerSize);

      if (fx >= gridSize || fy >= gridSize) return;

      const buildingType = getBuildingForFile(file, entryIndex);
      if (file.isEntry) entryIndex++;
      const level = getLevelFromLines(file.lines);

      grid[fy][fx] = createTile(fx, fy, buildingType, level);
      const zone = ZONE_MAP[buildingType];
      if (zone) grid[fy][fx].zone = zone;

      buildingPositions.set(file.path, { x: fx, y: fy });
    });

    // Fill remaining inner tiles with occasional trees
    for (let iy = 0; iy < innerSize; iy++) {
      for (let ix = 0; ix < innerSize; ix++) {
        const fx = innerStartX + ix;
        const fy = innerStartY + iy;
        if (fx >= gridSize || fy >= gridSize) continue;
        if (grid[fy][fx].building.type !== 'grass') continue;
        if (rand() > 0.5) {
          grid[fy][fx] = createTile(fx, fy, 'tree');
        }
      }
    }
  });

  // Add water border (2 tiles thick)
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const distFromEdge = Math.min(x, y, gridSize - 1 - x, gridSize - 1 - y);
      if (distFromEdge < 2) {
        grid[y][x] = createTile(x, y, 'water');
      }
    }
  }

  // Scatter trees on remaining grass in margins
  for (let y = 2; y < gridSize - 2; y++) {
    for (let x = 2; x < gridSize - 2; x++) {
      if (grid[y][x].building.type === 'grass' && rand() > 0.65) {
        grid[y][x] = createTile(x, y, 'tree');
      }
    }
  }

  return { grid, buildingPositions };
}

/**
 * Calculate a good grid size for a repo based on file count.
 */
export function calculateGridSize(fileCount: number): number {
  // Small repos (under 50 files) get a compact grid
  if (fileCount < 50) {
    return 25;
  }
  // Each file needs ~2 tiles (building + road share), plus water border.
  // Target ~40% building density in usable area.
  // Usable area = (gridSize - 6)^2
  // Buildings = fileCount, total tiles needed = fileCount / 0.4
  // Cap files at 500 for performance — IsoCity renderer is expensive
  const capped = Math.min(fileCount, 500);
  const tilesNeeded = capped / 0.35;
  const rawSize = Math.sqrt(tilesNeeded) + 6;
  // Clamp between 30 and 60 — larger grids crash browsers
  return Math.max(30, Math.min(60, Math.ceil(rawSize)));
}
