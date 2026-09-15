const express = require('express');
const cors = require('cors');
const sql = require('mssql');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const dbConfig = {
    user: process.env.DB_USER || 'tu_usuario',
    password: process.env.DB_PASSWORD || 'tu_password',
    server: process.env.DB_SERVER || 'tu_servidor.database.windows.net',
    database: process.env.DB_NAME || 'tu_bd',
    options: { encrypt: true, trustServerCertificate: true }
};

// --- ENDPOINTS TUTORES ---
app.get('/api/tutores', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query('SELECT * FROM Tutores ORDER BY nombre ASC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tutores', async (req, res) => {
    try {
        const { nombre } = req.body;
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .query("INSERT INTO Tutores (nombre, estado) VALUES (@nombre, 'Activo')");
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tutores/:id', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query("DELETE FROM Tutores WHERE id = @id");
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ENDPOINT CONSULTA ALUMNO ---
app.get('/api/alumnos/:matricula', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('matricula', sql.VarChar, req.params.matricula)
            .query('SELECT matricula, nombre, sexo, carrera, grupo FROM Alumnos WHERE matricula = @matricula');

        if (result.recordset.length > 0) {
            res.json({ success: true, alumno: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Alumno no hallado' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ENDPOINTS TUTORÍAS ---
app.get('/api/tutorias', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query('SELECT * FROM Tutorias ORDER BY fecha_registro DESC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tutorias', async (req, res) => {
    try {
        const { profesor, matricula, nombre, sexo, carrera, grupo, turno, motivos, canalizacion, observaciones } = req.body;
        let pool = await sql.connect(dbConfig);

        // 1. Guardar o actualizar datos de alumno en catálogo
        await pool.request()
            .input('mat', sql.VarChar, matricula)
            .input('nom', sql.VarChar, nombre)
            .input('sex', sql.VarChar, sexo)
            .input('car', sql.VarChar, carrera)
            .input('gru', sql.VarChar, grupo)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM Alumnos WHERE matricula = @mat)
                    INSERT INTO Alumnos (matricula, nombre, sexo, carrera, grupo) VALUES (@mat, @nom, @sex, @car, @gru)
                ELSE
                    UPDATE Alumnos SET nombre=@nom, sexo=@sex, carrera=@car, grupo=@gru WHERE matricula=@mat
            `);

        // 2. Registrar Tutoría
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
            .input('observaciones', sql.Text, observaciones || '')
            .query(`
                INSERT INTO Tutorias (profesor, matricula, nombre_alumno, sexo, carrera, grupo, turno, motivos, canalizacion, observaciones)
                VALUES (@profesor, @matricula, @nombre, @sexo, @carrera, @grupo, @turno, @motivos, @canalizacion, @observaciones)
            `);

        res.json({ success: true, message: '¡Tutoría registrada exitosamente!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- ENDPOINT ESTADÍSTICAS DASHBOARD ---
app.get('/api/stats', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const totalAlumnos = await pool.request().query('SELECT COUNT(DISTINCT matricula) AS total FROM Tutorias');
        const tutoresActivos = await pool.request().query("SELECT COUNT(*) AS total FROM Tutores WHERE estado = 'Activo'");
        const canalizados = await pool.request().query("SELECT COUNT(*) AS total FROM Tutorias WHERE canalizacion = 'Sí'");

        res.json({
            totalAlumnos: totalAlumnos.recordset[0].total,
            tutoresActivos: tutoresActivos.recordset[0].total,
            canalizados: canalizados.recordset[0].total
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
