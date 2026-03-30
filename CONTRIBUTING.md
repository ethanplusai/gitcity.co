# Contributing to gitcity

Thanks for your interest in contributing! gitcity is an open source project and we welcome contributions of all kinds.

## Ways to Contribute

### Report Bugs
Found a repo that doesn't render correctly? A building that overflows? A crash on a specific repo? Open an issue with:
- The repo URL you tried (e.g. `gitcity.co/owner/repo`)
- What you expected to see
- What actually happened
- Screenshot if possible

### Suggest Features
Have an idea? Open an issue tagged `enhancement`. Some things we're thinking about:
- GitHub OAuth for private repos
- "Profile cities" — your entire GitHub as one city
- Time travel — watch how a city grew over git history
- More building variety and themes
- Embed snippets for READMEs
- Mobile support improvements

### Submit Code
1. Fork the repo
2. Create a branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test locally (`npm run dev`)
5. Commit with a clear message
6. Push and open a PR

### Improve Building Mappings
The file-type-to-building mapping is in `src/lib/city-generator.ts`. If you think a file type should map to a different building, or want to add support for a new language, PRs are welcome.

## Development Setup

```bash
git clone https://github.com/ethanplusai/gitcity.git
cd gitcity
npm install
npm run dev
```

Open http://localhost:3000 and try entering a repo.

## Architecture

- **Next.js + React + TypeScript** — app framework
- **IsoCity rendering engine** — forked from [amilich/isometric-city](https://github.com/amilich/isometric-city) (MIT), handles all the isometric canvas rendering
- **GitHub Git Trees API** — fetches repo file structure (no auth needed for public repos)
- **City generator** (`src/lib/city-generator.ts`) — transforms file trees into city grids
- **City viewer** (`src/components/CityViewer.tsx`) — React wrapper around the rendering engine

## Code Style

- TypeScript strict mode
- Functional React components with hooks
- No external state management (React context + refs)
- Keep bundle size small — no unnecessary dependencies

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
