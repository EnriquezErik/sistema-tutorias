const express = require('express');
const cors = require('cors');
const sql = require('mssql');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Sirve archivos estáticos (html, js, css)

// Configuración de conexión a SQL Server
const dbConfig = {
    user: process.env.DB_USER || 'tu_usuario',
    password: process.env.DB_PASSWORD || 'tu_contraseña',
    server: process.env.DB_SERVER || 'tu_servidor.database.windows.net',
    database: process.env.DB_NAME || 'tu_base_datos',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

// 📌 API 1: Obtener datos de alumno por Matrícula
app.get('/api/alumnos/:matricula', async (req, res) => {
    try {
        const { matricula } = req.params;
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('matricula', sql.VarChar, matricula)
            .query('SELECT matricula, nombre, sexo, carrera, grupo FROM Alumnos WHERE matricula = @matricula');

        if (result.recordset.length > 0) {
            res.json({ success: true, alumno: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Alumno no encontrado en el catálogo.' });
        }
    } catch (error) {
        console.error("Error al buscar alumno:", error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// 📌 API 2: Registrar una nueva sesión de Tutoría
app.post('/api/tutorias', async (req, res) => {
    try {
        const { profesor, matricula, nombre, sexo, carrera, grupo, turno, motivos, canalizacion, observaciones } = req.body;

        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('profesor', sql.VarChar, profesor)
            .input('matricula', sql.VarChar, matricula)
            .input('nombre', sql.VarChar, nombre)
            .input('sexo', sql.VarChar, sexo)
            .input('carrera', sql.VarChar, carrera)
            .input('grupo', sql.VarChar, grupo)
            .input('turno', sql.VarChar, turno)
            .input('motivos', sql.VarChar, motivos)
            .input('canalizacion', sql.VarChar, canalizacion)
            .input('observaciones', sql.Text, observaciones)
            .query(`INSERT INTO Tutorias (profesor, matricula, nombre_alumno, sexo, carrera, grupo, turno, motivos, canalizacion, observaciones)
                    VALUES (@profesor, @matricula, @nombre, @sexo, @carrera, @grupo, @turno, @motivos, @canalizacion, @observaciones)`);

        res.json({ success: true, message: '¡Tutoría registrada exitosamente!' });
    } catch (error) {
        console.error("Error al guardar tutoría:", error);
        res.status(500).json({ success: false, message: 'No se pudo guardar el registro.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Tutorías ejecutándose en http://localhost:${PORT}`);
});
