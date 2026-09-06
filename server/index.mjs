import express from 'express';
import next from 'next';
import { getApi } from './services.mjs';
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const app = express();
app.use(await getApi());
const nextApp = next({ dev: !production });
await nextApp.prepare();
app.use((req, res) => nextApp.getRequestHandler()(req, res));
const server = app.listen(port, () =>
  console.log(`Gitcity is open at ${process.env.APP_ORIGIN || `http://localhost:${port}`}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
