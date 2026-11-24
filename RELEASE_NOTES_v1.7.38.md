# v1.7.38 — Corrección de logo IEHL
- Se añade exclusivamente logo-iehl.jpg a PUBLIC_FILES en server.js. La versión anterior incluía la imagen pero la ruta no estaba autorizada.
- CSS adaptable: logotipo visible en ambas páginas, sin deformación, en anchos pequeños y grandes.
- Referencias de versión actualizadas. Sin cambios de autenticación, TLS, consultas ni migraciones.
- No se modifica Render, GitHub ni Supabase. Conservar NODE_EXTRA_CA_CERTS y el certificado configurado.
- Pendiente: comprobación del despliegue real y dispositivos físicos. Los hallazgos de auditoría anteriores no se cierran con esta actualización visual.
