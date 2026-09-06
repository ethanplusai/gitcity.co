import { buildStreetPavement } from './street-pavement.mjs';
import { packPavement, pavementBuffers } from './pavement-transfer.mjs';
self.onmessage = ({ data }) => {
  try {
    const geometry = buildStreetPavement(data.graph);
    const parts = packPavement(geometry);
    self.postMessage({ id: data.id, parts }, { transfer: pavementBuffers(parts) });
    for (const [, item] of geometry) item.dispose();
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
