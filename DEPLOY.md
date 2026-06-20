# Despliegue — GitHub + Vercel

## Arquitectura

- **Vercel**: frontend (Vite SPA) + funciones serverless `/api` (OCR/clasificador con la key de OpenRouter como env var).
- **Google Apps Script**: backend de datos (Sheets/Drive) — se despliega aparte en la cuenta del contador.
- **Worker DIAN** (Node + Playwright, CAPTCHA humano): corre fuera de Vercel (máquina del contador / VPS).

## 1. Subir a GitHub

El repo ya está inicializado localmente. Para subirlo:

```bash
# Re-autentica gh (el token actual está vencido):
gh auth login

# Crea el repo y súbelo (privado recomendado):
gh repo create recepcion-co --private --source=. --remote=origin --push
```

> Alternativa sin gh: crea el repo en github.com y luego:
> `git remote add origin git@github.com:<usuario>/recepcion-co.git && git push -u origin main`

## 2. Conectar Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo `recepcion-co`.
2. Vercel detecta **Vite** automáticamente (build `vite build`, output `dist`).
3. En **Environment Variables** agrega:
   - `OPENROUTER_API_KEY` = (tu key de OpenRouter)
4. **Deploy**. Cada `git push` a `main` vuelve a desplegar solo.

## 3. Seguridad

- La key `OPENROUTER_API_KEY` **solo** la leen las funciones `/api` (servidor). El navegador nunca la ve.
- `.env` está en `.gitignore` (no se sube). En producción la fuente de la key es Vercel.
- Ponle **límite de gasto** a la key en OpenRouter y **rótala** periódicamente.

## Estado actual

- ✅ Frontend (demo con datos de prueba) — desplegable ya.
- ⏳ Funciones `/api/ocr` y `/api/clasificar` — se agregan al wirear OpenRouter.
- ⏳ Apps Script (Sheets/Drive) — desplegar en la cuenta del contador (ver `apps-script/`).
