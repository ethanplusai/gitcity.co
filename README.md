# gitcity

See any GitHub repo as an isometric pixel art city.

**[gitcity.co](https://gitcity.co)**

## How It Works

Enter any public GitHub repo and watch it transform into a living isometric city. Every file becomes a building, every directory becomes a city block, and the roads connect it all together.

### File → Building Mapping

| File Type | Building Style |
|-----------|---------------|
| `.ts/.tsx` | Modern offices & towers |
| `.js/.jsx` | Commercial shops |
| `.py` | Universities & schools |
| `.go/.rs/.c` | Industrial factories |
| `.css/.scss` | Colorful mansions |
| `.json/.yaml` | Small shops & warehouses |
| `.md/.txt` | Parks & green spaces |
| Entry files (`index`, `main`) | City landmarks |

### URL Trick

Just swap `github.com` with `gitcity.co` in your browser bar:

```
github.com/facebook/react  →  gitcity.co/facebook/react
```

## Features

- **Instant city generation** from any public GitHub repo
- **IsoCity-quality rendering** — buildings, roads, vehicles, water, trees
- **Staggered build animation** — watch buildings rise one by one
- **File details on hover** — see path, type, lines, and size
- **Share** — every city has a shareable URL
- **Screenshot** — download your city as a PNG
- **Session caching** — revisit repos instantly
- **Performance capped** — handles repos up to 500 files smoothly

## Try It

```
gitcity.co/facebook/react
gitcity.co/vercel/next.js
gitcity.co/denoland/deno
gitcity.co/rust-lang/rust
gitcity.co/sveltejs/svelte
```

## Tech Stack

- Next.js + React + TypeScript
- Canvas 2D multi-layered rendering (forked from [IsoCity](https://github.com/amilich/isometric-city), MIT)
- GitHub Git Trees API (no auth needed for public repos)

## Development

```bash
npm install
npm run dev
```

## License

MIT
