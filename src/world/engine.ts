import { arrivalGrid } from './arrival-grid';
import { planFixtures } from './plan-fixtures.mjs';
import { shadowBudget } from '../../shared/shadow-budget.mjs';
import { FootstepCadence, walkingLookBlend } from './footstep-cadence.mjs';
import { walkingProgress } from '../../shared/walking-progress.mjs';
import { yieldFrame } from './frame-yield.mjs';
import { rebasePlan } from './rebase-plan';
import { PavementWorker } from './pavement-worker.mjs';
import { foliageClock } from './foliage-motion.mjs';
import { repoArrival, streetArrival } from './repo-arrival';
import { directoryMassing, directoryHit } from './directory-massing';
import { unloadBuildingBlock, reloadBuildingBlock } from './building-stream';
import { worldStreetGraph, connectedWorldGraph } from '../../shared/world-street-graph.mjs';
import { HIGHWAY } from '../../shared/highway-profile.mjs';
import { applyStreetOpenings } from './street-openings.mjs';
import { highwaySurfaces } from './highway-surfaces.mjs';
import { BlockBatches } from './block-batches';
import { towerCrane } from './construction';
import { groundCover } from './ground-cover.mjs';
import { atmosphereDensity } from '../../shared/atmosphere.mjs';
import { pointInPolygon } from '../../shared/street-surfaces.mjs';
import { ownerPlan } from './owner-plan';
import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { AdaptiveQuality } from './adaptive-quality.mjs';
import { StreetLightPool } from './street-light-pool.mjs';
import { previewMassing } from './preview-massing';
import { preparePreviewFacades, disposePreviewFacades } from './preview-facades';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { cameraFloor, keepAboveGround } from './camera-floor.mjs';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  streetGateway,
  segmentHitsSite,
  planConnection,
  sharedCorridors,
} from '../../shared/road-network.mjs';
import { atlas, random, building, coordinates } from '../../shared/model.mjs';
import type { City, Repo, CodeFile } from './types';
import { CityAudio } from './audio';
import { publicRealm } from './public-realm';
import { plannedLayout, type PlannedLayout } from './planned-layout';
import { plannedStreets, preparePlannedStreets, disposePreparedStreets } from './planned-streets';
import { graphRoute, streetRoute } from './navigation';
import { contract, canService } from '../../shared/operations.mjs';
import { ownerSeed } from '../../shared/geography.mjs';
import { parcels, boulevard, batchArchitecture, batchedFile } from './urban';
import { civicHall } from './civic';
import { architecture, architectureStyle, streetscape } from './architecture';
import { StreetLife } from './street-life';
import { canSurvey } from '../../shared/street-life.mjs';
import { Landscape } from './landscape';
import { localSky } from '../../shared/sky-time.mjs';
import { Surfaces } from './surfaces';
const UP = new T.Vector3(0, 1, 0);

export type WalkingTravel = { destination: string; seconds: number; distance: number };

export type HighwayTravel = { destination: string; seconds: number };

export type MissionView = {
  name: string;
  path: string;
  index: number;
  total: number;
  distance: number;
  arrived: boolean;
  seconds: number;
  walking: boolean;
  position: { x: number; z: number };
  target: { x: number; z: number };
  side: number;
  map?: PlannedLayout['map'];
  route?: { x: number; z: number }[];
};
function cityWork<T>(label: string, work: () => T): T {
  if (process.env.NODE_ENV === 'production') return work();
  const start = performance.now();
  try {
    return work();
  } finally {
    console.debug(`[city-work] ${label}: ${(performance.now() - start).toFixed(1)}ms`);
  }
}

