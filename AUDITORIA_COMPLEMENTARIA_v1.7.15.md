# Auditoría complementaria — Sistema de Tutorías v42 / base v1.7.15

Fecha: 23 de noviembre de 2026.

## Alcance
Revisión estática de los archivos fuente de la versión v1.7.15, migraciones SQL, pruebas incluidas y consistencia de seguridad. No se conectó a PostgreSQL/Supabase ni se modificó información institucional.

## Cambios implementados en esta entrega
- Lectura tolerante a cookies con escapes porcentuales malformados.
- Validación estricta de estructura, longitud y firma del token de sesión, y de su identidad, rol y vencimiento.
- Normalización y comprobación de IP para auditoría; solo se utiliza X-Forwarded-For si TRUST_PROXY=true, lo que requiere configurar la infraestructura de proxy de confianza.
- Respuesta HTTP 400 para URLs inválidas antes del enrutamiento.
- Límite de acumulación del cuerpo JSON una vez detectado el tamaño máximo.

## Comprobaciones ejecutadas
- `npm test`: salida satisfactoria (10 pruebas de comprobación; además de sintaxis de 3 archivos JS).
- Identificadores HTML: index.html 37 y admin.html 110; sin duplicados.
- Migraciones 001 a 005: no se detectó `DROP TABLE` ni `TRUNCATE` mediante búsqueda textual.
- Se conservaron las páginas y los recursos visuales originales.

## Hallazgos y riesgos pendientes
1. **Alta — Paginación de extremo a extremo.** `admin.js` aún solicita `/api/admin/data`, cuya respuesta incluye todas las asesorías. Los servicios `/api/admin/advisories` y `/api/admin/statistics` están presentes, pero no sustituyen el flujo de la interfaz. Hay que diseñar paginación y exportación completa sin truncar resultados, con pruebas de carga.
2. **Alta — Validación en base de datos.** No se han ejecutado migraciones ni consultas en una copia aislada de PostgreSQL. La congruencia temporal, integridad de carrera/grupo, sesiones revocables y estadísticas necesitan pruebas reales.
3. **Media — Control persistente de intentos.** El código mantiene una alternativa en memoria si falla PostgreSQL; en varias instancias esta alternativa no equivale a bloqueo persistente. Debe decidirse una política de error seguro y ensayarla en entorno de prueba.
4. **Media — Proxy/IP.** Si el despliegue está detrás de Render, verificar TRUST_PROXY y encabezados confiables antes de activar la configuración; no confiar ciegamente en cabeceras suministradas por clientes.
5. **Media — Auditoría funcional.** Verificar permisos, cierres de sesión, revocación de contraseña, catálogos, exportación CSV/XLSX, impresión, accesibilidad y respuesta ante fallos.
6. **Media — Cobertura.** Las pruebas incluidas son mayormente estáticas y no sustituyen ensayos de navegador, carga o transacciones reales.
7. **Baja — Consistencia documental.** Se conservó el número v1.7.15 de la base; este paquete debe identificarse como revisión candidata, no liberación certificada.

## Dictamen
**Candidata para pruebas, no aprobada para publicación productiva.** Las pruebas automatizadas disponibles pasan, pero no hay evidencia suficiente para afirmar que todas las correcciones de fases 2 y 3 estén concluidas. Conservar la versión productiva y un respaldo verificable; realizar migraciones y pruebas exclusivamente sobre una copia de la base antes de publicar.
