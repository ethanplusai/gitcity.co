# gitcity

See any GitHub repo as an isometric pixel art city.

**[gitcity.co](https://gitcity.co)**

![gitcity](https://img.shields.io/badge/gitcity-see%20your%20code%20as%20a%20city-blue)

## How It Works

Enter any public GitHub repo and watch it transform into a living isometric city. Every file becomes a building, every directory becomes a city block, and the roads connect it all together.

Just swap `github.com` with `gitcity.co` in your URL bar:

```
github.com/facebook/react  →  gitcity.co/facebook/react
```

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
| Test files | Recreation areas |
| CI/CD configs | Fire stations |
| Entry files (`index`, `main`) | City landmarks |

Bigger files = taller buildings. The largest file in your repo becomes the city's main landmark.

## Features

- **Instant city generation** from any public GitHub repo
- **Isometric rendering** with buildings, roads, vehicles, water, and trees
- **Staggered build animation** — watch buildings construct one by one
- **File details on hover** — see path, type, lines, and size
- **Shareable URLs** — every city has a link you can share
- **Screenshot export** — download your city as a PNG
- **Session caching** — revisit repos instantly

## Try It

- [facebook/react](https://gitcity.co/facebook/react)
- [sveltejs/svelte](https://gitcity.co/sveltejs/svelte)
- [denoland/deno](https://gitcity.co/denoland/deno)
- [golang/go](https://gitcity.co/golang/go)
- [microsoft/typescript](https://gitcity.co/microsoft/typescript)

## Tech Stack

- Next.js + React + TypeScript
- Canvas 2D multi-layered rendering
- GitHub Git Trees API

## Development

```bash
git clone https://github.com/ethanplusai/gitcity.git
cd gitcity
npm install
npm run dev
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Acknowledgments

The isometric rendering engine is forked from [IsoCity](https://github.com/amilich/isometric-city) by Andrew Milich (MIT licensed).

## License

MIT
