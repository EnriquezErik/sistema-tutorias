# Sistema de Tutorías v42 — Versión 1.7.14

## Objetivo

Mantener accesibles las opciones del menú de Administración mientras se consulta contenido extenso.

## Cambio aplicado

- La barra con **Inicio**, **Estadísticas**, **Historial y reportes**, **Catálogos**, **Seguridad** y **Actualizar datos** permanece fija en la parte superior durante el desplazamiento.
- El encabezado institucional se desplaza normalmente para conservar espacio útil.
- Se incorporaron fondo, borde y sombra para separar el menú del contenido.
- En teléfonos y tablets pequeñas, el menú se presenta en una sola fila horizontal desplazable.
- Se añadió enfoque visible para navegación mediante teclado.
- La barra permanece oculta durante la impresión.

## Alcance

La modificación afecta únicamente la presentación de la navegación administrativa. No modifica Registro de Asesorías, base de datos, autenticación, estadísticas, exportaciones, impresión, catálogos ni filtros.

## Archivos actualizados

- `styles.css`
- `admin.js`
- `admin.html`
- `package.json`
- `package-lock.json`
- `README.md`
- `GUIA_DEL_CODIGO.md`
- `tests/responsive-check.js`

## Validación posterior al despliegue

1. Confirmar que Administración muestre **Versión 1.7.14**.
2. Actualizar con `Ctrl + F5`.
3. Abrir un apartado con contenido extenso y desplazarse hacia abajo.
4. Comprobar que el menú permanezca visible.
5. Probar el desplazamiento horizontal del menú en teléfono y tablet.
6. Confirmar que la barra no aparezca al imprimir.

---

**Fecha:** 11 de noviembre de 2026.  
**Versión:** 1.7.14.  
**Base funcional:** Sistema de Tutorías v42.
