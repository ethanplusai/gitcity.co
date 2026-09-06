// Next's catch-all route parameters must not replace API query parameters.
// Express receives only the query encoded in the actual request URL.
export function requestQuery(url) {
  const result = Object.create(null);
  for (const [key, value] of new URL(url || '/', 'http://localhost').searchParams) {
    const previous = result[key];
    result[key] =
      previous === undefined
        ? value
        : Array.isArray(previous)
          ? [...previous, value]
          : [previous, value];
  }
  return result;
}
