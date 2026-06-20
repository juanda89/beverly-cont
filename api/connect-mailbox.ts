import type { VercelRequest, VercelResponse } from '@vercel/node'

// Crea una credencial IMAP en n8n con el correo + app password del contador.
// El contador nunca sale de la web: pega la clave aquí y la guardamos cifrada
// en n8n vía su API. NUNCA se loguea ni se persiste de nuestro lado.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }
  const base = process.env.N8N_BASE_URL
  const key = process.env.N8N_API_KEY
  if (!base || !key) {
    res.status(500).json({ error: 'Falta configuración de n8n (N8N_BASE_URL / N8N_API_KEY)' })
    return
  }
  try {
    const { proyectoId, proyectoNombre, tipo, email, appPassword } = (req.body || {}) as {
      proyectoId?: string
      proyectoNombre?: string
      tipo?: 'facturas' | 'dian'
      email?: string
      appPassword?: string
    }
    if (!email || !appPassword) {
      res.status(400).json({ error: 'Falta el correo o la contraseña de aplicación' })
      return
    }
    const etiqueta = tipo === 'dian' ? 'token DIAN' : 'facturas'
    const r = await fetch(`${base}/api/v1/credentials`, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Recepción · ${proyectoNombre || proyectoId || 'proyecto'} · ${etiqueta}`,
        type: 'imap',
        data: {
          user: email,
          password: appPassword, // se entrega directo a n8n; n8n lo cifra
          host: 'imap.gmail.com',
          port: 993,
          secure: true,
        },
      }),
    })
    if (!r.ok) {
      throw new Error(`n8n credencial: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`)
    }
    const cred = (await r.json()) as { id?: string }
    res.status(200).json({ ok: true, credentialId: cred.id, email })
  } catch (e) {
    res.status(500).json({ error: String((e as Error)?.message || e) })
  }
}
