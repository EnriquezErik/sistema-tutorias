const express = require('express');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path'); // Módulo imprescindible para rutas en Linux

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const EXCEL_FILE = path.join(__dirname, 'registro_tutorias.xlsx');
const TUTORES_FILE = path.join(__dirname, 'tutores.json');

// Inicializar archivo de tutores si no existe
if (!fs.existsSync(TUTORES_FILE)) {
    const tutoresIniciales = [
        "ANDREA", "CRISTOBAL", "ERIK", "JOSÉ LUIS", "JUAN CARLOS", "MIGUEL", "XIMENA"
    ];
    fs.writeFileSync(TUTORES_FILE, JSON.stringify(tutoresIniciales, null, 2));
}

// Ruta Principal -> Formulario de Registro
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'registro.html'), (err) => {
        if (err) res.status(500).send("Error al cargar registro.html. Verifique que el nombre del archivo sea exacto (minúsculas).");
    });
});

// Ruta Panel Administrativo -> Dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'), (err) => {
        if (err) res.status(500).send("Error al cargar admin.html. Verifique el nombre del archivo en el repositorio.");
    });
});

// API Endpoints
app.get('/api/tutores', (req, res) => {
    try {
        const data = fs.readFileSync(TUTORES_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'Error al leer tutores' });
    }
});

app.post('/api/tutores', (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    try {
        const tutores = JSON.parse(fs.readFileSync(TUTORES_FILE, 'utf8'));
        const nombreMayus = nombre.toUpperCase();
        if (!tutores.includes(nombreMayus)) {
            tutores.push(nombreMayus);
            fs.writeFileSync(TUTORES_FILE, JSON.stringify(tutores, null, 2));
        }
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar tutor' });
    }
});

app.delete('/api/tutores', (req, res) => {
    const { nombre } = req.body;
    try {
        let tutores = JSON.parse(fs.readFileSync(TUTORES_FILE, 'utf8'));
        tutores = tutores.filter(t => t !== nombre);
        fs.writeFileSync(TUTORES_FILE, JSON.stringify(tutores, null, 2));
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar tutor' });
    }
});

app.get('/api/tutorias', (req, res) => {
    try {
        if (!fs.existsSync(EXCEL_FILE)) {
            return res.json([]);
        }
        const workbook = XLSX.readFile(EXCEL_FILE);
        const worksheet = workbook.Sheets['Tutorias'];
        const rows = worksheet ? XLSX.utils.sheet_to_json(worksheet) : [];
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al leer el archivo de Excel' });
    }
});

app.post('/api/tutorias', (req, res) => {
    const data = req.body;
    let workbook;
    let worksheet;

    if (fs.existsSync(EXCEL_FILE)) {
        workbook = XLSX.readFile(EXCEL_FILE);
        worksheet = workbook.Sheets['Tutorias'];
    } else {
        workbook = XLSX.utils.book_new();
        worksheet = XLSX.utils.json_to_sheet([]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tutorias');
    }

    const ahora = new Date();
    const fechaHoraAutomatica = ahora.toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const rows = worksheet ? XLSX.utils.sheet_to_json(worksheet) : [];
    rows.push({
        "Fecha y Hora": fechaHoraAutomatica,
        "Matrícula": data.matricula || 'N/A',
        "Nombre del alumno": data.nombre,
        "Sexo": data.sexo,
        "Carrera": data.carrera,
        "Grupo": data.grupo,
        "Turno": data.turno,
        "Tutor que atiende": data.tutor,
        "Motivos de la tutoría": data.motivo,
        "Canalización a psicopedagogía": data.canalizacion,
        "Comentarios": data.comentarios
    });

    const newWorksheet = XLSX.utils.json_to_sheet(rows);
    workbook.Sheets['Tutorias'] = newWorksheet;
    XLSX.writeFile(workbook, EXCEL_FILE);

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
});
