# v1.7.20 — Corrección puntual de horarios
- La edición sin cambios de horario conserva los instantes originales, incluidos milisegundos.
- Los cambios de horario finalizado se validan contra el reloj del servidor, con tolerancia de cinco minutos ya usada al registrar asesorías. Se mantiene el límite de 12 horas y el cuatrimestre original.
- Mensajes diferenciados; ajuste en curso conserva validación local con tolerancia equivalente.
- Sin cambios SQL. Requiere migración 006 previamente aplicada.
- Pruebas locales de regresión; pendiente validación real en navegador y Supabase.
