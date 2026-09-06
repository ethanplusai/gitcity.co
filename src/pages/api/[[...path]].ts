import type { NextApiRequest, NextApiResponse } from 'next';
import { getApi } from '../../../server/services.mjs';
export const config = { api: { bodyParser: false, externalResolver: true } };
export const maxDuration = 300;
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const api = await getApi();
    if (req.url?.startsWith('/api/auth/')) req.url = req.url.replace('/api/auth/', '/auth/');
    await new Promise<void>((resolve) => {
      res.once('finish', resolve);
      res.once('close', resolve);
      api(req, res);
    });
  } catch {
    if (!res.headersSent)
      res
        .status(503)
        .json({ error: 'City services are not configured yet. Please try again shortly.' });
  }
}
