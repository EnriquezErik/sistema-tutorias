const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_upsr';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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

// Ruta pública: Registro de asesoría
app.post('/api/registro', async (req, res) => {
  const { nombre_alumno, sexo, carrera, grupo, turno, tutor, duracion, motivo, canalizacion_psicopedagogia, comentarios } = req.body;

  try {
    const query = `
      INSERT INTO registros (nombre_alumno, sexo, carrera, grupo, turno, tutor, duracion, motivo, canalizacion_psicopedagogia, comentarios)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;
    `;
    const values = [nombre_alumno, sexo, carrera, grupo, turno, tutor, duracion, motivo, canalizacion_psicopedagogia, comentarios];
    const result = await pool.query(query, values);

    if (canalizacion_psicopedagogia === 'Sí' && process.env.EMAIL_USER) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_PSICOPEDAGOGIA || process.env.EMAIL_USER,
        subject: `Alerta: Canalización a Psicopedagogía - ${nombre_alumno}`,
        html: `
          <h3>Alerta de Canalización a Psicopedagogía</h3>
          <p><strong>Alumno:</strong> ${nombre_alumno}</p>
          <p><strong>Carrera:</strong> ${carrera} (${grupo} - ${turno})</p>
          <p><strong>Tutor atendió:</strong> ${tutor}</p>
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

// Ruta pública: Login de Administrador
app.post('/api/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (usuario === process.env.ADMIN && password === process.env.12345) {
    const token = jwt.sign({ usuario }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Credenciales incorrectas' });
});

// Ruta privada: Consulta e historial dinámico con filtros
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
