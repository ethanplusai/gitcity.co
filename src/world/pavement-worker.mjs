import { pavement } from './street-pavement.mjs';
import { unpackPavement } from './pavement-transfer.mjs';

export class PavementWorker {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.sequence = 0;
    this.disabled = false;
  }
  prepare(graph) {
    if (this.disabled || pavement.has(graph) || typeof Worker === 'undefined')
      return Promise.resolve(false);
    if (!this.worker) {
      try {
        this.worker = new Worker(new URL('./pavement.worker.mjs', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = ({ data }) => {
          const request = this.pending.get(data.id);
          if (!request) return;
          clearTimeout(request.timer);
          this.pending.delete(data.id);
          if (data.error) {
            request.resolve(false);
            return;
          }
          try {
            const parts = unpackPavement(data.parts);
            const retained = pavement.prime(request.graph, parts);
            if (!retained) for (const [, geometry] of parts) geometry.dispose();
            request.resolve(retained);
          } catch {
            request.resolve(false);
            this.dispose();
          }
        };
        this.worker.onerror = () => this.dispose();
        this.worker.onmessageerror = () => this.dispose();
      } catch {
        this.disabled = true;
        return Promise.resolve(false);
      }
    }
    return new Promise((resolve) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => this.dispose(), 15000);
      this.pending.set(id, { graph, resolve, timer });
      try {
        this.worker.postMessage({ id, graph });
      } catch {
        this.dispose();
      }
    });
  }
  dispose() {
    this.disabled = true;
    this.worker?.terminate();
    this.worker = null;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.resolve(false);
    }
    this.pending.clear();
  }
}
