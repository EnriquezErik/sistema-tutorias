# v1.7.46 — Corrección de arranque

Base: v1.7.45. Se integra literalmente la fábrica HTTP en server.js, utilizando path ya importado. Se elimina lib/http-response.js y su requisito del preflight. Los tests ejercitan la fábrica del servidor y el arranque sin el archivo. Q-01–Q-04 y las diez migraciones permanecen conservadas. No se cambian app.js, CSS ni render.yaml.

## Despliegue
Conservar lib/pagination.js y lib/draft-period.js, scripts/verify-deploy.js y la estructura del repositorio. Validar y aplicar migración 010 si aún no está aplicada; no repetir las anteriores. Mantener TLS. Build: npm ci --omit=dev && npm run verify:deploy. La instalación de dependencias reales y validación en Render/Supabase quedan pendientes.
