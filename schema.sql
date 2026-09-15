CREATE TABLE IF NOT EXISTS registros (
    id SERIAL PRIMARY KEY,
    nombre_alumno VARCHAR(150) NOT NULL,
    sexo VARCHAR(20) NOT NULL,
    carrera VARCHAR(50) NOT NULL,
    grupo VARCHAR(20) NOT NULL,
    turno VARCHAR(20) NOT NULL,
    tutor VARCHAR(100) NOT NULL,
    duracion VARCHAR(50),
    motivo VARCHAR(100) NOT NULL,
    canalizacion_psicopedagogia VARCHAR(5) NOT NULL,
    comentarios TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios_admin (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);

-- Índices de alto rendimiento para consultas históricas rápidas (10+ años)
CREATE INDEX IF NOT EXISTS idx_fecha_registro ON registros(fecha_registro);
CREATE INDEX IF NOT EXISTS idx_carrera ON registros(carrera);
CREATE INDEX IF NOT EXISTS idx_tutor ON registros(tutor);
CREATE INDEX IF NOT EXISTS idx_nombre_alumno ON registros(nombre_alumno);
