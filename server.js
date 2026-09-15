const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware para procesar JSON y servir archivos estáticos (HTML, CSS, JS)
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// Redirección de la raíz para evitar el error "Cannot GET /"
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'registro.html'));
});

// Configuración de conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_upsr';

// Configuración del servicio de correo electrónico
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Middleware de seguridad para validar el Token JWT
const verificarToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const bearer = token.split(' ')[1];
    const decoded = jwt.verify(bearer, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// 1. Ruta pública: Guardar una nueva asesoría
app.post('/api/registro', async (req, res) => {
  const {
    nombre_alumno, sexo, carrera, grupo, turno,
    tutor, duracion, motivo, canalizacion_psicopedagogia, comentarios
  } = req.body;

  try {
    const query = `
      INSERT INTO registros (
        nombre_alumno, sexo, carrera, grupo, turno,
        tutor, duracion, motivo, canalizacion_psicopedagogia, comentarios
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;
    `;
    const values = [
      nombre_alumno, sexo, carrera, grupo, turno,
      tutor, duracion, motivo, canalizacion_psicopedagogia, comentarios
    ];
   
    const result = await pool.query(query, values);

    // Enviar alerta por correo si el alumno es canalizado
    if (canalizacion_psicopedagogia === 'Sí' && process.env.EMAIL_USER) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_PSICOPEDAGOGIA || process.env.EMAIL_USER,
        subject: `Alerta: Canalización a Psicopedagogía - ${nombre_alumno}`,
        html: `
          <h3>Alerta de Canalización a Psicopedagogía</h3>
          <p><strong>Alumno:</strong> ${nombre_alumno}</p>
          <p><strong>Carrera:</strong> ${carrera} (${grupo} - ${turno})</p>
          <p><strong>Tutor que atendió:</strong> ${tutor}</p>
          <p><strong>Motivo:</strong> ${motivo}</p>
          <p><strong>Comentarios:</strong> ${comentarios || 'Sin comentarios adicionales.'}</p>
        `
      };
      transporter.sendMail(mailOptions, (err) => {
        if (err) console.error('Error enviando correo:', err);
      });
    }

    res.status(201).json({ mensaje: 'Registro guardado con éxito', data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar el registro' });
  }
});

// 2. Ruta pública: Autenticación del Administrador
app.post('/api/login', async (req, res) => {
  const { usuario, password } = req.body;

  // Usa las variables de Render o activa credenciales por defecto de respaldo
  const USER_VALIDO = process.env.ADMIN_USER || 'admin';
  const PASS_VALIDO = process.env.ADMIN_PASS || '12345';

  if (usuario === USER_VALIDO && password === PASS_VALIDO) {
    const token = jwt.sign({ usuario }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }
 
  res.status(401).json({ error: 'Credenciales incorrectas' });
});

// 3. Ruta privada: Consultas e historial con filtros avanzados
app.get('/api/registros', verificarToken, async (req, res) => {
  const { fecha_inicio, fecha_fin, carrera, tutor, busqueda } = req.query;
  let conditions = [];
  let values = [];

  if (fecha_inicio && fecha_fin) {
    values.push(`${fecha_inicio} 00:00:00`, `${fecha_fin} 23:59:59`);
    conditions.push(`fecha_registro BETWEEN $${values.length - 1} AND $${values.length}`);
  }
  if (carrera) {
    values.push(carrera);
    conditions.push(`carrera = $${values.length}`);
  }
  if (tutor) {
    values.push(tutor);
    conditions.push(`tutor = $${values.length}`);
  }
  if (busqueda) {
    values.push(`%${busqueda}%`);
    conditions.push(`nombre_alumno ILIKE $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT * FROM registros ${whereClause} ORDER BY fecha_registro DESC;`;

  try {
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar el historial' });
  }
});

// Inicialización del servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
