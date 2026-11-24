# Arquitectura y mantenimiento — Humanidades v1.7.30

Flujo: navegador → HTTPS → Node.js (server.js, Render) → TLS PostgreSQL (Supabase). GitHub aloja código, no datos. La futura red universitaria sustituirá alojamiento y base según autorización.

| Archivo | Responsabilidad |
|---|---|
| index.html / app.js | Registro, sesión, borradores, correcciones |
| admin.html / admin.js | Catálogos, reportes, bitácora, expedientes, indicadores y comparación |
| styles.css | Diseño compartido |
| exceljs.min.js | Exportación local |
| server.js | HTTP, autenticación, validación, transacciones y acceso SQL |
| database/ | Migraciones numeradas |
| tests/ | Regresión estática y simulaciones |
| render.yaml / .env.example | Despliegue y configuración sin secretos |

Mapa de server.js (buscar por nombre): schemaCapabilities y databaseHealth: diagnóstico; apiLogin, requireAdmin, requireSession: acceso; apiDraft: borradores; apiCreateAdvisory y apiCorrectAdvisory: escritura; apiAdminData, apiAdminAdvisoriesPage y apiAdminStatistics: consultas; apiAdminAudit y apiRestoreAdvisory: auditoría; startServer y shutdown: ciclo de vida. Los módulos funcionales siguen en el mismo archivo para evitar una refactorización de alto riesgo antes de validar la integración. Separación futura: configuración, autenticación, repositorios, servicios, rutas; hacer una extracción por vez con pruebas reales.

No exponer archivos internos ni secretos. Revisar PUBLIC_FILES si se agregan recursos web. El panel reúne todas las páginas en memoria; no es paginación visual completa. Las consultas por offset pueden variar ante escrituras concurrentes. Evaluar consultas agregadas y paginación por cursor tras establecer una línea base de rendimiento.