export class WorldEngine {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, 0.08, 18000);
  renderer: T.WebGLRenderer;
  surfaces = new Surfaces();
  qualityHistory = new AdaptiveQuality();
  highQualityReady = false;
  economical = false;
  composer: EffectComposer | null = null;
  ambientPass: SSAOPass | null = null;
  controls: OrbitControls;
  atlasRoads = new T.Group();
  atlasEdges = new Set<string>();
  constructed = new Set<string>();
  onMission: ((view: MissionView | null) => void) | null = null;
  onComplete: ((job: ReturnType<typeof contract>, seconds: number) => void) | null = null;
  job: NonNullable<ReturnType<typeof contract>> | null = null;
  jobIndex = 0;
  jobTime = 0;
  waypoint = new T.Group();
  walkPath: T.Vector3[] = [];
  exploredRoadSources = new Set<string>();
  highwayDestinations = new Set<string>();
  highwayGraph: ReturnType<typeof worldStreetGraph> | null = null;
  highwayDestination: string | null = null;
  blockers: T.Box3[] = [];
  surveyBlockers = new Map<string, T.Box3[]>();
  neighborBlockers: T.Box3[] = [];
  neighborRegions: { id: string; polygons: { x: number; z: number }[][] }[] = [];
  pendingStreetView: { id: string; position: T.Vector3; target: T.Vector3 } | null = null;
  lastNeighborhoodCheck = 0;
  neighborhoodSide = 1;
  activePlan: PlannedLayout | null = null;
  addresses = new Map<string, Map<string, number>>();
  previews = new Map<string, Repo>();
  ownerGround = new Map<
    string,
    { group: T.Group; hall: T.Group; plan: PlannedLayout; origin: { x: number; z: number } }
  >();
  world = new T.Group();
  landscape = new Landscape();
  streetLights = Array.from({ length: 4 }, () => new T.PointLight(0xffdeb0, 0, 8, 2));
  streetLightPool = new StreetLightPool(4);
  lastStreetLightFrame = 0;
  hemisphere = new T.HemisphereLight(0xc9deea, 0x6d6960, 0.8);
  lastLighting = -10;
  district = new T.Group();
  highways = new T.Group();
  cities = new Map<string, { city: City; group: T.Group }>();
  activeScale = 1;
  active: string | null = null;
  viewMode: 'world' | 'owner' | 'repo' = 'world';
  data: Repo | null = null;
  audio = new CityAudio();
  clock = new T.Clock();
  frame = 0;
  disposed = false;
  ray = new T.Raycaster();
  pointer = new T.Vector2();
  pickables: T.Object3D[] = [];
  filePositions = new Map<string, T.Vector3>();
  fileGroups = new Map<string, T.Group>();
  blockBatches: BlockBatches | null = null;
  residentLabels: { element: HTMLButtonElement; position: T.Vector3 }[] = [];
  interior: T.Group | null = null;
  inside: T.Group | null = null;
  animations: { object: T.Object3D; start: number; duration: number }[] = [];
  streetLife: StreetLife | null = null;
  journeyCache = new Map<
    string,
    { origin: { x: number; z: number }; state: ReturnType<StreetLife['journeyState']> }
  >();
  issueAddresses = new Map<string, Map<number, number>>();
  closedIssues = new Map<string, Map<number, string>>();
  trackedIssue: number | null = null;
  issueRouteRequested = false;
  onStreetEncounter:
    | ((
        target: number | 'visitor' | 'traffic',
        journey?: { destination: string; point: { x: number; z: number }; arrived: boolean },
      ) => void)
    | null = null;
  onHighwayTravel: ((trip: HighwayTravel | null) => void) | null = null;
  onWalkingTravel: ((trip: WalkingTravel | null) => void) | null = null;
  private walkingDestination: string | null = null;
  private lastWalkingTravel = '';
  private lastHighwayTravel = '';
  onNavigationNotice: ((message: string) => void) | null = null;
  onHighway: ((destinations: string[]) => void) | null = null;
  onStreetProximity: ((distance: number, walking: boolean) => void) | null = null;
  cars: { mesh: T.Mesh; curve: T.Curve<T.Vector3>; speed: number; offset: number }[] = [];
  cranes: T.Group[] = [];
  goal: { position: T.Vector3; target: T.Vector3 } | null = null;
  walking = false;
  keys = new Set<string>();
  private footsteps = new FootstepCadence();
  onHall: (() => void) | null = null;
  onDirectory: ((directory: string, block?: number) => void | Promise<boolean | undefined>) | null =
    null;
  nextDirectorySurvey = 0;
  requestedDirectories = new Set<string>();
  residents: { login: string; path: string; pr: number }[] = [];
  civicGroup = new T.Group();
  windowMaterials: T.MeshStandardMaterial[] = [];
  bodyMaterials: T.MeshStandardMaterial[] = [];
  rain: T.Points | null = null;
  lastConstruction = 0;
  onCity: (id: string) => void;
  onFile: (file: CodeFile) => void;
  onView: (height: number, walking: boolean) => void;
  labels: HTMLDivElement;
  labelElements = new Map<string, HTMLButtonElement>();
  resizeObserver: ResizeObserver;
  canvasDown = { x: 0, y: 0 };
  sun: T.DirectionalLight;
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  lastHud = 0;
  constructor(
    private container: HTMLElement,
    onCity: (id: string) => void,
    onFile: (file: CodeFile) => void,
    onView: (height: number, walking: boolean) => void,
  ) {
    this.onCity = onCity;
    this.onFile = onFile;
    this.onView = onView;
    this.renderer = new T.WebGLRenderer({
      antialias: window.devicePixelRatio < 2,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor('#b7c5ca');
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D GitHub world. Drag to orbit, scroll to descend, select a city to visit.',
    );
    this.scene.fog = new T.FogExp2('#b7c5ca', 0.0012);
    this.scene.add(this.world, this.district, this.highways, this.atlasRoads);
    this.scene.add(this.hemisphere);
    this.scene.add(...this.streetLights);
    this.sun = new T.DirectionalLight('#fff1dd', 3.8);
    this.sun.position.set(-35, 65, 20);
    this.sun.castShadow =
      window.innerWidth > 700 && !window.matchMedia('(pointer: coarse)').matches;
    const compactShadow =
      window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches;
    this.sun.shadow.mapSize.setScalar(compactShadow ? 512 : 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -110,
      right: 110,
      top: 110,
      bottom: -110,
      near: 1,
      far: 240,
    });
    this.sun.shadow.bias = -0.00008;
    this.scene.add(this.sun, this.sun.target);
    this.sun.shadow.normalBias = 0.004;
    const home = ownerSeed('vercel');
    this.sun.position.set(home.x - 35, 65, home.z + 25);
    this.sun.target.position.set(home.x, 0, home.z);
    this.camera.position.set(home.x + 25, 12, home.z + 30);
    if (process.env.NODE_ENV !== 'production')
      Object.defineProperty(this.renderer.domElement, 'readTrafficState', {
        configurable: true,
        value: () => this.streetLife?.journeyState(),
      });
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(home.x, 0, home.z);
    this.controls.enableDamping = true;
    this.controls.screenSpacePanning = false;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 9000;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.015;
    this.controls.zoomSpeed = 0.7;
    this.controls.addEventListener('start', this.cancelFlight);
    this.terrain();
    for (const city of atlas) this.addCity({ ...city, ...ownerSeed(city.id.split('/')[0]) });
    this.labels = document.createElement('div');
    this.labels.className = 'world-labels';
    container.append(this.labels);
    for (const { city } of this.cities.values()) this.addLabel(city);
    if (window.innerWidth > 900 && !window.matchMedia('(pointer: coarse)').matches) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.composer.renderTarget1.samples = 4;
      this.composer.renderTarget2.samples = 4;
      this.ambientPass = new SSAOPass(this.scene, this.camera, 1, 1, 12);
      this.ambientPass.kernelRadius = 1.5;
      this.ambientPass.minDistance = 0.001;
      this.ambientPass.maxDistance = 0.08;
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(this.ambientPass);
      this.composer.addPass(new OutputPass());
    }
    void this.surfaces.load(this.renderer, this.scene);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.pointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.pointerMove);
    this.renderer.domElement.addEventListener('pointercancel', this.pointerCancel);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clearKeys);
    document.addEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.frame = requestAnimationFrame(this.animate);
  }
  material(color: T.ColorRepresentation, emissive = false) {
    return new T.MeshStandardMaterial({
      color,
      roughness: 0.85,
      ...(emissive ? { emissive: color, emissiveIntensity: 0.8 } : {}),
    });
  }
  box(
    group: T.Group,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: T.ColorRepresentation,
    glow = false,
  ) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), this.material(color, glow));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  terrain() {
    this.scene.add(this.landscape.group);
    const ground = new T.Mesh(
      new T.PlaneGeometry(24000, 24000),
      groundCover(new T.MeshStandardMaterial({ color: '#7b8460', roughness: 1 })),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -4;
    ground.receiveShadow = true;
    this.world.add(ground);
  }
  clearCityTrees() {
    const sites: { x: number; z: number }[] = [],
      blocks: { x: number; z: number }[][] = [];
    const plannedOwners = new Set<string>();
    for (const [owner, { plan, origin }] of this.ownerGround) {
      plannedOwners.add(owner);
      blocks.push(
        ...[...plan.blocks, ...plan.streets.filter((c) => c.column === 0 && c.row === 0)].map(
          (block) =>
            block.polygon.map((p: { x: number; z: number }) => ({
              x: p.x + origin.x,
              z: p.z + origin.z,
            })),
        ),
      );
      const nodes = new Map(plan.graph.nodes.map((n) => [n.id, n]));
      for (const edge of plan.graph.edges.filter((edge) => edge.connector)) {
        const a = nodes.get(edge.from)!,
          b = nodes.get(edge.to)!;
        const nx = (-(b.z - a.z) / edge.length) * 1.725;
        const nz = ((b.x - a.x) / edge.length) * 1.725;
        blocks.push([
          { x: a.x + nx + origin.x, z: a.z + nz + origin.z },
          { x: a.x - nx + origin.x, z: a.z - nz + origin.z },
          { x: b.x - nx + origin.x, z: b.z - nz + origin.z },
          { x: b.x + nx + origin.x, z: b.z + nz + origin.z },
        ]);
      }
    }
    for (const { city, group } of this.cities.values()) {
      if (group.getObjectByName('arrival-grid')) {
        blocks.push([
          { x: city.x - 12, z: city.z - 12 },
          { x: city.x + 12, z: city.z - 12 },
          { x: city.x + 12, z: city.z + 12 },
          { x: city.x - 12, z: city.z + 12 },
        ]);
      }
      if (plannedOwners.has(city.id.split('/')[0].toLowerCase())) continue;
      // A label reserves a world address, not a clearing. Legacy rendered
      // neighborhoods retain their footprint until they have a shared plan.
      if (group.getObjectByName('neighborhood') || (this.active === city.id && this.data))
        sites.push({ x: city.x, z: city.z });
    }
    this.landscape.setSites(sites);
    this.landscape.setBlocks(blocks);
  }
  updateLighting(time: number) {
    const sky = localSky(),
      storm = ['failure', 'error'].includes(this.data?.ci || '');
    const lightScale = this.active ? this.activeScale : 1;
    this.streetLightPool.update(time - this.lastStreetLightFrame).forEach((slot, i) => {
      const light = this.streetLights[i];
      light.intensity = sky.night * 9 * lightScale * lightScale * slot.weight;
      light.distance = 8 * lightScale;
      if (slot.position) light.position.set(slot.position.x, slot.position.y, slot.position.z);
    });
    this.lastStreetLightFrame = time;
    this.landscape.update(
      this.controls.target,
      this.camera.position,
      time,
      sky,
      storm,
      this.reduceMotion,
    );
    if (this.scene.fog instanceof T.FogExp2)
      this.scene.fog.density = atmosphereDensity(
        this.camera.position.distanceTo(this.controls.target),
        storm,
      );
    if (time - this.lastLighting < 1) return;
    this.lastLighting = time;
    const shadows = shadowBudget({
      compact: window.innerWidth <= 700 || window.matchMedia('(pointer: coarse)').matches,
      walking: this.walking,
      economical: this.economical,
    });
    this.sun.castShadow = shadows.enabled;
    if (this.sun.shadow.mapSize.x !== shadows.size) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.setScalar(shadows.size);
    }
    this.renderer.domElement.dataset.directionalShadows = String(shadows.enabled);
    this.renderer.domElement.dataset.shadowMapSize = String(shadows.size);
    this.renderer.shadowMap.needsUpdate = shadows.enabled;
    const angle = ((sky.hour - 6.5) / 13) * Math.PI;
    const center = this.walking ? this.camera.position : this.controls.target;
    // Keep the finite shadow texture useful around the camera, even when a
    // repository's full inventory covers many square kilometers.
    const shadowExtent = Math.min(
      100,
      Math.max(this.walking ? 18 : 28, this.camera.position.y * 1.2),
    );
    Object.assign(this.sun.shadow.camera, {
      left: -shadowExtent,
      right: shadowExtent,
      top: shadowExtent,
      bottom: -shadowExtent,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.position.set(
      center.x + Math.cos(angle) * 65,
      Math.max(12, Math.abs(Math.sin(angle)) * 65),
      center.z - 25,
    );
    this.sun.target.position.set(center.x, 0, center.z);
    this.sun.color.set(
      sky.daylight < 0.1 ? '#a9c5ff' : sky.elevation < 0.3 ? '#ffc88b' : '#fff1db',
    );
    const fixtures: T.Vector3[] = [];
    if (this.activePlan && this.active) {
      fixtures.push(
        ...planFixtures(this.activePlan).map((p: { x: number; z: number }) =>
          new T.Vector3(p.x, 2.5, p.z).add(this.district.position),
        ),
      );
    } else if (this.active) {
      for (let ix = 0; ix < this.neighborhoodSide; ix++)
        for (let iz = 0; iz < this.neighborhoodSide; iz++)
          for (const sign of [-1, 1])
            for (const k of [-8, 0, 8])
              fixtures.push(
                new T.Vector3(
                  (ix - (this.neighborhoodSide - 1) / 2) * 24 + k + 0.35,
                  2.5,
                  (iz - (this.neighborhoodSide - 1) / 2) * 24 + sign * 10,
                )
                  .multiplyScalar(this.activeScale)
                  .add(this.district.position),
              );
    }
    if (!this.active) {
      for (const { plan, origin } of this.ownerGround.values())
        fixtures.push(
          ...planFixtures(plan).map(
            (p: { x: number; z: number }) => new T.Vector3(p.x + origin.x, 2.5, p.z + origin.z),
          ),
        );
    }
    this.streetLightPool.select(fixtures, this.camera.position);
    this.sun.intensity = (1.05 + sky.daylight * 2.55) * (storm ? 0.5 : 1);
    this.hemisphere.intensity = 0.85 + sky.daylight * 0.08;
    this.hemisphere.groundColor.set(sky.night > 0.5 ? '#7b8090' : '#6d6960');
    this.renderer.toneMappingExposure = 1 + sky.night * 0.18;
    this.hemisphere.color.set(sky.daylight < 0.2 ? '#8199c9' : '#c9deea');
    this.scene.environmentIntensity = 0.5 + sky.daylight * 0.15;
    const fog = new T.Color('#162439').lerp(
      new T.Color(storm ? '#697781' : '#b7c5ca'),
      sky.daylight,
    );
    if (this.scene.fog instanceof T.FogExp2) {
      this.scene.fog.color.copy(fog);
    }
    this.renderer.setClearColor(fog);
    this.scene.traverse((object) => {
      object.userData.updateVegetation?.(this.camera.position);
      if (!(object instanceof T.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const m of materials) {
        if (m instanceof T.ShaderMaterial && m.uniforms.nightStrength)
          m.uniforms.nightStrength.value = sky.night;
        if (m instanceof T.MeshStandardMaterial) {
          if (m.userData.nightLamp) m.emissiveIntensity = 0.15 + sky.night * 2.5;
          if (m.userData.nightWindow)
            m.emissiveIntensity = m.userData.activityGlow + sky.night * 0.65;
        } else if (m instanceof T.ShaderMaterial && m.userData.lightPool)
          m.uniforms.night.value = sky.night;
      }
    });
    this.renderer.domElement.dataset.localPhase = sky.phase;
    this.renderer.domElement.dataset.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.renderer.domElement.dataset.localHour = sky.hour.toFixed(2);
    this.renderer.domElement.dataset.terrainTiles = String(this.landscape.tiles.size);
    this.renderer.domElement.dataset.terrainClearings = String(this.landscape.sites.length);
    this.renderer.domElement.dataset.terrainBlocks = String(this.landscape.blocks.length);
  }
  addCity(city: City, refresh = true) {
    if (this.cities.has(city.id)) return;
    const group = new T.Group();
    group.position.set(city.x, 0, city.z);
    group.add(arrivalGrid(city.id));
    this.world.add(group);
    this.cities.set(city.id, { city, group });
    if (refresh) this.clearCityTrees();
    // Uncharted locations are survey pads, not fabricated repo buildings.
    // Unexplored districts show neutral survey ground until source detail replaces it.
    if (this.labels) this.addLabel(city);
  }
  addLabel(city: City) {
    if (this.labelElements.has(city.id)) return;
    const el = document.createElement('button');
    el.className = 'map-label';
    el.style.setProperty('--city-color', city.color);
    const dot = document.createElement('i'),
      name = document.createElement('span'),
      sub = document.createElement('small');
    name.textContent = city.id.split('/')[0];
    sub.textContent = city.name + ' neighborhood';
    el.append(dot, name, sub);
    el.onclick = () => this.onCity(this.viewMode === 'world' ? city.id.split('/')[0] : city.id);
    this.labels.append(el);
    this.labelElements.set(city.id, el);
  }
  removeCity(id: string) {
    if (this.active === id) {
      this.clearDistrict();
      this.active = null;
      this.data = null;
    }
    const entry = this.cities.get(id);
    if (!entry) return;
    this.disposeGroup(entry.group);
    entry.group.removeFromParent();
    this.pickables = this.pickables.filter((object) => object.userData.city !== id);
    this.labelElements.get(id)?.remove();
    this.labelElements.delete(id);
    this.cities.delete(id);
    this.previews.delete(id);
    this.rebuildOwner(id.split('/')[0]);
    this.clearCityTrees();
  }
  private pavementWorker = new PavementWorker();
  private previewQueue: Promise<void> = Promise.resolve();
  private pendingPreviewBatches = 0;
  previewBatch(repositories: Repo[], signal?: AbortSignal) {
    this.renderer.domElement.dataset.pendingPreviewBatches = String(++this.pendingPreviewBatches);
    const run = async () => {
      if (this.disposed || signal?.aborted) return;
      const groups = new Map<string, Repo[]>();
      for (const repo of repositories) {
        const owner = repo.id.split('/')[0].toLowerCase();
        groups.set(owner, [...(groups.get(owner) || []), repo]);
      }
      for (const [owner, incoming] of groups) {
        await yieldFrame(signal);
        if (this.disposed || signal?.aborted) return;
        let prepared:
          | {
              repositories: Repo[];
              plan: PlannedLayout;
              layouts: Map<Repo, PlannedLayout>;
              streets?: T.Group;
            }
          | undefined;
        const candidates = incoming.filter(
          (repo) => repo.id.toLowerCase() !== this.active?.toLowerCase(),
        );
        if (candidates.length) {
          const data = new Map(
            [...this.previews].filter(([id]) => id.split('/')[0].toLowerCase() === owner),
          );
          for (const repo of candidates) data.set(repo.id, repo);
          if (this.data?.id.split('/')[0].toLowerCase() === owner)
            data.set(this.data.id, this.data);
          const planned = [...data.values()].filter((repo) => repo.landPlan);
          if (planned.length) {
            const layouts = new Map<Repo, PlannedLayout>();
            const plan = cityWork('owner-plan:' + owner, () =>
              ownerPlan(planned, this.addresses, planned[0].landPlan!.city, layouts),
            );
            prepared = { repositories: planned, plan, layouts };
            if (await this.pavementWorker.prepare(plan.graph)) {
              const canvas = this.renderer.domElement;
              canvas.dataset.pavementWorkerBuilds = String(
                Number(canvas.dataset.pavementWorkerBuilds || 0) + 1,
              );
            }
          }
        }
        await yieldFrame(signal);
        if (this.disposed || signal?.aborted) return;
        if (prepared) {
          prepared.streets =
            (await preparePlannedStreets(prepared.plan, signal, () => this.disposed)) || undefined;
          if (!prepared.streets) return;
        }
        try {
          if (this.disposed || signal?.aborted) return;
          let changed = false;
          for (const repo of incoming) {
            // Navigation may have changed while the worker was preparing streets.
            if (this.data && this.active?.toLowerCase() === repo.id.toLowerCase()) {
              const canvas = this.renderer.domElement;
              canvas.dataset.skippedActivePreviews = String(
                Number(canvas.dataset.skippedActivePreviews || 0) + 1,
              );
              continue;
            }
            if (
              cityWork('preview:' + repo.id, () =>
                this.preview(repo, false, prepared?.layouts.get(repo)),
              )
            )
              changed = true;
          }
          if (changed) cityWork('owner-commit:' + owner, () => this.rebuildOwner(owner, prepared));
        } finally {
          if (prepared?.streets && !prepared.streets.parent)
            disposePreparedStreets(prepared.streets);
        }
      }
    };
    const result = this.previewQueue.then(run).finally(() => {
      this.renderer.domElement.dataset.pendingPreviewBatches = String(--this.pendingPreviewBatches);
    });
    this.previewQueue = result.catch(() => {});
    return result;
  }
  preview(
    data: Repo,
    rebuild = true,
    preparedLayout?: PlannedLayout,
    detail?: boolean,
    preparedFacades?: T.Group,
  ) {
    const id = data.id;
    let entry = this.cities.get(id);
    if (!entry) {
      this.addCity({
        id,
        name: data.name,
        language: data.language,
        color: '#b2c99d',
        ...coordinates(id),
      });
      entry = this.cities.get(id)!;
    }
    if (data.coordinates) {
      entry.city.x = data.coordinates.x;
      entry.city.z = data.coordinates.z;
      entry.group.position.set(data.coordinates.x, 0, data.coordinates.z);
    }
    entry.city.city = data.city;
    detail ??=
      entry.group.getObjectByName('neighborhood')?.userData.previewDetail ??
      this.camera.position.distanceTo(entry.group.position) < 140;
    if (rebuild) this.clearCityTrees();
    const old = this.previews.get(id);
    if (
      old?.fetchedAt === data.fetchedAt &&
      JSON.stringify(old?.files) === JSON.stringify(data.files) &&
      JSON.stringify(old?.landPlan) === JSON.stringify(data.landPlan) &&
      JSON.stringify(old?.sourceInventory) === JSON.stringify(data.sourceInventory) &&
      entry.group.getObjectByName('neighborhood')?.userData.previewDetail === detail
    )
      return;
    const survey = entry.group.getObjectByName('arrival-grid');
    if (survey) {
      this.disposeGroup(survey as T.Group);
      survey.removeFromParent();
    }
    const previous = entry.group.getObjectByName('neighborhood');
    if (previous) {
      previous.traverse((object) => {
        this.pickables = this.pickables.filter((p) => p !== object);
      });
      this.disposeGroup(previous as T.Group);
      previous.removeFromParent();
    }
    const source = new T.Group();
    let addresses = this.addresses.get(id);
    if (!addresses) {
      addresses = new Map();
      this.addresses.set(id, addresses);
    }
    const plan = data.landPlan ? preparedLayout || plannedLayout(data, addresses) : null;
    const layout = plan || parcels(data, addresses);
    const freshPreview =
      !this.reduceMotion &&
      !preparedFacades &&
      !old &&
      layout.parcels.some((p) => !this.constructed.has(id + ':' + p.file.path));
    if (!preparedFacades)
      for (const parcel of [...layout.parcels].sort(
        (a, b) =>
          (a.file.lastCommit || '').localeCompare(b.file.lastCommit || '') ||
          a.file.path.localeCompare(b.file.path),
      )) {
        const kit = detail
          ? architecture(parcel.file, parcel.scale)
          : previewMassing(parcel.file, parcel.scale);
        kit.group.position.set(parcel.x, 0, parcel.z);
        kit.group.rotation.y = 'rotation' in parcel ? Number(parcel.rotation) : 0;
        source.add(kit.group);
        this.constructed.add(id + ':' + parcel.file.path);
      }
    const real = preparedFacades || (freshPreview ? new T.Group() : batchArchitecture(source));
    if (freshPreview) {
      let index = 0;
      while (source.children.length) {
        const batch = new T.Group();
        for (const child of source.children.slice(0, 8)) batch.add(child);
        const built = batchArchitecture(batch);
        real.add(built);
        this.animations.push({
          object: built,
          start: this.clock.elapsedTime + 0.4 + index++ * 0.35,
          duration: 1.1,
        });
        this.disposeGroup(batch);
      }
    }
    if (plan) real.add(directoryMassing(plan.regions));
    this.disposeGroup(source);
    if (!plan) real.add(streetscape(layout.total, layout.side), publicRealm(layout.total, data.id));
    real.scale.setScalar(plan ? 1 : ((entry.city.footprint || 14) * 1.7) / layout.total);
    real.name = 'neighborhood';
    real.userData.previewDetail = detail;
    real.userData.previewLayout = plan;
    real.traverse((object) => {
      object.userData.city = id;
    });
    entry.group.add(real);
    entry.group.updateWorldMatrix(true, true);
    real.userData.previewBounds = new T.Box3().setFromObject(real);
    this.previews.set(id, data);
    if (rebuild) this.rebuildOwner(id.split('/')[0]);
    if (rebuild) this.clearCityTrees();
    real.traverse((object) => {
      if (object instanceof T.Mesh) this.pickables.push(object);
    });
    return true;
  }
  private previewDetailPending = false;
  updatePreviewDetail() {
    if (this.previewDetailPending) return;
    for (const [id, entry] of this.cities) {
      if (id === this.active || !entry.group.visible) continue;
      const group = entry.group.getObjectByName('neighborhood');
      const data = this.previews.get(id);
      if (!group || !data) continue;
      if (this.animations.some((animation) => animation.object.parent === group)) continue;
      const bounds = group.userData.previewBounds as T.Box3 | undefined;
      if (!bounds) continue;
      const distance = bounds.distanceToPoint(this.camera.position);
      const detail = Boolean(group.userData.previewDetail);
      if ((detail && distance > 140) || (!detail && distance < 100)) {
        // Preserve the visible representation while its replacement is prepared.
        this.previewDetailPending = true;
        const plan = group.userData.previewLayout as PlannedLayout | null;
        const layout = plan || parcels(data, this.addresses.get(id));
        const canceled = () =>
          this.disposed ||
          this.active === id ||
          this.previews.get(id) !== data ||
          entry.group.getObjectByName('neighborhood') !== group ||
          (detail
            ? bounds.distanceToPoint(this.camera.position) < 100
            : bounds.distanceToPoint(this.camera.position) > 140);
        void preparePreviewFacades(layout.parcels, !detail, canceled)
          .then((prepared) => {
            if (!prepared) return;
            try {
              if (!canceled() && !this.pendingPreviewBatches)
                this.preview(data, false, plan || undefined, !detail, prepared);
            } finally {
              if (!prepared.parent) disposePreviewFacades(prepared);
            }
          })
          .catch((error) => {
            if (process.env.NODE_ENV !== 'production')
              console.warn('Preview detail preparation failed', error);
          })
          .finally(() => {
            this.previewDetailPending = false;
          });
        break;
      }
    }
  }
  rebuildOwner(
    owner: string,
    prepared?: {
      repositories: Repo[];
      plan: PlannedLayout;
      layouts?: Map<Repo, PlannedLayout>;
      streets?: T.Group;
    },
  ) {
    const canvas = this.renderer.domElement;
    canvas.dataset.ownerRebuilds = String(Number(canvas.dataset.ownerRebuilds || 0) + 1);
    const key = owner.toLowerCase(),
      data = new Map([...this.previews].filter(([id]) => id.split('/')[0].toLowerCase() === key));
    if (this.data?.id.split('/')[0].toLowerCase() === key) data.set(this.data.id, this.data);
    const repositories = [...data.values()].filter((r) => r.landPlan);
    const previous = this.ownerGround.get(key);
    if (previous) {
      const objects = new Set<T.Object3D>();
      previous.group.traverse((o) => objects.add(o));
      this.pickables = this.pickables.filter((o) => !objects.has(o));
      // Street topology changes as repositories arrive; the owner's civic kit
      // does not. Detach it before releasing the replaced street resources.
      if (repositories.length) previous.hall.removeFromParent();
      this.disposeGroup(previous.group);
      previous.group.removeFromParent();
      this.ownerGround.delete(key);
    }
    if (!repositories.length) {
      cityWork('highways:' + owner, () => this.rebuildHighways());
      cityWork('landscape:' + owner, () => this.clearCityTrees());
      return;
    }
    const origin = repositories[0].landPlan!.city,
      plan =
        prepared?.repositories.length === repositories.length &&
        prepared.repositories.every((repo, i) => repo === repositories[i])
          ? prepared.plan
          : ownerPlan(repositories, this.addresses, origin),
      group =
        prepared?.plan === plan && prepared.streets
          ? prepared.streets
          : cityWork('street-geometry:' + owner, () => plannedStreets(plan)),
      hall = previous?.hall || civicHall();
    if (!previous)
      canvas.dataset.ownerHallBuilds = String(Number(canvas.dataset.ownerHallBuilds || 0) + 1);
    canvas.dataset.ownerHallId = hall.uuid;
    group.position.set(origin.x, 0, origin.z);
    group.name = `owner-streets:${key}`;
    hall.position.set(plan.civic.x, 0, plan.civic.z);
    hall.name = 'owner-city-hall';
    group.add(hall);
    hall.visible = !(this.activePlan && this.active?.split('/')[0].toLowerCase() === key);
    hall.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.userData.city = repositories[0].id;
        this.pickables.push(o);
      }
    });
    this.world.add(group);
    this.ownerGround.set(key, { group, hall, plan, origin });
    let restoreTraffic: (() => void) | undefined;
    if (this.activePlan && this.data?.id.split('/')[0].toLowerCase() === key) {
      const merged = plan.regions.length
        ? rebasePlan(plan, origin.x - this.district.position.x, origin.z - this.district.position.z)
        : ownerPlan(repositories, this.addresses, this.district.position);
      this.activePlan = { ...merged, parcels: this.activePlan.parcels };
      this.neighborBlockers = [];
      this.neighborRegions = [];
      for (const repo of repositories.filter((r) => r.id !== this.active)) {
        const neighbor =
          prepared?.layouts?.get(repo) || plannedLayout(repo, this.addresses.get(repo.id));
        const anchor = repo.coordinates || repo.landPlan!.anchor;
        this.neighborRegions.push({
          id: repo.id,
          polygons: neighbor.blocks.map((block) =>
            block.polygon.map((p: { x: number; z: number }) => ({
              x: p.x + anchor.x,
              z: p.z + anchor.z,
            })),
          ),
        });
        for (const p of neighbor.parcels) {
          const b = building(p.file),
            c = Math.abs(Math.cos(p.rotation)),
            s = Math.abs(Math.sin(p.rotation));
          const w = (c * b.width + s * b.depth) / 2 + 0.15,
            d = (s * b.width + c * b.depth) / 2 + 0.15;
          this.neighborBlockers.push(
            new T.Box3(
              new T.Vector3(anchor.x + p.x - w, -1, anchor.z + p.z - d),
              new T.Vector3(anchor.x + p.x + w, 100, anchor.z + p.z + d),
            ),
          );
        }
      }
      if (this.streetLife)
        restoreTraffic = cityWork('street-life:' + owner, () =>
          this.refreshStreetLife(this.data!, false),
        );
    }
    cityWork('highways:' + owner, () => this.rebuildHighways());
    restoreTraffic?.();
    this.renderer.domElement.dataset.ownerStreetGroups = String(this.ownerGround.size);
    this.renderer.domElement.dataset.ownerNeighborhoods = String(repositories.length);
    cityWork('landscape:' + owner, () => this.clearCityTrees());
  }
  rebuildHighways() {
    const oldRoads = new Set<T.Object3D>();
    this.highways.traverse((o) => oldRoads.add(o));
    this.pickables = this.pickables.filter((o) => !oldRoads.has(o));
    this.disposeGroup(this.highways);
    this.highways.clear();
    this.highwayGraph = null;
    this.renderer.domElement.dataset.dependencyRoutes = '0';
    this.renderer.domElement.dataset.dependencyTerminals = '0';
    const sources = new Map([...this.previews].filter(([id]) => this.exploredRoadSources.has(id)));
    if (this.data && this.active === this.data.id) {
      this.exploredRoadSources.add(this.data.id);
      sources.set(this.data.id, this.data);
    }
    const connections = [...sources.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .flatMap((repo) =>
        repo.dependencies
          .filter((dep) => dep.repo && this.cities.has(dep.repo))
          .slice(0, 4)
          .map((dep) => ({ from: repo.id, repo: dep.repo! })),
      );
    this.highwayDestinations = new Set(connections.flatMap((dep) => [dep.from, dep.repo]));
    const roadSamples: T.Vector3[][] = [];
    let terminals = 0;
    const dependencies: string[] = [];
    const entrances: { owner: string; x: number; z: number; exit: { x: number; z: number } }[] = [];
    type HighwaySite = {
      id: string;
      nodes: { x: number; z: number }[] | null;
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
    const byCity = new Map<string, HighwaySite>();
    const ownerSites = new Map<string, HighwaySite>();
    for (const { city: c } of this.cities.values()) {
      const ground = this.ownerGround.get(c.id.split('/')[0].toLowerCase());
      if (ground) {
        const owner = c.id.split('/')[0].toLowerCase();
        let site = ownerSites.get(owner);
        if (!site) {
          const { plan, origin } = ground;
          site = {
            id: `owner:${owner}`,
            nodes: plan.graph.nodes.map((n) => ({ x: n.x + origin.x, z: n.z + origin.z })),
            minX: origin.x + plan.bounds.minX - 2,
            maxX: origin.x + plan.bounds.maxX + 2,
            minZ: origin.z + plan.bounds.minZ - 2,
            maxZ: origin.z + plan.bounds.maxZ + 2,
          };
          ownerSites.set(owner, site);
        }
        byCity.set(c.id, site);
      } else {
        const half = (c.footprint || 14) * 0.85;
        byCity.set(c.id, {
          id: c.id,
          nodes: null,
          minX: c.x - half - 2,
          maxX: c.x + half + 2,
          minZ: c.z - half - 3,
          maxZ: c.z + half + 8,
        });
      }
    }
    const sites = [...new Map([...byCity.values()].map((site) => [site.id, site])).values()];
    for (const dep of connections) {
      const here = byCity.get(dep.from),
        there = byCity.get(dep.repo);
      if (!here || !there) continue;
      const city = this.cities.get(dep.from)!.city,
        other = this.cities.get(dep.repo)!.city;
      if (here.id === there.id) continue;
      const source = streetGateway(here, other, here.nodes, HIGHWAY.gatewayClearance),
        destination = streetGateway(there, city, there.nodes, HIGHWAY.gatewayClearance);
      // Never force an approach through a neighboring district. Unloaded cities
      // retain their exterior gateway until their street graph is available.
      if (
        [
          { terminal: source, site: here },
          { terminal: destination, site: there },
        ].some(
          ({ terminal, site }) =>
            terminal.entrance &&
            sites.some(
              (obstacle) =>
                obstacle.id !== site.id &&
                segmentHitsSite(
                  terminal.entrance,
                  terminal.exit,
                  obstacle,
                  HIGHWAY.halfWidth + HIGHWAY.shoulder,
                ),
            ),
        )
      )
        continue;
      const route = planConnection(
        source.exit,
        destination.exit,
        sites,
        roadSamples,
        HIGHWAY.planningClearance,
      );
      if (!route) continue;
      if (source.entrance) {
        route.unshift(source.entrance);
        entrances.push({ ...source.entrance, exit: source.exit, owner: here.id });
      }
      if (destination.entrance) {
        route.push(destination.entrance);
        entrances.push({ ...destination.entrance, exit: destination.exit, owner: there.id });
      }
      const points = route.map((p) => new T.Vector3(p.x, 0, p.z));
      dependencies.push(`${dep.from}>${dep.repo}`);
      roadSamples.push(points);
      terminals += Number(Boolean(source.entrance)) + Number(Boolean(destination.entrance));
    }
    const corridors = sharedCorridors(
      roadSamples.map((points, i) => ({ points, dependency: dependencies[i] })),
    );
    for (const [owner, { group, origin }] of this.ownerGround) {
      applyStreetOpenings(
        group,
        entrances
          .filter((p) => p.owner === `owner:${owner}`)
          .map((p) => ({
            minX: Math.min(p.x, p.exit.x) - origin.x - HIGHWAY.halfWidth,
            maxX: Math.max(p.x, p.exit.x) - origin.x + HIGHWAY.halfWidth,
            minZ: Math.min(p.z, p.exit.z) - origin.z - HIGHWAY.halfWidth,
            maxZ: Math.max(p.z, p.exit.z) - origin.z + HIGHWAY.halfWidth,
          })),
      );
    }
    this.highwayGraph = worldStreetGraph(
      [...this.ownerGround.values()].map(({ plan, origin }) => ({ graph: plan.graph, origin })),
      corridors,
    );
    this.highways.add(highwaySurfaces(corridors));
    for (const corridor of corridors) {
      const road = boulevard(
        corridor.points.map((p: { x: number; z: number }) => new T.Vector3(p.x, 0, p.z)),
        HIGHWAY.halfWidth * 2,
      );
      road.group.traverse((object) => {
        // Invisible materials keep per-route picking without submitting
        // overlapping pavement over the joined highway surfaces.
        if (object instanceof T.Mesh) (object.material as T.Material).visible = false;
        object.userData.dependencies = [
          ...new Set(corridor.dependencies.flatMap((link: string) => link.split('>'))),
        ];
        object.userData.city = corridor.dependencies[0].split('>')[1];
      });
      this.pickables.push(road.group);
      this.highways.add(road.group);
    }
    this.renderer.domElement.dataset.sharedCorridors = String(
      corridors.filter((c) => c.dependencies.length > 1).length,
    );
    this.landscape.setRoads(roadSamples);
    if (process.env.NODE_ENV !== 'production') {
      // Read-only, on-demand browser-test projection. No per-frame allocation
      // and no engine/camera mutation through the diagnostic hook.
      Object.defineProperty(this.renderer.domElement, 'projectHighwayPoints', {
        configurable: true,
        value: () => {
          const rect = this.renderer.domElement.getBoundingClientRect();
          const points: { x: number; y: number }[] = [];
          for (const road of roadSamples)
            for (let i = 1; i < road.length; i++)
              for (let step = 1; step < 32; step++) {
                const point = road[i - 1].clone().lerp(road[i], step / 32);
                point.y = 0.11;
                point.project(this.camera);
                if (Math.abs(point.x) > 0.94 || Math.abs(point.y) > 0.94 || Math.abs(point.z) > 1)
                  continue;
                points.push({
                  x: rect.left + ((point.x + 1) * rect.width) / 2,
                  y: rect.top + ((1 - point.y) * rect.height) / 2,
                });
              }
          return points;
        },
      });
    }
    this.renderer.domElement.dataset.dependencyRoutes = String(roadSamples.length);
    this.renderer.domElement.dataset.dependencyTerminals = String(terminals);
    this.refreshHighwayTraffic();
    if (this.highwayDestination) {
      this.walkPath = this.dependencyWalk(this.highwayDestination);
      if (!this.walkPath.length) this.highwayDestination = null;
    }
  }
  refreshHighwayTraffic() {
    if (!this.streetLife || !this.activePlan || !this.highwayGraph) return;
    const origin = this.district.position;
    const first = this.activePlan.graph.nodes[0];
    if (!first) return;
    const connected = connectedWorldGraph(this.highwayGraph, {
      x: first.x + origin.x,
      z: first.z + origin.z,
    });
    const connectedNodes = new Set(connected.nodes.map((node) => node.id));
    const destinations = [...this.ownerGround.values()]
      .filter(({ plan, origin: city }) => {
        const node = plan.graph.nodes[0];
        return (
          node &&
          connectedNodes.has(`${(node.x + city.x).toFixed(6)},${(node.z + city.z).toFixed(6)}`)
        );
      })
      .flatMap(({ plan, origin: city }) =>
        plan.destinations.map((destination) => ({
          ...destination,
          point: {
            x: destination.point.x + city.x - origin.x,
            z: destination.point.z + city.z - origin.z,
          },
        })),
      );
    this.streetLife.setVehicleNetwork(
      {
        nodes: connected.nodes.map((node) => ({
          ...node,
          x: node.x - origin.x,
          z: node.z - origin.z,
        })),
        edges: connected.edges,
      },
      destinations,
    );
  }
  survey(id: string) {
    if (this.active !== id) this.requestedDirectories.clear();
    let c = this.cities.get(id)?.city;
    if (!c) {
      c = { id, name: id.split('/')[1], language: null, color: '#becf9d', ...coordinates(id) };
      this.addCity(c);
    }
    if (this.pendingStreetView?.id === id) {
      this.active = id;
      return c;
    }
    this.pendingStreetView = null;
    if (this.highwayDestination) this.stopHighwayWalk();
    this.active = id;
    this.walking = false;
    this.fly(new T.Vector3(c.x + 27, 27, c.z + 34), new T.Vector3(c.x, 0, c.z));
    return c;
  }
  clearDistrict() {
    if (this.streetLife && this.data) {
      const owner = this.data.id.split('/')[0].toLowerCase();
      this.journeyCache.delete(owner);
      this.journeyCache.set(owner, {
        origin: { x: this.district.position.x, z: this.district.position.z },
        state: this.streetLife.journeyState(),
      });
      if (this.journeyCache.size > 8)
        this.journeyCache.delete(this.journeyCache.keys().next().value!);
    }
    this.activePlan = null;
    this.neighborBlockers = [];
    this.neighborRegions = [];
    for (const { hall } of this.ownerGround.values()) hall.visible = true;
    this.residentLabels.forEach((label) => label.element.remove());
    this.residentLabels = [];
    this.pickables = this.pickables.filter((m) => m.userData.city);
    this.filePositions.clear();
    this.fileGroups.clear();
    this.blockBatches = null;
    this.interior = null;
    this.inside = null;
    this.animations.forEach((animation) => {
      animation.object.scale.y = 1;
    });
    this.animations = [];
    this.cranes = [];
    this.cars = [];
    this.windowMaterials = [];
    this.bodyMaterials = [];
    this.rain = null;
    this.streetLife?.dispose();
    this.streetLife = null;
    this.trackedIssue = null;
    this.issueRouteRequested = false;
    this.disposeGroup(this.district);
    this.district.clear();
    for (const { group } of this.cities.values()) group.visible = true;
  }
  enter(data: Repo, file?: string, preserveCamera = false) {
    this.viewMode = 'repo';
    const arrival = this.pendingStreetView?.id === data.id ? this.pendingStreetView : null;
    this.pendingStreetView = null;
    if (arrival) preserveCamera = true;
    if (this.data && this.data.id !== data.id) this.preview(this.data);
    const savedPosition = arrival?.position || this.camera.position.clone(),
      savedTarget = arrival?.target || this.controls.target.clone(),
      savedGoal = !arrival && this.active === data.id ? this.goal : null,
      wasWalking = Boolean(arrival) || this.walking;
    if (this.active !== data.id) this.requestedDirectories.clear();
    if (this.active !== data.id && !arrival) this.cancelJob();
    this.clearDistrict();
    this.data = data;
    this.active = data.id;
    const located = this.cities.get(data.id);
    if (located && data.coordinates) {
      located.city.x = data.coordinates.x;
      located.city.z = data.coordinates.z;
      located.group.position.set(located.city.x, 0, located.city.z);
    }
    const city = this.cities.get(data.id)?.city || this.survey(data.id);
    this.cities.get(data.id)!.group.visible = false;
    this.district.position.set(city.x, 0, city.z);
    this.clearCityTrees();
    const files = data.files;
    let addresses = this.addresses.get(data.id);
    if (!addresses) {
      addresses = new Map();
      this.addresses.set(data.id, addresses);
    }
    const plan = data.landPlan ? plannedLayout(data, addresses) : null;
    const layout = plan || parcels(data, addresses);
    this.activePlan = plan;
    this.clearCityTrees();
    const dirs = layout.dirs;
    const side = layout.side;
    this.neighborhoodSide = side;
    this.blockers = [];
    this.surveyBlockers.clear();
    const spacing = 24;
    const total = layout.total;
    const scale = plan ? 1 : ((city.footprint || 14) * 1.7) / total;
    this.activeScale = scale;
    this.district.scale.setScalar(scale);
    // Terrain, streets and foundations now meet at one ground datum.
    if (!plan) this.district.add(streetscape(total, side), publicRealm(total, data.id));
    const ordered = [...files].sort(
      (a, b) =>
        (a.lastCommit || '').localeCompare(b.lastCommit || '') || a.path.localeCompare(b.path),
    );
    const constructionOrder = new Map(
      ordered
        .filter((file) => !this.constructed.has(data.id + ':' + file.path))
        .map((file, index) => [file.path, index]),
    );
    const coldBlocks = new Set<number>();
    let initialDetailedFiles = 0;
    if (plan && preserveCamera) {
      const freshBlocks = new Set(
        plan.parcels
          .filter((p) => constructionOrder.has(p.file.path) || p.file.path === file)
          .map((p) => p.block),
      );
      const heights = new Map<number, number>();
      for (const parcel of plan.parcels)
        heights.set(
          parcel.block,
          Math.max(heights.get(parcel.block) || 0, building(parcel.file).height + 1),
        );
      for (const block of plan.blocks) {
        if (freshBlocks.has(block.block)) continue;
        const bounds = new T.Box3(
          new T.Vector3(
            city.x + Math.min(...block.polygon.map((p) => p.x)),
            0,
            city.z + Math.min(...block.polygon.map((p) => p.z)),
          ),
          new T.Vector3(
            city.x + Math.max(...block.polygon.map((p) => p.x)),
            heights.get(block.block) || 1,
            city.z + Math.max(...block.polygon.map((p) => p.z)),
          ),
        );
        if (bounds.distanceToPoint(savedPosition) > 100) coldBlocks.add(block.block);
      }
    }
    dirs.forEach((dir, di) => {
      const dx = plan ? 0 : ((di % side) - (side - 1) / 2) * spacing,
        dz = plan ? 0 : (Math.floor(di / side) - (side - 1) / 2) * spacing;
      const local = files
        .filter((f) => (f.path.includes('/') ? f.path.split('/')[0] : '.') === dir)
        .sort((a, b) => a.path.localeCompare(b.path));
      const block = new T.Group();
      block.position.set(dx, 0, dz);
      this.district.add(block);
      const fine = new T.Group();
      block.add(fine);
      const count = data.directories?.find((d) => d.name === dir)?.count || local.length;
      block.userData = { fine, directory: dir, count, loaded: local.length };
      const plots = layout.parcels.filter((p) => p.directory === dir);
      plots.forEach((plot) => {
        const { file: f, x: px, z: pz, scale } = plot;
        const rotation = 'rotation' in plot ? Number(plot.rotation) : 0;
        const b = building(f),
          x = px - dx,
          z = pz - dz;
        const g = new T.Group();
        g.position.set(x, 0, z);

        g.userData.file = f;
        fine.add(g);
        this.fileGroups.set(f.path, g);
        if ('block' in plot && coldBlocks.has(Number(plot.block))) {
          const style = architectureStyle(f);
          g.userData.buildingRecipe = {
            file: f,
            scale,
            rotation,
            body: style.body,
            glass: style.glass,
            roof: style.materials[4],
          };
          this.bodyMaterials.push(style.body);
          this.windowMaterials.push(style.glass);
          style.materials
            .filter(
              (material) =>
                material !== style.body &&
                material !== style.glass &&
                material !== style.materials[4],
            )
            .forEach((material) => material.dispose());
        } else {
          const kit = architecture(f, scale);
          initialDetailedFiles++;
          kit.group.rotation.y = rotation;
          g.userData.buildingRecipe = {
            file: f,
            scale,
            rotation,
            body: kit.body,
            glass: kit.glass,
            roof: kit.roof,
          };
          g.add(kit.group);
          this.pickables.push(...kit.group.children);
          this.bodyMaterials.push(kit.body);
          this.windowMaterials.push(kit.glass);
        }
        const worldPos = new T.Vector3(
          city.x + (dx + x) * this.activeScale,
          0,
          city.z + (dz + z) * this.activeScale,
        );
        this.filePositions.set(f.path, worldPos);
        this.blockers.push(
          new T.Box3(
            new T.Vector3(
              worldPos.x -
                (((Math.abs(Math.cos(rotation)) * b.width +
                  Math.abs(Math.sin(rotation)) * b.depth) *
                  scale) /
                  2 +
                  0.15) *
                  this.activeScale,
              -1,
              worldPos.z -
                (((Math.abs(Math.sin(rotation)) * b.width +
                  Math.abs(Math.cos(rotation)) * b.depth) *
                  scale) /
                  2 +
                  0.15) *
                  this.activeScale,
            ),
            new T.Vector3(
              worldPos.x +
                (((Math.abs(Math.cos(rotation)) * b.width +
                  Math.abs(Math.sin(rotation)) * b.depth) *
                  scale) /
                  2 +
                  0.15) *
                  this.activeScale,
              100,
              worldPos.z +
                (((Math.abs(Math.sin(rotation)) * b.width +
                  Math.abs(Math.cos(rotation)) * b.depth) *
                  scale) /
                  2 +
                  0.15) *
                  this.activeScale,
            ),
          ),
        );
        const resident = data.residents?.find((resident) => resident.path === f.path);
        if (resident) {
          const label = document.createElement('button');
          label.className = 'building-name';
          label.textContent = `@${resident.login}`;
          label.title = `Accepted contribution · PR #${resident.pr}`;
          label.onclick = () => this.onFile(f);
          this.labels.append(label);
          this.residentLabels.push({
            element: label,
            position: worldPos.clone().add(new T.Vector3(0, (b.height + 1) * this.activeScale, 0)),
          });
        }
        const fresh = !this.constructed.has(data.id + ':' + f.path);
        this.constructed.add(data.id + ':' + f.path);
        g.scale.y = !fresh || this.reduceMotion ? 1 : 0.001;
        if (fresh)
          this.animations.push({
            object: g,
            start: this.clock.elapsedTime + 0.3 + (constructionOrder.get(f.path) || 0) * 0.055,
            duration: 0.85,
          });
      });
    });
    if (plan) {
      const groups = new Map<string, T.Group[]>();
      for (const parcel of plan.parcels) {
        const key = String(parcel.block),
          object = this.fileGroups.get(parcel.file.path);
        if (!object) continue;
        const block = groups.get(key) || [];
        block.push(object);
        groups.set(key, block);
      }
      const remove = (group: T.Group, keep = new Set<T.Material>()) => {
        const objects = new Set<T.Object3D>();
        group.traverse((object) => {
          objects.add(object);
          if (object instanceof T.Mesh) {
            object.geometry.dispose();
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material])
              if (!keep.has(material)) material.dispose();
          }
        });
        this.pickables = this.pickables.filter((object) => !objects.has(object));
        group.clear();
        group.removeFromParent();
      };
      this.blockBatches = new BlockBatches(
        this.district,
        groups,
        (batch) => this.pickables.push(...batch.children),
        {
          unload: (objects, batch) => {
            const proxy = unloadBuildingBlock(objects, remove);
            if (batch) remove(batch);
            return proxy;
          },
          reload: (objects) => reloadBuildingBlock(objects, (mesh) => this.pickables.push(mesh)),
          remove,
        },
      );
    }
    this.renderer.domElement.dataset.initialDetailedFiles = String(initialDetailedFiles);
    this.renderer.domElement.dataset.surveyPlots = String(
      plan?.regions.reduce((n, r) => n + r.unresolved.length, 0) || 0,
    );
    if (plan) {
      const massing = directoryMassing(plan.regions);
      this.district.add(massing);
      massing.traverse((object) => {
        if (object instanceof T.Mesh) this.pickables.push(object);
      });
      for (const region of plan.regions)
        for (const slot of region.unresolved) {
          const lot = region.lots[slot];
          const box = new T.Box3(
            new T.Vector3(lot.x - lot.width * 0.44, 0, lot.z - lot.depth * 0.44)
              .multiplyScalar(scale)
              .add(this.district.position),
            new T.Vector3(lot.x + lot.width * 0.44, 1.95, lot.z + lot.depth * 0.44)
              .multiplyScalar(scale)
              .add(this.district.position),
          );
          for (let x = Math.floor(box.min.x / 16); x <= Math.floor(box.max.x / 16); x++)
            for (let z = Math.floor(box.min.z / 16); z <= Math.floor(box.max.z / 16); z++) {
              const key = `${x}:${z}`;
              const bucket = this.surveyBlockers.get(key) || [];
              bucket.push(box);
              this.surveyBlockers.set(key, bucket);
            }
        }
    }
    // Civic architecture is outside code-derived districts.
    const hall = civicHall();
    const civic = plan?.civic || { x: 0, z: total / 2 + 8 };
    hall.position.set(civic.x, 0, civic.z);
    hall.traverse((object) => {
      if (object instanceof T.Mesh) {
        object.userData.hall = true;
        this.pickables.push(object);
      }
    });
    this.district.add(hall);
    const hallOrigin = this.district.position,
      hs = this.activeScale;
    this.blockers.push(
      new T.Box3(
        new T.Vector3(civic.x - 4.12, 0, civic.z - 2.3).multiplyScalar(hs).add(hallOrigin),
        new T.Vector3(civic.x + 4.12, 3.3, civic.z + 2.3).multiplyScalar(hs).add(hallOrigin),
      ),
    );
    this.civicGroup = new T.Group();
    this.civicGroup.position.set(civic.x + 7, 0, civic.z);
    this.district.add(this.civicGroup);
    this.applyPresentation([], data.civic || []);
    if (data.openPRs)
      for (let i = 0; i < Math.min(data.openPRs, 3, plan ? plan.blocks.length : 3); i++) {
        const site = plan?.blocks[i];
        const height = site
          ? Math.max(
              6,
              ...plan!.parcels
                .filter((p) => p.block === site.block)
                .map((p) => building(p.file).height + 2),
            )
          : 13;
        const { group: crane, arm, groundFootprint } = towerCrane(height);
        crane.position.set(
          site ? site.center.x + 1.8 : (i - 1) * 14,
          0,
          site ? site.center.z + 2.4 : -total / 2 - 3,
        );
        const craneCenter = crane.position
          .clone()
          .multiplyScalar(this.activeScale)
          .add(this.district.position);
        this.blockers.push(
          new T.Box3().setFromCenterAndSize(
            craneCenter,
            new T.Vector3(groundFootprint + 0.3, 3, groundFootprint + 0.3).multiplyScalar(
              this.activeScale,
            ),
          ),
        );
        this.cranes.push(arm);
        this.district.add(crane);
      }
    this.scene.fog = new T.FogExp2(
      data.ci === 'failure' || data.ci === 'error' ? '#38434d' : '#b7c5ca',
      data.ci === 'failure' ? 0.006 : 0.0012,
    );
    this.lastLighting = -10;
    const extent = Math.max(15, total * scale * 0.7);
    Object.assign(this.sun.shadow.camera, {
      left: -extent,
      right: extent,
      top: extent,
      bottom: -extent,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.updateWeather(data);
    if (plan) this.rebuildOwner(data.id.split('/')[0]);
    else this.rebuildHighways();
    this.refreshStreetLife(data);
    if (this.job) this.showWaypoint();
    if (preserveCamera) {
      this.camera.position.copy(savedPosition);
      this.controls.target.copy(savedTarget);
      this.goal = savedGoal;
      this.walking = wasWalking;
    } else if (file) this.enterFile(file);
    else {
      const arrival = plan ? repoArrival(plan) : { center: { x: 0, z: 0 }, span: total };
      this.fly(
        new T.Vector3(
          city.x + arrival.center.x + arrival.span * 0.6 * scale,
          Math.max(10, arrival.span * 0.65 * scale),
          city.z + arrival.center.z + arrival.span * 0.8 * scale,
        ),
        new T.Vector3(city.x + arrival.center.x, 0, city.z + arrival.center.z),
      );
    }
  }
  refreshRecognition(data: Repo) {
    if (!this.data || this.active !== data.id) return;
    this.data.residents = data.residents;
    this.residentLabels.forEach((label) => label.element.remove());
    this.residentLabels = [];
    for (const resident of data.residents || []) {
      const position = this.filePositions.get(resident.path);
      const file = this.data.files.find((f) => f.path === resident.path);
      if (!position || !file) continue;
      const label = document.createElement('button');
      label.className = 'building-name';
      label.textContent = `@${resident.login}`;
      label.title = `Accepted contribution · PR #${resident.pr}`;
      label.onclick = () => this.onFile(file);
      this.labels.append(label);
      this.residentLabels.push({
        element: label,
        position: position
          .clone()
          .add(new T.Vector3(0, (building(file).height + 1) * this.activeScale, 0)),
      });
    }
  }
  applyPresentation(items: string[], civic: { login: string; item: string }[] = []) {
    for (const material of this.windowMaterials) {
      material.color.copy(material.userData.originalColor);
      material.emissive.copy(material.userData.originalEmissive);
      if (items.includes('amber')) {
        material.color.set('#f0c170');
        material.emissive.set('#e6ae57');
        material.emissiveIntensity = 0.8;
      }
    }
    for (const material of this.bodyMaterials) {
      material.color.copy(material.userData.originalColor);
      if (items.includes('sage')) material.color.lerp(new T.Color('#a8bc98'), 0.45);
    }
    this.disposeGroup(this.civicGroup);
    this.civicGroup.clear();
    civic
      .filter((c) => c.item === 'pavilion')
      .slice(0, 24)
      .sort((a, b) => a.login.localeCompare(b.login))
      .forEach((owner, i) => {
        const g = new T.Group();
        g.position.x = i * 8;
        this.box(g, 6, 0.4, 5, 0, 0.2, 0, '#b6ba9e');
        for (const x of [-2, 2])
          for (const z of [-1.5, 1.5]) this.box(g, 0.3, 3, 0.3, x, 1.8, z, '#adc495');
        this.box(g, 6.5, 0.35, 5.5, 0, 3.4, 0, '#718c71');
        g.userData.owner = owner.login;
        this.civicGroup.add(g);
      });
  }
  updateWeather(data: Repo) {
    if (this.rain) {
      this.district.remove(this.rain);
      this.rain.geometry.dispose();
      (this.rain.material as T.Material).dispose();
      this.rain = null;
    }
    if (data.ci === 'failure' || data.ci === 'error') {
      const r = random(data.id + 'rain'),
        positions = new Float32Array(1500);
      for (let i = 0; i < 500; i++) {
        positions[i * 3] = (r() - 0.5) * 110;
        positions[i * 3 + 1] = r() * 35;
        positions[i * 3 + 2] = (r() - 0.5) * 110;
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
      this.rain = new T.Points(
        geometry,
        new T.PointsMaterial({ color: '#bbcbd8', size: 0.08, transparent: true, opacity: 0.55 }),
      );
      this.district.add(this.rain);
    }
  }
  enterFile(path: string) {
    this.exitInterior();
    const p = this.filePositions.get(path);
    if (!p) return false;
    const group = this.fileGroups.get(path);
    if (group) {
      group.visible = false;
      this.inside = group;
      const shell = new T.Group();
      const f = this.data?.files.find((f) => f.path === path);
      const b = building(f || { path });
      const roomHeight = Math.max(2, b.height);
      this.box(shell, 2.4, 0.12, 2.4, 0, -0.05, 0, '#647263');
      this.box(shell, 2.4, roomHeight, 0.1, 0, roomHeight / 2, -1.2, '#43594f');
      this.box(shell, 0.1, roomHeight, 2.4, -1.2, roomHeight / 2, 0, '#43594f');
      this.box(shell, 0.1, roomHeight, 2.4, 1.2, roomHeight / 2, 0, '#43594f');
      this.box(shell, 1.5, 0.8, 0.15, 0, 1.3, -1.1, '#c2d6a4', true);
      this.box(shell, 1.1, 0.65, 0.45, 0, 0.325, -0.7, '#95a68a');
      shell.position.copy(group.position);
      group.parent?.add(shell);
      this.interior = shell;
    }
    this.walking = true;
    this.controls.minDistance = 0.15;
    this.fly(
      p.clone().add(new T.Vector3(0, 1.1 * this.activeScale, 0.2 * this.activeScale)),
      p.clone().add(new T.Vector3(0, 1.1 * this.activeScale, -2 * this.activeScale)),
    );
    return true;
  }
  exitInterior() {
    if (this.inside) this.inside.visible = true;
    this.inside = null;
    if (this.interior) {
      this.disposeGroup(this.interior);
      this.interior.removeFromParent();
      this.interior = null;
    }
  }
  street() {
    this.exitInterior();
    if (!this.active) return;
    const city = this.cities.get(this.active)!.city;
    this.walking = true;
    this.controls.minDistance = 0.15;
    if (this.activePlan?.parcels.length) {
      const arrival = streetArrival(this.activePlan)!;
      const p = new T.Vector3(arrival.x, 0.58, arrival.z).add(this.district.position);
      const target = new T.Vector3(arrival.target.x, 0.58, arrival.target.z).add(
        this.district.position,
      );
      this.fly(p, target);
      return;
    }
    // Arrive on the sidewalk looking along the boulevard, clear of the central lamp.
    this.fly(
      new T.Vector3(
        city.x - 4 * this.activeScale,
        0.58 * this.activeScale,
        city.z + (this.neighborhoodSide * 12 - 1.8) * this.activeScale,
      ),
      new T.Vector3(
        city.x + 8 * this.activeScale,
        0.58 * this.activeScale,
        city.z + (this.neighborhoodSide * 12 + 1.2) * this.activeScale,
      ),
    );
  }
  walkToNeighborhood(id: string) {
    const repo = this.previews.get(id);
    if (!repo?.landPlan || !this.activePlan || id === this.active) return;
    this.cancelJob();
    if (!this.walking) this.street();
    const plan = plannedLayout(repo, this.addresses.get(id)),
      front = plan.parcels[0]?.front;
    if (!front) return;
    const anchor = repo.coordinates || repo.landPlan.anchor;
    const destination = new T.Vector3(front.x + anchor.x, 0, front.z + anchor.z);
    this.walkingDestination = id;
    this.walkPath = graphRoute(
      this.goal?.position || this.camera.position,
      destination,
      this.district.position,
      this.activePlan.graph,
    );
    if (!this.walkPath.length)
      this.onNavigationNotice?.(
        'No connected walking route is available yet. Explore nearby streets or choose another destination.',
      );
  }
  dependencyWalk(id: string) {
    const repo = this.previews.get(id);
    if (
      !repo?.landPlan ||
      !this.activePlan ||
      !this.highwayGraph ||
      id === this.active ||
      !this.highwayDestinations.has(id)
    )
      return [];
    const plan = plannedLayout(repo, this.addresses.get(id)),
      lot = plan.parcels[0];
    if (!lot) return [];
    const origin = repo.coordinates || repo.landPlan.anchor;
    const outward = new T.Vector3(Math.sin(lot.rotation), 0, Math.cos(lot.rotation));
    const along = new T.Vector3(Math.cos(lot.rotation), 0, -Math.sin(lot.rotation));
    const finish = new T.Vector3(lot.front.x + origin.x, 0, lot.front.z + origin.z).addScaledVector(
      outward,
      0.55,
    );
    const path = graphRoute(
      this.goal?.position || this.camera.position,
      finish.clone().addScaledVector(along, -1.2),
      new T.Vector3(),
      this.highwayGraph,
    );
    if (path.length) path.push(finish);
    return path;
  }
  stopWalkingRoute() {
    this.walkingDestination = null;
    this.issueRouteRequested = false;
    this.stopHighwayWalk();
    this.onWalkingTravel?.(null);
    this.lastWalkingTravel = '';
  }
  stopHighwayWalk() {
    this.highwayDestination = null;
    this.walkPath = [];
    this.onHighwayTravel?.(null);
    this.lastHighwayTravel = '';
  }
  walkToDependency(id: string) {
    if (!this.dependencyWalk(id).length) return false;
    this.cancelJob();
    if (!this.walking) this.street();
    this.walkPath = this.dependencyWalk(id);
    this.highwayDestination = this.walkPath.length ? id : null;
    return Boolean(this.highwayDestination);
  }
  subscribeOperations(onMission: WorldEngine['onMission'], onComplete: WorldEngine['onComplete']) {
    this.onMission = onMission;
    this.onComplete = onComplete;
    return () => {
      this.onMission = null;
      this.onComplete = null;
      if (this.job) this.cancelJob();
    };
  }
  servicePoint(path: string): T.Vector3 {
    if (this.activePlan) {
      const destination = this.activePlan.destinations.find((d) => d.id === path);
      if (destination) {
        // Stop on the sidewalk, not directly against the facade. Project the
        // entrance onto its street to obtain the outward approach direction.
        const network = this.streetLife?.visitorJourneys?.network;
        const road = network?.project(destination.point)?.point;
        const point = new T.Vector3(destination.point.x, 0, destination.point.z);
        if (road)
          point.add(
            new T.Vector3(road.x - point.x, 0, road.z - point.z).normalize().multiplyScalar(0.7),
          );
        return point.add(this.district.position);
      }
      const lot = this.activePlan.parcels.find((p) => p.file.path === path);
      const p = lot
        ? {
            x: lot.front.x + Math.sin(lot.rotation) * 0.7,
            z: lot.front.z + Math.cos(lot.rotation) * 0.7,
          }
        : { x: this.activePlan.civic.x, z: this.activePlan.civic.z - 5 };
      return new T.Vector3(p.x, 0, p.z).add(this.district.position);
    }
    if (path === '@depot')
      return this.district.position
        .clone()
        .add(new T.Vector3(0, 0, (this.neighborhoodSide * 12 + 3) * this.activeScale));
    const p = this.filePositions.get(path);
    if (!p) return this.servicePoint('@depot');
    const local = p.clone().sub(this.district.position).divideScalar(this.activeScale);
    const min = -this.neighborhoodSide * 12;
    const snap = (v: number) => Math.round((v - min) / 24) * 24 + min;
    if (Math.abs(local.x - snap(local.x)) < Math.abs(local.z - snap(local.z)))
      local.x = snap(local.x);
    else local.z = snap(local.z);
    return local.multiplyScalar(this.activeScale).add(this.district.position);
  }
  meetTraveler(kind: 'visitor' | 'traffic' = 'visitor', index = 0) {
    const actor = (
      kind === 'visitor' ? this.streetLife?.visitorJourneys : this.streetLife?.vehicleJourneys
    )?.actors[index];
    this.onStreetEncounter?.(
      kind,
      actor
        ? {
            destination: actor.target.kind === 'civic' ? 'City hall' : actor.target.id,
            point: {
              x: actor.target.point.x + this.district.position.x,
              z: actor.target.point.z + this.district.position.z,
            },
            arrived: actor.wait > 0,
          }
        : undefined,
    );
  }
  walkToDestination(point: { x: number; z: number }, label = 'Traveler destination') {
    if (!this.activePlan) return;
    this.cancelJob();
    if (!this.walking) this.street();
    this.walkingDestination = label;
    this.walkPath = graphRoute(
      this.goal?.position || this.camera.position,
      new T.Vector3(point.x, 0, point.z),
      this.highwayGraph ? new T.Vector3() : this.district.position,
      this.highwayGraph || this.activePlan.graph,
    );
    if (!this.walkPath.length)
      this.onNavigationNotice?.(
        'No connected walking route is available yet. Explore nearby streets or choose another destination.',
      );
  }
  subscribeStreetLife(
    onEncounter: WorldEngine['onStreetEncounter'],
    onProximity: WorldEngine['onStreetProximity'],
  ) {
    this.onStreetEncounter = onEncounter;
    this.onStreetProximity = onProximity;
    return () => {
      this.onStreetEncounter = null;
      this.onStreetProximity = null;
    };
  }
  refreshStreetLife(data: Repo, attachHighways = true) {
    if (this.active !== data.id) return;
    this.data = data;
    if (
      this.streetLife &&
      this.streetLife.plan === (this.activePlan || undefined) &&
      JSON.stringify([
        this.streetLife.repo.stars,
        this.streetLife.repo.usage,
        this.streetLife.repo.issues,
      ]) === JSON.stringify([data.stars, data.usage, data.issues])
    )
      return;
    const previousDrivers = this.streetLife?.driverPositions();
    const cached = this.journeyCache.get(data.id.split('/')[0].toLowerCase());
    const previousJourneys = this.streetLife?.journeyState() || cached?.state;
    const shift =
      this.streetLife || !cached
        ? { x: 0, z: 0 }
        : {
            x: cached.origin.x - this.district.position.x,
            z: cached.origin.z - this.district.position.z,
          };
    const elapsed = this.streetLife?.elapsed || 0,
      paused = this.streetLife?.paused || false;
    if (this.streetLife) {
      const objects = new Set<T.Object3D>();
      this.streetLife.group.traverse((o) => objects.add(o));
      this.pickables = this.pickables.filter((o) => !objects.has(o));
      this.streetLife.dispose();
    }
    let addresses = this.issueAddresses.get(data.id);
    if (!addresses) {
      addresses = new Map();
      this.issueAddresses.set(data.id, addresses);
    }
    const closed = this.closedIssues.get(data.id);
    const issues = data.issues.filter(
      (i) => !closed?.has(i.number) || (i.updatedAt && i.updatedAt > closed.get(i.number)!),
    );
    this.streetLife = new StreetLife(
      { ...data, issues },
      this.neighborhoodSide,
      addresses,
      this.activePlan || undefined,
      previousJourneys ? { state: previousJourneys, offset: shift } : undefined,
      !attachHighways,
    );
    if (attachHighways) this.refreshHighwayTraffic();
    this.streetLife.restoreDrivers(previousDrivers);
    // Visitors were restored during construction. Reapply only the original
    // vehicle state after the highway network has been attached.
    if (attachHighways) this.streetLife.vehicleJourneys?.restore(previousJourneys?.vehicles, shift);
    this.streetLife.elapsed = elapsed;
    this.streetLife.paused = paused;
    this.district.add(this.streetLife.group);
    this.pickables.push(this.streetLife.group);
    if (!attachHighways) {
      const life = this.streetLife;
      return () => life.finishVehicleSetup();
    }
  }
  selectIssue(number: number) {
    if (!this.streetLife?.orders.some((o) => o.number === number)) return;
    this.trackedIssue = number;
    this.onStreetEncounter?.(number);
  }
  walkToIssue(number: number) {
    if (!this.streetLife?.orders.some((o) => o.number === number)) return;
    this.cancelJob();
    this.trackedIssue = number;
    if (!this.walking) this.street();
    this.issueRouteRequested = true;
  }
  clearIssueTarget() {
    this.trackedIssue = null;
    this.issueRouteRequested = false;
    this.walkPath = [];
    this.highwayDestination = null;
  }
  surveyIssue(number: number) {
    const order = this.streetLife?.orders.find((o) => o.number === number);
    if (!order) return false;
    const local = this.camera.position
      .clone()
      .sub(this.district.position)
      .divideScalar(this.activeScale);
    return canSurvey(Math.hypot(local.x - order.x, local.z - order.z), this.walking);
  }
  isIssueClosed(repo: string, issue: { number: number; updatedAt?: string }) {
    const confirmed = this.closedIssues.get(repo)?.get(issue.number);
    return Boolean(confirmed && (!issue.updatedAt || issue.updatedAt <= confirmed));
  }
  closeIssue(number: number, updatedAt: string) {
    if (!this.active) return;
    let closed = this.closedIssues.get(this.active);
    if (!closed) {
      closed = new Map();
      this.closedIssues.set(this.active, closed);
    }
    closed.set(number, updatedAt);
    this.streetLife?.closeIssue(number);
    this.pickables = this.pickables.filter((o) => o.userData.orderNumber !== number);
    this.clearIssueTarget();
  }
  toggleStreetLife() {
    if (this.streetLife) this.streetLife.paused = !this.streetLife.paused;
    return this.streetLife?.paused || false;
  }
  startJob(kind: string, round: number) {
    if (!this.data) return;
    this.clearIssueTarget();
    this.cancelJob();
    const destinations = new Set(this.activePlan?.destinations.map((d) => d.id));
    const available = (repo: Repo) => ({
      ...repo,
      files: this.activePlan
        ? repo.files.filter((f) => destinations.has(`${repo.id}/${f.path}`))
        : repo.files,
    });
    this.job = contract(
      available(this.data),
      kind,
      round,
      this.activePlan ? [...this.previews.values()].filter((r) => r.landPlan).map(available) : [],
    );
    if (!this.job) return;
    this.jobIndex = 0;
    this.jobTime = 0;
    this.street();
    this.showWaypoint();
  }
  showWaypoint() {
    this.disposeGroup(this.waypoint);
    this.waypoint.clear();
    if (!this.job) return;
    const ring = new T.Mesh(
      new T.RingGeometry(0.8, 1, 40),
      new T.MeshBasicMaterial({ color: '#ffc878', side: T.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    this.waypoint.add(ring);
    const p = this.servicePoint(this.job.stops[this.jobIndex]);
    this.waypoint.position.copy(p);
    this.waypoint.scale.setScalar(this.activeScale);
    this.scene.add(this.waypoint);
  }
  route(start: T.Vector3, end: T.Vector3, origin: T.Vector3, side: number, scale: number) {
    return this.activePlan
      ? graphRoute(start, end, origin, this.activePlan.graph)
      : streetRoute(start, end, origin, side, scale);
  }
  navigateToStop() {
    if (!this.job) return;
    if (!this.walking) {
      this.street();
      return;
    }
    this.goal = null;
    this.walkPath = this.route(
      this.camera.position,
      this.servicePoint(this.job.stops[this.jobIndex]),
      this.district.position,
      this.neighborhoodSide,
      this.activeScale,
    );
  }
  cancelJob() {
    this.walkingDestination = null;
    this.job = null;
    this.walkPath = [];
    this.highwayDestination = null;
    this.waypoint.removeFromParent();
    this.disposeGroup(this.waypoint);
    this.waypoint.clear();
    this.onMission?.(null);
  }
  interact() {
    if (this.job) {
      const p = this.servicePoint(this.job.stops[this.jobIndex]);
      const distance =
        Math.hypot(this.camera.position.x - p.x, this.camera.position.z - p.z) / this.activeScale;
      if (!canService(distance, this.walking)) return;
      this.jobIndex++;
      this.audio.commit();
      if (this.jobIndex === this.job.stops.length) {
        const job = this.job,
          seconds = this.jobTime;
        this.cancelJob();
        this.onComplete?.(job, seconds);
      } else this.showWaypoint();
      return;
    }
    const local = this.camera.position
      .clone()
      .sub(this.district.position)
      .divideScalar(this.activeScale);
    const nearby = this.streetLife?.orders.find((o) =>
      canSurvey(Math.hypot(o.x - local.x, o.z - local.z), this.walking),
    );
    if (nearby) {
      this.selectIssue(nearby.number);
      return;
    }
    let closest: CodeFile | null = null,
      distance = 3 * this.activeScale;
    for (const file of this.data?.files || []) {
      const p = this.filePositions.get(file.path);
      if (!p) continue;
      const d = Math.hypot(p.x - this.camera.position.x, p.z - this.camera.position.z);
      if (d < distance) {
        closest = file;
        distance = d;
      }
    }
    if (closest) this.onFile(closest);
  }
  blocked(position: T.Vector3) {
    const contains = (box: T.Box3) =>
      position.x > box.min.x &&
      position.x < box.max.x &&
      position.z > box.min.z &&
      position.z < box.max.z;
    return (
      this.blockers.some(contains) ||
      this.neighborBlockers.some(contains) ||
      Boolean(
        this.surveyBlockers
          .get(`${Math.floor(position.x / 16)}:${Math.floor(position.z / 16)}`)
          ?.some(contains),
      )
    );
  }

  inspect(path: string) {
    const position = this.filePositions.get(path);
    if (!position) return;
    this.exitInterior();
    const s = this.activeScale;
    this.fly(
      position.clone().add(new T.Vector3(4 * s, 3 * s, 6 * s)),
      position.clone().add(new T.Vector3(0, 1.5 * s, 0)),
    );
  }
  overview() {
    if (!this.data) return;
    this.exitInterior();
    const p = this.district.position.clone();
    if (this.activePlan)
      p.add(new T.Vector3(this.activePlan.center.x, 0, this.activePlan.center.z));
    const span = (this.activePlan?.total || this.neighborhoodSide * 24) * this.activeScale;
    this.fly(p.clone().add(new T.Vector3(span * 0.75, span, span * 1.2)), p);
  }
  cityHall() {
    const city = this.active && this.cities.get(this.active)?.city;
    if (!city || !this.data) return;
    if (this.activePlan) {
      const c = this.activePlan.civic;
      const p = new T.Vector3(c.x, 0, c.z).add(this.district.position);
      this.fly(
        p.clone().add(new T.Vector3(5.5, 2.8, -11.5)),
        p.clone().add(new T.Vector3(0, 1.3, 0)),
      );
      return;
    }
    this.fly(
      new T.Vector3(
        city.x + 9 * this.activeScale,
        1.05 * this.activeScale,
        city.z + (this.neighborhoodSide * 12 + 0.4) * this.activeScale,
      ),
      new T.Vector3(
        city.x,
        1.3 * this.activeScale,
        city.z + (this.neighborhoodSide * 12 + 8) * this.activeScale,
      ),
    );
  }
  worldView() {
    this.viewMode = 'world';
    this.cancelJob();
    if (this.data) {
      this.preview(this.data);
      this.clearDistrict();
      this.data = null;
    }
    this.walking = false;
    this.active = null;
    this.controls.minDistance = 1.8;
    const entry = this.cities.get('vercel/next.js');
    const home = entry?.city || ownerSeed('vercel');
    const neighborhood = entry?.group.getObjectByName('neighborhood');
    const layout = neighborhood?.userData.previewLayout as PlannedLayout | undefined;
    // Frame a populated cluster, not the full reserved organization footprint.
    // Other neighborhoods remain available by orbiting and zooming out.
    let target = new T.Vector3(home.x, 0, home.z);
    if (layout?.parcels.length) {
      const parcels = layout.parcels;
      const cluster = parcels.reduce(
        (best, candidate) => {
          const nearby = parcels.filter(
            (p) => Math.hypot(p.x - candidate.x, p.z - candidate.z) < 28,
          );
          return nearby.length > best.length ? nearby : best;
        },
        [] as typeof parcels,
      );
      target.add(
        new T.Vector3(
          cluster.reduce((sum: number, p: { x: number }) => sum + p.x, 0) / cluster.length,
          0,
          cluster.reduce((sum: number, p: { z: number }) => sum + p.z, 0) / cluster.length,
        ),
      );
    }
    const compact = this.camera.aspect < 1;
    this.fly(
      target.clone().add(new T.Vector3(compact ? 34 : 30, compact ? 29 : 24, compact ? 42 : 36)),
      target,
    );
    this.finishArrival();
  }
  ownerView(cities: City[], immediate = false, preserveCamera = false) {
    this.viewMode = 'owner';
    this.cancelJob();
    if (this.data) {
      this.preview(this.data);
      this.clearDistrict();
      this.data = null;
    }
    this.active = null;
    cities.forEach((c) => this.addCity(c, false));
    this.clearCityTrees();
    if (!cities.length) return;
    const known = this.ownerGround.get(cities[0].id.split('/')[0].toLowerCase());
    const points = known
      ? [
          new T.Vector3(
            known.origin.x + known.plan.bounds.minX,
            0,
            known.origin.z + known.plan.bounds.minZ,
          ),
          new T.Vector3(
            known.origin.x + known.plan.bounds.maxX,
            0,
            known.origin.z + known.plan.bounds.maxZ,
          ),
        ]
      : cities.map((c) => new T.Vector3(c.x, 0, c.z));
    for (const city of cities)
      points.push(
        new T.Vector3(city.x - 16, 0, city.z - 16),
        new T.Vector3(city.x + 16, 0, city.z + 16),
      );
    const box = new T.Box3().setFromPoints(points),
      center = box.getCenter(new T.Vector3()),
      size = box.getSize(new T.Vector3());
    const halfSpan = (size.x + size.z) / 2;
    const tangent = Math.tan(T.MathUtils.degToRad(this.camera.fov / 2));
    const distance =
      Math.max(
        halfSpan / Math.sqrt(2) / (tangent * this.camera.aspect * 0.85),
        halfSpan / Math.sqrt(6) / (tangent * 0.8),
      ) +
      halfSpan / Math.sqrt(3);
    const d = Math.max(30, distance / Math.sqrt(3));
    if (preserveCamera) return;
    this.walking = false;
    this.fly(center.clone().add(new T.Vector3(d, d, d)), center);
    if (immediate) this.finishArrival();
  }
  finishArrival() {
    if (this.goal) {
      this.camera.position.copy(this.goal.position);
      this.controls.target.copy(this.goal.target);
      this.goal = null;
    }
    this.controls.update();
  }
  zoom(factor: number) {
    this.navigationRevision++;
    this.goal = null;
    this.camera.position.copy(
      this.controls.target
        .clone()
        .add(this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor)),
    );
  }
  north() {
    const d = this.camera.position.distanceTo(this.controls.target);
    this.fly(
      this.controls.target.clone().add(new T.Vector3(0, d * 0.7, d * 0.7)),
      this.controls.target.clone(),
    );
  }
  fly(position: T.Vector3, target: T.Vector3) {
    // A destination below the enforced camera floor can never finish interpolating.
    keepAboveGround(
      position,
      target,
      cameraFloor(
        (x: number, z: number) => this.landscape.height(x, z),
        position.x,
        position.z,
        this.activeScale,
      ),
      false,
    );
    if (position.y > 1.8 * this.activeScale) this.walking = false;
    this.goal = { position, target };
    if (this.reduceMotion) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.goal = null;
    }
  }
  navigationRevision = 0;
  cancelFlight = () => {
    this.navigationRevision++;
    this.goal = null;
  };
  resize = () => {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.fov = width < 700 ? 62 : 42;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(width, height);
  };
  pointerTravel = 0;
  dragging = false;
  lastPointer = { x: 0, y: 0 };
  pointerDown = (e: PointerEvent) => {
    this.pointerTravel = 0;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.canvasDown = { x: e.clientX, y: e.clientY };
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.dragging = true;
  };
  pointerCancel = () => {
    this.dragging = false;
  };
  pointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.pointerTravel = Math.max(
      this.pointerTravel,
      Math.hypot(e.clientX - this.canvasDown.x, e.clientY - this.canvasDown.y),
    );
    if (!this.walking) return;
    const dx = e.clientX - this.lastPointer.x,
      dy = e.clientY - this.lastPointer.y;
    this.goal = null;
    this.walkPath = [];
    this.highwayDestination = null;
    const look = this.controls.target.clone().sub(this.camera.position);
    const spherical = new T.Spherical().setFromVector3(look);
    spherical.theta -= dx * 0.004;
    spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, spherical.phi + dy * 0.004));
    look.setFromSpherical(spherical);
    this.controls.target.copy(this.camera.position).add(look);
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };
  pointerUp = (e: PointerEvent) => {
    this.dragging = false;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId))
      this.renderer.domElement.releasePointerCapture(e.pointerId);
    if (this.pointerTravel > 5 || e.button !== 0) return;
    if (Math.hypot(e.clientX - this.canvasDown.x, e.clientY - this.canvasDown.y) > 5) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.intersectObjects(this.pickables).find((h) => {
      let o: T.Object3D | null = h.object;
      while (o) {
        if (!o.visible) return false;
        o = o.parent;
      }
      return true;
    });
    const inventory = hit && directoryHit(hit);
    if (inventory) {
      if (this.active !== inventory.repo || this.viewMode !== 'repo') {
        this.onCity(inventory.repo);
        return;
      }
      this.fly(hit!.point.clone().add(new T.Vector3(15, 18, 22)), hit!.point.clone());
      this.onDirectory?.(inventory.directory, inventory.block);
    } else if (hit?.object.userData.issueNumber) this.selectIssue(hit.object.userData.issueNumber);
    else if (hit?.object.userData.streetVisitor || hit?.object.userData.streetTraffic)
      this.meetTraveler(
        hit.object.userData.streetVisitor ? 'visitor' : 'traffic',
        (hit.instanceId || 0) * (hit.object.userData.actorStride || 1) +
          (hit.object.userData.actorOffset || 0),
      );
    else if (hit?.object.userData.directory) {
      const p = hit.point.clone();
      this.fly(
        p
          .clone()
          .add(new T.Vector3(15 * this.activeScale, 18 * this.activeScale, 22 * this.activeScale)),
        p,
      );
      this.onDirectory?.(hit.object.userData.directory, hit.object.userData.directoryBlock);
    } else if (hit?.object.userData.hall) this.onHall?.();
    else if (hit?.object.userData.dependencies?.length)
      this.onHighway?.(hit.object.userData.dependencies.filter((id: string) => id !== this.active));
    else if (hit?.object.userData.city)
      this.onCity(
        this.viewMode === 'world'
          ? hit.object.userData.city.split('/')[0]
          : hit.object.userData.city,
      );
    else if (hit) {
      const file = hit.object.userData.file || batchedFile(hit.object, hit.faceIndex);
      if (file) this.onFile(file);
    }
  };
  keyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input,textarea,dialog,[contenteditable=true]')) return;
    if (e.key.toLowerCase() === 'e') {
      e.preventDefault();
      this.interact();
      return;
    }
    if (
      ['w', 'a', 's', 'd', 'Shift', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        e.key,
      )
    ) {
      e.preventDefault();
      this.keys.add(e.key.toLowerCase());
      this.walkPath = [];
      this.highwayDestination = null;
      this.goal = null;
    }
  };
  keyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  clearKeys = () => this.keys.clear();
  visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.frame);
      this.keys.clear();
      this.audio.context?.suspend();
    } else {
      this.clock.getDelta();
      if (this.audio.enabled) this.audio.context?.resume();
      this.frame = requestAnimationFrame(this.animate);
    }
  };
  contextLost = (e: Event) => {
    e.preventDefault();
    this.container.dispatchEvent(
      new CustomEvent('world-error', {
        detail: 'The 3D context was interrupted. Refresh to reconstruct your city.',
      }),
    );
  };
  resolveNearbyDirectory(time: number) {
    if (
      !this.activePlan ||
      !this.onDirectory ||
      this.viewMode !== 'repo' ||
      this.requestedDirectories.size ||
      time < this.nextDirectorySurvey ||
      (!this.walking && this.camera.position.y > 24)
    )
      return;
    this.nextDirectorySurvey = time + 0.75;
    const x = this.camera.position.x - this.district.position.x;
    const z = this.camera.position.z - this.district.position.z;
    let closest: PlannedLayout['regions'][number] | undefined;
    let distance = 24;
    for (const region of this.activePlan.regions) {
      if (
        region.repo !== this.active ||
        !region.unresolved.length ||
        Math.hypot(region.center.x - x, region.center.z - z) > 70
      )
        continue;
      for (const slot of region.unresolved) {
        const lot = region.lots[slot];
        const d = Math.hypot(lot.x - x, lot.z - z);
        if (d < distance) {
          distance = d;
          closest = region;
        }
      }
    }
    if (!closest) return;
    const key = `${closest.repo}:${closest.directory}:${closest.index}`;
    this.requestedDirectories.add(key);
    Promise.resolve(this.onDirectory(closest.directory, closest.index))
      .then((success) => {
        this.nextDirectorySurvey = this.clock.elapsedTime + (success ? 2 : 30);
      })
      .catch(() => {
        this.nextDirectorySurvey = this.clock.elapsedTime + 30;
      })
      .finally(() => this.requestedDirectories.delete(key));
  }
  animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const frameSeconds = this.clock.getDelta(),
      dt = Math.min(frameSeconds, 0.05),
      time = this.clock.elapsedTime;
    foliageClock.value = this.reduceMotion ? 0 : time;
    this.resolveNearbyDirectory(time);
    if (this.goal) {
      const k = 1 - Math.exp(-dt * 3);
      this.camera.position.lerp(this.goal.position, k);
      this.controls.target.lerp(this.goal.target, k);
      if (this.camera.position.distanceTo(this.goal.position) < 0.04) this.goal = null;
    }
    if (this.keys.size) {
      const forward = this.controls.target.clone().sub(this.camera.position);
      forward.y = 0;
      forward.normalize();
      const right = forward.clone().cross(UP);
      const move = new T.Vector3();
      if (this.keys.has('w') || this.keys.has('arrowup')) move.add(forward);
      if (this.keys.has('s') || this.keys.has('arrowdown')) move.sub(forward);
      if (this.keys.has('d') || this.keys.has('arrowright')) move.add(right);
      if (this.keys.has('a') || this.keys.has('arrowleft')) move.sub(right);
      if (move.lengthSq() > 0) {
        this.navigationRevision++;
        this.walkPath = [];
        this.highwayDestination = null;
        this.goal = null;
      }
      move.normalize().multiplyScalar(dt * (this.walking ? 4 * this.activeScale : 15));
      if (this.keys.has('shift')) move.multiplyScalar(1.8);
      const next = this.camera.position.clone().add(move);
      if (!this.walking || !this.blocked(next)) {
        this.camera.position.add(move);
        this.controls.target.add(move);
        if (this.walking && this.footsteps.advance(move.length(), this.activeScale))
          this.audio.step();
      }
    }
    if (this.walkPath.length && this.walking && !this.goal) {
      const target = this.walkPath[0];
      target.y = this.camera.position.y;
      const move = target.clone().sub(this.camera.position),
        distance = move.length();
      if (distance < 0.15 * this.activeScale) {
        this.walkPath.shift();
        if (!this.walkPath.length && this.highwayDestination) {
          const id = this.highwayDestination;
          this.highwayDestination = null;
          this.pendingStreetView = {
            id,
            position: this.camera.position.clone(),
            target: this.controls.target.clone(),
          };
          this.onCity(id);
        }
        const issue = this.streetLife?.orders.find((o) => o.number === this.trackedIssue);
        if (!this.walkPath.length && issue)
          this.controls.target.copy(
            new T.Vector3(issue.x, 0.22, issue.z)
              .multiplyScalar(this.activeScale)
              .add(this.district.position),
          );
      } else {
        move.normalize().multiplyScalar(Math.min(distance, dt * 5 * this.activeScale));
        const next = this.camera.position.clone().add(move);
        if (!this.blocked(next)) {
          this.camera.position.add(move);
          this.controls.target.add(move);
          if (this.footsteps.advance(move.length(), this.activeScale)) this.audio.step();
          const look = this.camera.position.clone().add(
            move
              .clone()
              .normalize()
              .multiplyScalar(4 * this.activeScale),
          );
          this.controls.target.lerp(look, walkingLookBlend(dt));
        } else {
          this.walkPath = [];
          this.highwayDestination = null;
          this.onNavigationNotice?.(
            'Walking stopped at an obstacle. Move onto clear pavement, then choose your destination again.',
          );
        }
      }
    }
    if (!this.pendingPreviewBatches) this.updatePreviewDetail();
    if (this.blockBatches) {
      const camera = this.district.worldToLocal(this.camera.position.clone());
      this.renderer.domElement.dataset.batchedBlocks = String(
        this.blockBatches.update(camera, this.inside, this.animations.length > 0),
      );
    }
    if (this.streetLife) {
      const local = this.camera.position
        .clone()
        .sub(this.district.position)
        .divideScalar(this.activeScale);
      this.streetLife.update(dt, local, localSky().night > 0.5, this.reduceMotion);
      const order = this.streetLife.orders.find((o) => o.number === this.trackedIssue);
      if (order) {
        if (this.walkPath.length && Math.hypot(local.x - order.x, local.z - order.z) <= 1.55) {
          this.walkPath = [];
          this.highwayDestination = null;
          this.controls.target.copy(
            new T.Vector3(order.x, 0.22, order.z)
              .multiplyScalar(this.activeScale)
              .add(this.district.position),
          );
        }
        if (this.issueRouteRequested && this.walking && !this.goal) {
          const approach = new T.Vector3(order.x, 0, order.z).normalize().multiplyScalar(-1.35);
          const destination = new T.Vector3(order.x, 0, order.z)
            .add(approach)
            .multiplyScalar(this.activeScale)
            .add(this.district.position);
          this.walkPath = this.route(
            this.camera.position,
            destination,
            this.district.position,
            this.neighborhoodSide,
            this.activeScale,
          );
          this.issueRouteRequested = false;
          if (!this.walkPath.length)
            this.onNavigationNotice?.(
              'No connected walking route reaches this issue yet. Explore nearby streets to approach the marker.',
            );
        }
        if (time - this.lastHud > 0.3)
          this.onStreetProximity?.(Math.hypot(local.x - order.x, local.z - order.z), this.walking);
      }
    }
    if (this.job) {
      if (!document.querySelector('dialog[open]')) this.jobTime += dt;
      if (time - this.lastHud > 0.3) {
        const p = this.servicePoint(this.job.stops[this.jobIndex]);
        const distance =
          Math.hypot(p.x - this.camera.position.x, p.z - this.camera.position.z) / this.activeScale;
        this.onMission?.({
          name: this.job.kind,
          path: this.job.stops[this.jobIndex],
          index: this.jobIndex,
          total: this.job.stops.length,
          distance,
          arrived: canService(distance, this.walking),
          seconds: this.jobTime,
          walking: this.walking,
          position: {
            x: (this.camera.position.x - this.district.position.x) / this.activeScale,
            z: (this.camera.position.z - this.district.position.z) / this.activeScale,
          },
          target: {
            x: (p.x - this.district.position.x) / this.activeScale,
            z: (p.z - this.district.position.z) / this.activeScale,
          },
          side: this.neighborhoodSide,
          map: this.activePlan?.map,
          route: this.walkPath.map((p) => ({
            x: (p.x - this.district.position.x) / this.activeScale,
            z: (p.z - this.district.position.z) / this.activeScale,
          })),
        });
      }
    }
    // Walking can look above the horizon without OrbitControls lifting the camera.
    this.controls.maxPolarAngle = this.walking ? Math.PI - 0.01 : Math.PI / 2 - 0.015;
    this.controls.enableRotate = !this.walking;
    this.controls.enablePan = !this.walking;
    // Orbiting changes camera position. Walking changes only its viewing direction.
    this.controls.enabled = !this.walking;
    // Scripted flights own the camera until arrival. Orbit damping must not
    // pull an interrupted overview flight back upward during a street return.
    if (!this.walking && !this.goal) this.controls.update();
    const floor = cameraFloor(
      (x: number, z: number) => this.landscape.height(x, z),
      this.camera.position.x,
      this.camera.position.z,
      this.activeScale,
    );
    keepAboveGround(this.camera.position, this.controls.target, floor, this.walking && !this.goal);
    this.camera.lookAt(this.controls.target);
    if (
      this.walking &&
      !this.goal &&
      (!this.job ||
        (this.job.kind === 'courier' &&
          this.job.stops.some((p) => p.startsWith(this.job!.repo + '/')))) &&
      !this.pendingStreetView &&
      !this.highwayDestination &&
      time - this.lastNeighborhoodCheck > 1
    ) {
      this.lastNeighborhoodCheck = time;
      const neighbor = this.neighborRegions.find((n) =>
        n.polygons.some((p) => pointInPolygon(this.camera.position, p)),
      );
      if (neighbor) {
        this.pendingStreetView = {
          id: neighbor.id,
          position: this.camera.position.clone(),
          target: this.controls.target.clone(),
        };
        this.onCity(neighbor.id);
      }
    }
    this.renderer.domElement.dataset.activeRepo = this.active || '';
    this.renderer.domElement.dataset.highwayDestination = this.highwayDestination || '';
    const progress = walkingProgress(this.camera.position, this.walkPath, this.activeScale);
    const travelSeconds = progress.seconds;
    const localTrip =
      this.walkingDestination && this.walking && this.walkPath.length
        ? { destination: this.walkingDestination, ...progress }
        : null;
    const localKey = localTrip
      ? `${localTrip.destination}:${localTrip.distance}:${localTrip.seconds}`
      : '';
    if (localKey !== this.lastWalkingTravel) {
      this.lastWalkingTravel = localKey;
      this.onWalkingTravel?.(localTrip);
    }
    if (!this.walkPath.length) this.walkingDestination = null;
    const travelKey = this.highwayDestination ? `${this.highwayDestination}:${travelSeconds}` : '';
    if (travelKey !== this.lastHighwayTravel) {
      this.lastHighwayTravel = travelKey;
      this.onHighwayTravel?.(
        this.highwayDestination
          ? { destination: this.highwayDestination, seconds: travelSeconds }
          : null,
      );
    }
    let highwayMeshes = 0;
    this.highways.traverse((object) => {
      if (
        object instanceof T.Mesh &&
        object.visible &&
        (Array.isArray(object.material) ? object.material : [object.material]).some(
          (material) => material.visible,
        )
      )
        highwayMeshes++;
    });
    this.renderer.domElement.dataset.highwayMeshes = String(highwayMeshes);
    this.renderer.domElement.dataset.trafficDestinations = String(
      this.streetLife?.vehicleJourneys?.network.destinations.length || 0,
    );
    this.renderer.domElement.dataset.cameraX = this.camera.position.x.toFixed(4);
    this.renderer.domElement.dataset.cameraZ = this.camera.position.z.toFixed(4);
    this.renderer.domElement.dataset.cameraHeight = this.camera.position.y.toFixed(4);
    this.renderer.domElement.dataset.cameraDestinationHeight =
      this.goal?.position.y.toFixed(4) || '';
    this.renderer.domElement.dataset.walking = String(this.walking);
    this.renderer.domElement.dataset.cameraFloor = floor.toFixed(4);
    this.updateLighting(time);
    if (this.camera.position.y < floor + 0.37 * this.activeScale && this.active)
      this.walking = true;
    else if (this.camera.position.y > floor + 1.22 * this.activeScale) this.walking = false;
    if (this.animations.length) this.renderer.shadowMap.needsUpdate = true;
    for (const a of this.animations) {
      const t = Math.max(0, Math.min(1, (time - a.start) / a.duration));
      a.object.scale.y = this.reduceMotion ? 1 : Math.max(0.001, 1 - Math.pow(1 - t, 3));
    }
    this.animations = this.animations.filter((a) => time < a.start + a.duration);
    if (this.rain && !this.reduceMotion) {
      const p = this.rain.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, (p.getY(i) - dt * 12 + 35) % 35);
      p.needsUpdate = true;
    }
    if (this.cranes.length && time - this.lastConstruction > 3) {
      this.audio.construction();
      this.lastConstruction = time;
    }
    if (!this.reduceMotion) {
      this.cranes.forEach((c, i) => (c.rotation.y = Math.sin(time * 0.12 + i) * 0.8));
      for (const car of this.cars) {
        const t = (time * car.speed + car.offset) % 1;
        car.mesh.position.copy(car.curve.getPoint(t));
        car.mesh.lookAt(car.curve.getPoint((t + 0.005) % 1));
      }
    }
    const width = this.container.clientWidth,
      height = this.container.clientHeight;
    for (const label of this.residentLabels) {
      const p = label.position.clone().project(this.camera);
      label.element.style.transform = `translate(-50%,-50%) translate(${(p.x * 0.5 + 0.5) * width}px,${(-p.y * 0.5 + 0.5) * height}px)`;
      label.element.style.display = p.z > 1 || p.z < 0 || this.inside ? 'none' : '';
    }
    const labeledOwners = new Set<string>();
    const labelPositions: { x: number; y: number }[] = [];
    const orderedLabels = [...this.labelElements].sort(
      ([a], [b]) => Number(this.previews.has(b)) - Number(this.previews.has(a)),
    );
    for (const [id, el] of orderedLabels) {
      const city = this.cities.get(id)!.city;
      const survey = Boolean(this.cities.get(id)?.group.getObjectByName('arrival-grid'));
      el.classList.toggle('survey-label', survey);
      const worldLabel = this.viewMode === 'world' && this.camera.position.y > 120;
      const title = worldLabel ? id.split('/')[0] : city.name;
      const subtitle = worldLabel
        ? city.name + ' neighborhood'
        : survey
          ? 'Survey · explore district'
          : id.split('/')[0] + ' · neighborhood';
      const name = el.querySelector('span')!,
        sub = el.querySelector('small')!;
      if (name.textContent !== title) name.textContent = title;
      if (sub.textContent !== subtitle) sub.textContent = subtitle;
      const p = new T.Vector3(city.x, 10, city.z).project(this.camera);
      const screenX = (p.x * 0.5 + 0.5) * width;
      const screenY = (-p.y * 0.5 + 0.5) * height;
      const owner = id.split('/')[0];
      const crowded =
        (worldLabel && labeledOwners.has(owner)) ||
        labelPositions.some(
          (point) => Math.abs(point.x - screenX) < 170 && Math.abs(point.y - screenY) < 60,
        );
      el.style.transform = `translate(-50%,-50%) translate(${screenX}px,${screenY}px)`;
      el.style.display =
        crowded ||
        p.z > 1 ||
        p.z < 0 ||
        (!worldLabel &&
          !this.previews.has(id) &&
          !this.cities.get(id)?.group.getObjectByName('arrival-grid') &&
          this.active !== id) ||
        this.walking ||
        Boolean(this.active && this.active !== id && this.camera.position.y < 35)
          ? 'none'
          : '';
      if (el.style.display !== 'none') {
        labeledOwners.add(owner);
        labelPositions.push({ x: screenX, y: screenY });
      }
      el.classList.toggle('selected', id === this.active);
    }
    if (time - this.lastHud > 0.3) {
      this.renderer.domElement.dataset.surveyDistricts = String(
        [...this.cities.values()].filter((entry) => entry.group.getObjectByName('arrival-grid'))
          .length,
      );
      const previewGroups = [...this.cities.values()]
        .map((entry) => entry.group.getObjectByName('neighborhood'))
        .filter(Boolean);
      this.renderer.domElement.dataset.detailedPreviews = String(
        previewGroups.filter((group) => group!.userData.previewDetail).length,
      );
      this.renderer.domElement.dataset.massingPreviews = String(
        previewGroups.filter((group) => !group!.userData.previewDetail).length,
      );
      this.scene.traverse((object) => {
        if (object.userData.updateSurvey)
          object.userData.updateSurvey(object.worldToLocal(this.camera.position.clone()));
        if (object instanceof T.Mesh && object.material instanceof T.MeshStandardMaterial)
          this.surfaces.track(object.material);
      });
      this.renderer.domElement.dataset.quality = this.economical
        ? 'adaptive-lite'
        : this.highQualityReady && this.composer
          ? 'full'
          : 'balanced';
      this.renderer.domElement.dataset.drawCalls = String(this.renderer.info.render.calls);
      this.renderer.domElement.dataset.triangles = String(this.renderer.info.render.triangles);
      this.renderer.domElement.dataset.frameMs = (frameSeconds * 1000).toFixed(1);
      this.renderer.domElement.dataset.streetModels = String(
        this.streetLife?.group.userData.modelCount || 0,
      );
      this.renderer.domElement.dataset.visitors = String(this.streetLife?.population.visitors || 0);
      this.renderer.domElement.dataset.traffic = String(this.streetLife?.population.cars || 0);
      this.renderer.domElement.dataset.streetIssues = String(this.streetLife?.orders.length || 0);
      this.renderer.domElement.dataset.visitorArrivals = String(
        this.streetLife?.visitorJourneys?.completed || 0,
      );
      this.renderer.domElement.dataset.vehicleArrivals = String(
        this.streetLife?.vehicleJourneys?.completed || 0,
      );
      this.renderer.domElement.dataset.journeyDestinations = String(
        this.streetLife?.visitorJourneys?.network.destinations.length || 0,
      );
      this.renderer.domElement.dataset.trafficClosures = String(
        this.streetLife?.vehicleJourneys?.network.closed.size || 0,
      );
      this.renderer.domElement.dataset.streetTime = (this.streetLife?.elapsed || 0).toFixed(2);
      this.renderer.domElement.dataset.geometry = 'mesh';
      this.renderer.domElement.dataset.constructionCount = String(this.constructed.size);
      this.renderer.domElement.dataset.animating = String(this.animations.length);
      this.renderer.domElement.dataset.structures = String(
        this.data?.files.length ||
          [...this.previews.values()].reduce((n, d) => n + d.files.length, 0),
      );
      this.onView(Math.round(this.camera.position.y * 12), this.walking);
      this.lastHud = time;
    }
    // Recover detail after sustained headroom, with a cooldown after each
    // reduction so a demanding scene cannot oscillate every few seconds.
    if (this.qualityHistory.observe(frameSeconds, time)) {
      this.economical = this.qualityHistory.economical;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.economical ? 1 : 1.5));
      this.resize();
    }
    this.highQualityReady = this.qualityHistory.ready;
    this.renderer.info.reset();
    if (this.composer && this.highQualityReady && !this.economical && window.innerWidth > 900)
      this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };
  disposeGroup(g: T.Group) {
    g.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
      o.userData.buildingRecipe?.body.dispose();
      o.userData.buildingRecipe?.glass.dispose();
      o.userData.buildingRecipe?.roof?.dispose();
      o.userData.renderTarget?.dispose();
      o.userData.uncutStreetGeometry?.dispose();
      if (o instanceof T.Sprite) o.material.dispose();
      if (o instanceof T.Mesh || o instanceof T.Points || o instanceof T.LineSegments) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((m) => m.dispose());
      }
    });
  }
  dispose() {
    this.disposed = true;
    if (process.env.NODE_ENV !== 'production')
      Reflect.deleteProperty(this.renderer.domElement, 'projectHighwayPoints');
    if (process.env.NODE_ENV !== 'production')
      Reflect.deleteProperty(this.renderer.domElement, 'readTrafficState');
    this.pavementWorker.dispose();
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.audio.dispose();
    this.cancelJob();
    this.streetLife?.dispose();
    this.streetLife = null;
    this.disposeGroup(this.world);
    this.disposeGroup(this.district);
    this.disposeGroup(this.highways);
    this.disposeGroup(this.atlasRoads);
    this.landscape.dispose();
    this.composer?.passes.forEach((pass) => pass.dispose());
    this.composer?.dispose();
    this.surfaces.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.remove();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clearKeys);
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
