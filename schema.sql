-- Tabla 1: Profesores / Tutores
CREATE TABLE Tutores (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Activo'
);

-- Tabla 2: Catálogo de Alumnos
CREATE TABLE Alumnos (
    matricula VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    sexo VARCHAR(20),
    carrera VARCHAR(100),
    grupo VARCHAR(20)
);

-- Tabla 3: Registro de Tutorías
CREATE TABLE Tutorias (
    id INT IDENTITY(1,1) PRIMARY KEY,
    profesor VARCHAR(150) NOT NULL,
    matricula VARCHAR(20) NOT NULL,
    nombre_alumno VARCHAR(150) NOT NULL,
    sexo VARCHAR(20),
    carrera VARCHAR(100),
    grupo VARCHAR(20),
    turno VARCHAR(20),
    motivos VARCHAR(100),
    canalizacion VARCHAR(10),
    observaciones TEXT,
    fecha_registro DATETIME DEFAULT GETDATE()
);

-- Tutores iniciales de prueba (como en la captura)
INSERT INTO Tutores (nombre) VALUES
('ANDREA'), ('CRISTOBAL'), ('ERIK'), ('JOSÉ LUIS'), ('JUAN CARLOS');
