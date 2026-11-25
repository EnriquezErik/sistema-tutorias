# v1.7.43 — 24/11/2026
Base v1.7.42. Candidata, no liberación definitiva.
- P-03: bloqueo de cuadrícula, acciones y controles de asesor durante guardado/cierre; restauración de estado inert en finally; diálogo protegido. Simulación aprobada, navegador pendiente.
- P-04: Node 22.x declarado en manifiesto y lockfile; entorno local 22.16.0. Revisar NODE_VERSION existente de Render; no se cambió producción.
- P-05: preflight de archivos, módulos reales y runtime, incorporado al build declarado en render.yaml. npm ci offline falló ENOTCACHED; preflight no aprobado localmente por pg ausente. Si Render se configuró manualmente, ajustar build command a npm ci --omit=dev && npm run verify:deploy antes de liberar. Subir scripts/verify-deploy.js y lib completos.
- P-06: preflight verifica formato y vigencia de CA indicada por NODE_EXTRA_CA_CERTS, documentación ampliada. Certificado real y conexión no probados; no modificar configuración funcional.
- N-06: gzip negociado para respuesta administrativa grande; datos íntegros. Conserva carga completa, escalabilidad parcial. Compresión síncrona, evaluar CPU con volumen real.
- N-07: 60 s en ambos navegadores, mensaje de resultado incierto al fallar guardado; no limita transacción global ni cancela operación SQL, parcial.
- N-08: fecha de corte requerida para offset no cero y cursor; rechazo de corte futuro (tolerancia 60 s). No congela modificaciones entre páginas, parcial.
- CSS y nueve migraciones intactos. No se accedió a producción. P-07 y N-10 fuera del alcance.
