import { BufferGeometry, BufferAttribute } from 'three';
export function packPavement(parts) {
  return parts.map(([bucket, geometry]) => [
    bucket,
    {
      index: geometry.index.array,
      attributes: Object.fromEntries(
        Object.entries(geometry.attributes).map(([name, attribute]) => [
          name,
          {
            array: attribute.array,
            itemSize: attribute.itemSize,
            normalized: attribute.normalized,
          },
        ]),
      ),
    },
  ]);
}
export function unpackPavement(parts) {
  return parts.map(([bucket, data]) => {
    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(data.index, 1));
    for (const [name, attribute] of Object.entries(data.attributes))
      geometry.setAttribute(
        name,
        new BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized),
      );
    return [bucket, geometry];
  });
}
export function pavementBuffers(parts) {
  return parts.flatMap(([, data]) => [
    data.index.buffer,
    ...Object.values(data.attributes).map((a) => a.array.buffer),
  ]);
}
