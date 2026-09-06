import { visitorVisibility } from './visitor-visibility.mjs';
import { citizenFinish } from './citizen-finish.mjs';
import { JourneyNetwork, CityJourneys } from '../../shared/journeys.mjs';
import type { PlannedLayout } from './planned-layout';
import * as T from 'three';
import { citizenGait } from './citizen-gait.mjs';
import { streetModel } from './street-models';
import { roadRepair } from './road-repair.mjs';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { random } from '../../shared/model.mjs';
import { cityPopulation, workOrders } from '../../shared/street-life.mjs';
import type { Repo } from './types';
export type WorkOrder = ReturnType<typeof workOrders>[number];
function boxes(parts: number[][]) {
  const geometries = parts.map(([w, h, d, x, y, z]) =>
    new T.BoxGeometry(w, h, d).translate(x, y, z),
  );
  const result = mergeGeometries(geometries);
  geometries.forEach((g) => g.dispose());
  return result;
}
function merged(parts: T.BufferGeometry[]) {
  const result = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return result;
}
function visitorCoat() {
  return merged([
    new T.CapsuleGeometry(0.064, 0.105, 3, 8).scale(1, 1, 0.7).translate(0, 0.355, 0),
    new T.CapsuleGeometry(0.022, 0.135, 3, 7).rotateZ(-0.12).translate(-0.081, 0.32, 0),
    new T.CapsuleGeometry(0.022, 0.135, 3, 7).rotateZ(0.12).translate(0.081, 0.32, 0),
  ]);
}
function visitorLeg(x: number) {
  return merged([
    new T.CylinderGeometry(0.024, 0.019, 0.205, 7).translate(x, 0.137, 0),
    new T.BoxGeometry(0.044, 0.032, 0.075).translate(x, 0.029, 0.013),
  ]);
}
function vehicleGlass() {
  const geometry = new T.BoxGeometry(0.46, 0.19, 0.68);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) > 0) {
      positions.setX(i, positions.getX(i) * 0.82);
      positions.setZ(i, positions.getZ(i) * 0.6 - 0.035);
    }
  }
  geometry.computeVertexNormals();
  return geometry.translate(0, 0.44, -0.05);
}
function vehicleTires() {
  return merged(
    [-1, 1].flatMap((x) =>
      [-1, 1].map((z) =>
        new T.CylinderGeometry(0.095, 0.095, 0.075, 12)
          .rotateZ(Math.PI / 2)
          .translate(x * 0.265, 0.135, z * 0.35),
      ),
    ),
  );
}
function pathPoint(progress: number, cx: number, cz: number, radius: number) {
  const bend = 0.65,
    straight = radius * 2 - bend * 2,
    arc = (Math.PI * bend) / 2;
  const distance = (((progress % 1) + 1) % 1) * (straight + arc) * 4;
  const edge = Math.floor(distance / (straight + arc)),
    part = distance - edge * (straight + arc);
  let x = -radius + bend + part,
    z = -radius,
    angle = Math.PI / 2;
  if (part > straight) {
    const t = (((part - straight) / arc) * Math.PI) / 2;
    x = radius - bend + Math.sin(t) * bend;
    z = -radius + bend - Math.cos(t) * bend;
    angle -= t;
  }
  const turn = (edge * Math.PI) / 2;
  return {
    x: cx + x * Math.cos(turn) - z * Math.sin(turn),
    z: cz + x * Math.sin(turn) + z * Math.cos(turn),
    angle: angle - turn,
  };
}
export class StreetLife {
  group = new T.Group();
  private modelCars: T.InstancedMesh[] = [];
  private modelPeople: T.InstancedMesh[] = [];
  private poseMeshes: T.Mesh[] = [];
  private modelsLoading = [false, false, false, false];
  private modelAttempts = [0, 0, 0, 0];
  private nextModelRetry = [0, 0, 0, 0];
  private disposed = false;
  private async loadModels() {
    await Promise.allSettled(
      ['sedan', 'suv', 'citizen-male', 'citizen-female'].map(async (name, index) => {
        const people = index >= 2,
          count = people ? this.walkers.length : this.drivers.length;
        const existing = people ? this.modelPeople[index - 2] : this.modelCars[index];
        if (
          !count ||
          existing ||
          this.modelsLoading[index] ||
          this.modelAttempts[index] >= 3 ||
          performance.now() < this.nextModelRetry[index]
        )
          return;
        this.modelsLoading[index] = true;
        this.modelAttempts[index]++;
        try {
          const { geometry, material } = await streetModel(name);
          if (this.disposed) {
            geometry.dispose();
            material.map?.dispose();
            material.dispose();
            return;
          }
          if (people) {
            const palette = ['#66736d', '#617382', '#846c59', '#72717d', '#8a8270', '#4d605a'].map(
              (color) => new T.Color(color),
            );
            const colors = new Float32Array(Math.ceil(count / 2) * 3);
            for (let actor = 0; actor < Math.ceil(count / 2); actor++) {
              const person = this.walkers[actor * 2 + (index % 2)];
              palette[Math.floor((person?.offset || 0) * palette.length)].toArray(
                colors,
                actor * 3,
              );
            }
            geometry.setAttribute('citizenTint', new T.InstancedBufferAttribute(colors, 3));
            citizenFinish(material);
            visitorVisibility(material);
          }
          const mesh = new T.InstancedMesh(geometry, material, Math.ceil(count / 2));
          mesh.frustumCulled = false;
          mesh.receiveShadow = true;
          mesh.userData[people ? 'streetVisitor' : 'streetTraffic'] = true;
          mesh.userData.actorStride = 2;
          mesh.userData.actorOffset = index % 2;
          if (people) {
            const pose = new T.Mesh(geometry, material);
            mesh.setMorphAt(0, pose);
          }
          mesh.count = 0;
          this.group.add(mesh);
          this.group.userData.modelCount = (this.group.userData.modelCount || 0) + 1;
          this.batches.push(mesh);
          if (people) {
            this.modelPeople[index - 2] = mesh;
            this.poseMeshes[index - 2] = new T.Mesh(geometry, material);
          } else this.modelCars[index] = mesh;
        } finally {
          this.modelsLoading[index] = false;
          this.nextModelRetry[index] = performance.now() + 3000;
        }
      }),
    );
  }
  orders: WorkOrder[] = [];
  orderGroups = new Map<number, T.Group>();
  population: ReturnType<typeof cityPopulation>;
  elapsed = 0;
  paused = false;
  visitorJourneys: CityJourneys | null = null;
  vehicleJourneys: CityJourneys | null = null;
  private batches: T.InstancedMesh[] = [];
  private walkers: { offset: number; cx: number; cz: number; speed: number }[] = [];
  private gaits = new Map<
    number,
    { phase: number; weight: number; idlePhase?: number; position?: { x: number; z: number } }
  >();
  private drivers: { offset: number; cx: number; cz: number; speed: number; radius: number }[] = [];
  private personParts: T.InstancedMesh[] = [];
  private carParts: T.InstancedMesh[] = [];
  private shadows: T.InstancedMesh[] = [];
  private dummy = new T.Object3D();
  private pendingVehicles?: {
    state?: ReturnType<CityJourneys['snapshot']>;
    offset?: { x: number; z: number };
  };
  constructor(
    public repo: Repo,
    public side: number,
    addresses: Map<number, number>,
    public plan?: PlannedLayout,
    initial?: { state: ReturnType<StreetLife['journeyState']>; offset: { x: number; z: number } },
    deferVehicles = false,
  ) {
    this.population = cityPopulation(repo.stars, repo.usage?.weekly);
    const rng = random(`${repo.id}:street-life`);
    const centers = () => ({
      cx: (Math.floor(rng() * side) - (side - 1) / 2) * 24,
      cz: (Math.floor(rng() * side) - (side - 1) / 2) * 24,
    });
    this.walkers = Array.from({ length: this.population.visitors }, () => ({
      ...centers(),
      offset: rng(),
      speed: 0.38 + rng() * 0.18,
    }));
    this.drivers = Array.from({ length: this.population.cars }, () => ({
      ...centers(),
      offset: rng(),
      speed: 1.5 + rng() * 0.8,
      radius: rng() > 0.5 ? 11.55 : 12.45,
    }));
    const batch = (
      geometry: T.BufferGeometry,
      material: T.MeshStandardMaterial,
      count: number,
      visitor = false,
    ) => {
      if (visitor) visitorVisibility(material);
      const mesh = new T.InstancedMesh(geometry, material, count);
      mesh.frustumCulled = false;
      mesh.userData.streetVisitor = visitor;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.batches.push(mesh);
      return mesh;
    };
    const mat = (color: string, metalness = 0, roughness = 0.85) =>
      new T.MeshStandardMaterial({ color, metalness, roughness });
    if (this.walkers.length) {
      this.personParts = [
        batch(visitorCoat(), mat('#788b82'), this.walkers.length, true),
        batch(
          new T.SphereGeometry(0.047, 12, 8).scale(0.86, 1.06, 0.9).translate(0, 0.505, 0),
          mat('#bfb5a5'),
          this.walkers.length,
          true,
        ),
        batch(visitorLeg(-0.034), mat('#323d43'), this.walkers.length, true),
        batch(visitorLeg(0.034), mat('#323d43'), this.walkers.length, true),
      ];
      this.walkers.forEach((_, i) =>
        this.personParts[0].setColorAt(
          i,
          new T.Color(['#5b6b78', '#947659', '#677b64', '#8b8177'][i % 4]),
        ),
      );
    }
    if (this.drivers.length) {
      this.carParts = [
        batch(
          boxes([
            [0.54, 0.19, 1.1, 0, 0.22, 0],
            [0.49, 0.06, 1.02, 0, 0.34, 0],
          ]),
          mat('#7a8b95', 0.4, 0.3),
          this.drivers.length,
        ),
        batch(vehicleGlass(), mat('#263f4d', 0.65, 0.16), this.drivers.length),
        batch(vehicleTires(), mat('#252a2c', 0.15, 0.8), this.drivers.length),
        batch(
          boxes([
            [0.13, 0.055, 0.02, -0.17, 0.27, 0.565],
            [0.13, 0.055, 0.02, 0.17, 0.27, 0.565],
          ]),
          new T.MeshStandardMaterial({
            color: '#fff2cb',
            emissive: '#fff0bf',
            emissiveIntensity: 0.5,
          }),
          this.drivers.length,
        ),
        batch(
          boxes([
            [0.13, 0.055, 0.02, -0.17, 0.27, -0.565],
            [0.13, 0.055, 0.02, 0.17, 0.27, -0.565],
          ]),
          new T.MeshStandardMaterial({
            color: '#952c22',
            emissive: '#e63d20',
            emissiveIntensity: 0.3,
          }),
          this.drivers.length,
        ),
      ];
      this.drivers.forEach((_, i) =>
        this.carParts[0].setColorAt(
          i,
          new T.Color(['#6f8290', '#bdbab0', '#765448', '#394c55', '#7a8270'][i % 5]),
        ),
      );
    }
    const contactShadow = (count: number, w: number, d: number) => {
      const geometry = new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
      const material = new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: `varying vec2 shadowUV; void main(){shadowUV=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec2 shadowUV;void main(){float r=length((shadowUV-.5)*2.0);gl_FragColor=vec4(0.015,0.025,0.03,(1.0-smoothstep(.15,1.0,r))*.38);}`,
      });
      const mesh = new T.InstancedMesh(geometry, material, count);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.batches.push(mesh);
      return mesh;
    };
    this.shadows = [
      contactShadow(this.walkers.length, 0.38, 0.38),
      contactShadow(this.drivers.length, 0.85, 1.5),
    ];
    this.carParts.forEach((mesh) => (mesh.userData.streetTraffic = true));
    this.orders = workOrders(repo, side, addresses);
    if (plan) {
      const nodes = new Map(plan.graph.nodes.map((n) => [n.id, n]));
      this.orders.forEach((order, i) => {
        const edge = plan.graph.edges[(addresses.get(order.number) ?? i) % plan.graph.edges.length];
        const a = nodes.get(edge.from)!,
          b = nodes.get(edge.to)!;
        order.x = (a.x + b.x) / 2;
        order.z = (a.z + b.z) / 2;
        order.heading = Math.atan2(b.x - a.x, b.z - a.z);
      });
    }
    if (plan) {
      const network = new JourneyNetwork(
        plan.graph,
        plan.destinations,
        this.orders.filter((o) => o.kind === 'pothole'),
      );
      this.visitorJourneys = new CityJourneys(
        network,
        this.walkers.length,
        `${repo.id}:visits`,
        false,
        initial?.state.visitors,
        initial?.offset,
      );
      if (deferVehicles)
        this.pendingVehicles = { state: initial?.state.vehicles, offset: initial?.offset };
      else
        this.vehicleJourneys = new CityJourneys(
          network,
          this.drivers.length,
          `${repo.id}:deliveries`,
          true,
          initial?.state.vehicles,
          initial?.offset,
        );
    }
    this.orders.forEach((order) => this.makeOrder(order));
    this.update(0, new T.Vector3(10000, 10000, 10000), false, false);
  }
  setVehicleNetwork(
    graph: {
      nodes: { id: string; x: number; z: number }[];
      edges: { from: string; to: string; length: number }[];
    },
    destinations: PlannedLayout['destinations'],
  ) {
    const saved = this.pendingVehicles?.state || this.vehicleJourneys?.snapshot();
    const offset = this.pendingVehicles?.offset;
    this.vehicleJourneys = new CityJourneys(
      new JourneyNetwork(
        graph,
        destinations,
        this.orders.filter((o) => o.kind === 'pothole'),
      ),
      this.drivers.length,
      `${this.repo.id}:deliveries`,
      true,
      saved,
      offset,
    );
    this.pendingVehicles = undefined;
  }
  finishVehicleSetup() {
    if (!this.vehicleJourneys && this.visitorJourneys && this.plan)
      this.setVehicleNetwork(this.visitorJourneys.network.graph, this.plan.destinations);
  }
  journeyState() {
    return {
      visitors: this.visitorJourneys?.snapshot(),
      vehicles: this.vehicleJourneys?.snapshot(),
    };
  }
  restoreJourneys(state?: ReturnType<StreetLife['journeyState']>, offset = { x: 0, z: 0 }) {
    if (!state) return;
    this.visitorJourneys?.restore(state.visitors, offset);
    this.vehicleJourneys?.restore(state.vehicles, offset);
  }
  driverPositions() {
    return this.drivers.map((car) => car.offset);
  }
  restoreDrivers(offsets?: number[]) {
    this.drivers.forEach((car, i) => {
      if (offsets?.[i] !== undefined) car.offset = offsets[i];
    });
  }
  private makeOrder(order: WorkOrder) {
    const group = new T.Group();
    group.position.set(order.x, this.plan ? 0.075 : 0, order.z);
    group.rotation.y = order.heading;
    group.userData.orderNumber = order.number;
    const mat = (color: string) => new T.MeshStandardMaterial({ color, roughness: 0.9 });
    const add = (geometry: T.BufferGeometry, color: string) => {
      const mesh = new T.Mesh(geometry, mat(color));
      mesh.userData.issueNumber = order.number;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    if (order.kind === 'pothole') {
      const repair = roadRepair(`${this.repo.id}#${order.number}`);
      repair.position.y = 0.037;
      repair.traverse((object) => {
        object.userData.issueNumber = order.number;
      });
      group.add(repair);
    } else {
      add(
        boxes([
          [0.035, 0.65, 0.035, -0.3, 0.36, 0],
          [0.035, 0.65, 0.035, 0.3, 0.36, 0],
          [0.76, 0.38, 0.045, 0, 0.61, 0],
        ]),
        order.kind === 'wayfinding' ? '#547b76' : '#9b7951',
      );
      add(
        boxes([
          [0.48, 0.035, 0.05, 0, 0.66, 0.03],
          [0.32, 0.025, 0.05, -0.08, 0.55, 0.03],
        ]),
        '#e4d6b9',
      );
    }
    // Cones and a hazard lamp are a readable, clickable issue marker at street scale.
    for (const sign of [-1, 1]) {
      add(boxes([[0.23, 0.025, 0.23, sign * 0.8, 0.05, 0]]), '#383b36');
      const cone = new T.ConeGeometry(0.09, 0.28, 10);
      cone.translate(sign * 0.8, 0.2, 0);
      add(cone, '#c8773d');
      const stripe = new T.CylinderGeometry(0.05, 0.065, 0.045, 10);
      stripe.translate(sign * 0.8, 0.21, 0);
      add(stripe, '#e3ddc5');
    }
    const lamp = new T.Mesh(
      new T.SphereGeometry(0.045, 8, 6),
      new T.MeshStandardMaterial({ color: '#ffd191', emissive: '#ffc15f', emissiveIntensity: 1 }),
    );
    lamp.position.set(0.8, 0.37, 0);
    lamp.userData.issueNumber = order.number;
    group.add(lamp);
    this.group.add(group);
    this.orderGroups.set(order.number, group);
  }
  closeIssue(number: number) {
    const order = this.orders.find((o) => o.number === number),
      group = this.orderGroups.get(number);
    if (!order || !group) return;
    this.disposeObject(group);
    group.clear();
    group.removeFromParent();
    this.orderGroups.delete(number);
    this.orders = this.orders.filter((o) => o.number !== number);
    if (this.plan && this.vehicleJourneys) {
      const saved = this.vehicleJourneys.snapshot();
      this.vehicleJourneys = new CityJourneys(
        new JourneyNetwork(
          this.vehicleJourneys.network.graph,
          this.vehicleJourneys.network.destinations,
          this.orders.filter((o) => o.kind === 'pothole'),
        ),
        this.drivers.length,
        `${this.repo.id}:deliveries`,
        true,
        saved,
      );
    }
    if (order.kind === 'pothole') {
      const patch = roadRepair(`${this.repo.id}#${order.number}`, true);
      patch.position.set(order.x, this.plan ? 0.112 : 0.037, order.z);
      patch.rotation.y = order.heading;
      this.group.add(patch);
    }
  }
  update(dt: number, player: T.Vector3, night: boolean, reduced: boolean) {
    if (
      !this.disposed &&
      this.modelAttempts.some((attempt, index) => {
        const people = index >= 2;
        return (
          !this.modelsLoading[index] &&
          performance.now() >= this.nextModelRetry[index] &&
          attempt < 3 &&
          (people ? this.walkers.length : this.drivers.length) > 0 &&
          !(people ? this.modelPeople[index - 2] : this.modelCars[index])
        );
      })
    )
      void this.loadModels();
    const peopleReady = Boolean(this.modelPeople[0] && this.modelPeople[1]),
      carsReady = Boolean(this.modelCars[0] && this.modelCars[1]);
    this.personParts.forEach((mesh) => (mesh.visible = !peopleReady));
    this.carParts.forEach((mesh) => (mesh.visible = !carsReady));
    for (const mesh of this.modelCars) {
      if (!mesh) continue;
      const material = mesh.material as T.MeshStandardMaterial;
      if (material.userData.vehicleNight) material.userData.vehicleNight.value = night ? 1 : 0;
    }
    this.modelPeople.forEach((mesh) => (mesh.count = 0));
    this.modelCars.forEach((mesh) => (mesh.count = 0));
    if (!this.paused && !reduced) this.elapsed += dt;
    this.visitorJourneys?.update(dt, player, this.paused || reduced);
    this.vehicleJourneys?.update(dt, player, this.paused || reduced);
    const transform = (
      mesh: T.InstancedMesh,
      index: number,
      x: number,
      y: number,
      z: number,
      angle: number,
      swing = 0,
      visible = true,
    ) => {
      this.dummy.scale.setScalar(visible ? 1 : 0);
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(swing, angle, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
    };
    this.walkers.forEach((person, i) => {
      const trip = this.visitorJourneys?.actors[i];
      const p = trip
        ? { ...trip.position, angle: trip.angle }
        : pathPoint(person.offset + (this.elapsed * person.speed) / 80, person.cx, person.cz, 9.95);
      const moving = !trip || trip.moving;
      transform(this.shadows[0], i, p.x, this.plan ? 0.15 : 0.114, p.z, 0);
      if (this.modelPeople[i % 2]) {
        const variant = i % 2,
          mesh = this.modelPeople[variant],
          pose = this.poseMeshes[variant],
          index = mesh.count++;
        let gait = this.gaits.get(i);
        if (!gait) {
          gait = { phase: person.offset, weight: 0 };
          this.gaits.set(i, gait);
        }
        const cycle = citizenGait(gait, p, moving, dt, this.paused, reduced);
        pose.morphTargetInfluences!.fill(0);
        pose.morphTargetInfluences![cycle.frame] = cycle.first;
        pose.morphTargetInfluences![cycle.next] = cycle.second;
        if (pose.morphTargetInfluences!.length >= 10) {
          pose.morphTargetInfluences![8] = cycle.idleFirst;
          pose.morphTargetInfluences![9] = cycle.idleSecond;
        }
        mesh.setMorphAt(index, pose);
        transform(mesh, index, p.x, this.plan ? 0.146 : 0.112, p.z, p.angle);
      }
      const step = reduced || !moving ? 0 : Math.sin(this.elapsed * 7 + i) * 0.3;
      this.personParts.forEach((mesh, part) =>
        transform(
          mesh,
          i,
          p.x,
          this.plan ? 0.146 : 0.112,
          p.z,
          p.angle,
          part === 2 ? step : part === 3 ? -step : 0,
          !this.modelPeople[i % 2],
        ),
      );
    });
    this.drivers.forEach((car, i) => {
      const trip = this.vehicleJourneys?.actors[i];
      let p = trip
        ? { ...trip.position, angle: trip.angle }
        : pathPoint(car.offset, car.cx, car.cz, car.radius);
      if (!trip) {
        if (!this.paused && !reduced && Math.hypot(p.x - player.x, p.z - player.z) > 1.5)
          car.offset += (dt * car.speed) / (8 * car.radius);
        p = pathPoint(car.offset, car.cx, car.cz, car.radius);
      }
      if (!this.plan && this.orders.some((order) => Math.hypot(order.x - p.x, order.z - p.z) < 2)) {
        const shift = Math.min(0.55, 12.55 - car.radius);
        if (Math.abs(p.x - car.cx) > Math.abs(p.z - car.cz)) p.x += Math.sign(p.x - car.cx) * shift;
        else p.z += Math.sign(p.z - car.cz) * shift;
      }
      if (this.modelCars[i % 2]) {
        const mesh = this.modelCars[i % 2];
        transform(mesh, mesh.count++, p.x, this.plan ? 0.112 : 0.035, p.z, p.angle);
      }
      transform(this.shadows[1], i, p.x, this.plan ? 0.116 : 0.039, p.z, p.angle);
      this.carParts.forEach((mesh) =>
        transform(mesh, i, p.x, this.plan ? 0.112 : 0.035, p.z, p.angle, 0, !this.modelCars[i % 2]),
      );
    });
    if (this.carParts.length) {
      (this.carParts[3].material as T.MeshStandardMaterial).emissiveIntensity = night ? 2 : 0.3;
      (this.carParts[4].material as T.MeshStandardMaterial).emissiveIntensity = night ? 1.3 : 0.2;
    }
    this.batches.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.morphTexture) mesh.morphTexture.needsUpdate = true;
    });
  }
  private disposeObject(group: T.Object3D) {
    group.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((m) => m.dispose());
      }
    });
  }
  dispose() {
    this.disposed = true;
    const textures = new Set<T.Texture>();
    this.group.traverse((o) => {
      if (o instanceof T.Mesh) {
        for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
          if (material.map) textures.add(material.map);
        }
        if (o instanceof T.InstancedMesh) o.dispose();
      }
    });
    textures.forEach((t) => t.dispose());
    this.disposeObject(this.group);
    this.group.clear();
    this.group.removeFromParent();
  }
}
