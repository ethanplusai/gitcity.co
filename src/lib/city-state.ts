/**
 * Creates a minimal GameState from a pre-built grid for the city viewer.
 * This bypasses the full simulation initialization.
 */

import type { GameState, Tile, ServiceCoverage } from '@/types/game';

function createServiceCoverage(size: number): ServiceCoverage {
  const make2d = <T>(val: T) => Array.from({ length: size }, () => Array(size).fill(val) as T[]);
  return {
    police: make2d(0),
    fire: make2d(0),
    health: make2d(0),
    education: make2d(0),
    power: make2d(true),
    water: make2d(true),
  };
}

export function createCityGameState(grid: Tile[][], gridSize: number, cityName: string): GameState {
  return {
    id: `gitcity-${Date.now()}`,
    grid,
    gridSize,
    cityName,
    year: 2025,
    month: 1,
    day: 1,
    hour: 12,
    tick: 0,
    speed: 1, // keep at 1 for vehicle movement — simulation tick is skipped via GameProvider
    selectedTool: 'select',
    taxRate: 0,
    effectiveTaxRate: 0,
    stats: {
      population: 0,
      jobs: 0,
      money: 0,
      income: 0,
      expenses: 0,
      happiness: 100,
      health: 100,
      education: 100,
      safety: 100,
      environment: 100,
      demand: { residential: 0, commercial: 0, industrial: 0 },
    },
    budget: {
      police: { name: 'Police', funding: 100, cost: 0 },
      fire: { name: 'Fire', funding: 100, cost: 0 },
      health: { name: 'Health', funding: 100, cost: 0 },
      education: { name: 'Education', funding: 100, cost: 0 },
      transportation: { name: 'Transportation', funding: 100, cost: 0 },
      parks: { name: 'Parks', funding: 100, cost: 0 },
      power: { name: 'Power', funding: 100, cost: 0 },
      water: { name: 'Water', funding: 100, cost: 0 },
    },
    services: createServiceCoverage(gridSize),
    notifications: [],
    advisorMessages: [],
    history: [],
    activePanel: 'none',
    disastersEnabled: false,
    adjacentCities: [],
    waterBodies: [],
    gameVersion: 0,
    cities: [{
      id: `gitcity-${Date.now()}`,
      name: cityName,
      bounds: { minX: 0, minY: 0, maxX: gridSize - 1, maxY: gridSize - 1 },
      economy: { population: 0, jobs: 0, income: 0, expenses: 0, happiness: 100, lastCalculated: 0 },
      color: '#3b82f6',
    }],
  };
}
