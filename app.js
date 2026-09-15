// Escuchamos cuando el usuario termina de escribir la matrícula y sale del campo (evento 'blur')
const inputMatricula = document.getElementById('input-matricula'); // Asegúrate de asignar este ID en tu HTML

if (inputMatricula) {
    inputMatricula.addEventListener('blur', async () => {
        const matricula = inputMatricula.value.trim();
        if (!matricula) return;

        try {
            // Consultamos al servidor Node.js
            const respuesta = await fetch(`/api/alumnos/${matricula}`);
            const data = await respuesta.json();

            if (data.encontrado) {
                // Autocompletamos los campos existentes en tu interfaz sin alterar su diseño
                document.getElementById('nombre-alumno').value = data.alumno.nombre_completo;
                document.getElementById('sexo-alumno').value = data.alumno.sexo;
                document.getElementById('carrera-alumno').value = data.alumno.carrera;
                document.getElementById('grupo-alumno').value = data.alumno.grupo;
            } else {
                // Si es alumno nuevo, dejamos los campos libres para el registro de primera vez
                console.log("Alumno no encontrado. Es un registro nuevo.");
            }
        } catch (error) {
            console.error("Error de conexión con el servidor", error);
        }
    });
}
