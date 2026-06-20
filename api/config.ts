import type { VercelRequest, VercelResponse } from '@vercel/node'

// Expone solo datos públicos al frontend (el Client ID de OAuth es público;
// el Client Secret NUNCA se expone — no se usa en el flujo del navegador).
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' })
}
