document.addEventListener('DOMContentLoaded', () => {

    // Detectar qué página se está cargando
    const isRegistroPage = !!document.getElementById('tutorForm');
    const isAdminPage = !!document.getElementById('tabla-tutores');

    // ==========================================
    // 1. LÓGICA DE REGISTRO (registro.html)
    // ==========================================
    if (isRegistroPage) {
        const selectProfesor = document.getElementById('profesor-atiende');
        const inputMatricula = document.getElementById('input-matricula');
        const inputNombre = document.getElementById('nombre-alumno');
        const selectSexo = document.getElementById('sexo-alumno');
        const selectCarrera = document.getElementById('carrera-alumno');
        const inputGrupo = document.getElementById('grupo-alumno');
        const formTutor = document.getElementById('tutorForm');

        // Cargar lista dinámica de profesores/tutores en el select
        async function cargarSelectTutores() {
            try {
                const res = await fetch('/api/tutores');
                const tutores = await res.json();
                selectProfesor.innerHTML = '<option value="">Elegir opción</option>';
                tutores.filter(t => t.estado === 'Activo').forEach(t => {
                    selectProfesor.innerHTML += `<option value="${t.nombre}">${t.nombre}</option>`;
                });
            } catch (e) {
                console.error("Error al cargar lista de tutores:", e);
                selectProfesor.innerHTML = '<option value="">Error al cargar tutores</option>';
            }
        }
        cargarSelectTutores();

        // Autocompletado al salir del campo matrícula (evento blur)
        inputMatricula.addEventListener('blur', async () => {
            const matricula = inputMatricula.value.trim();
            if (!matricula) return;

            try {
                const res = await fetch(`/api/alumnos/${encodeURIComponent(matricula)}`);
                const data = await res.json();

                if (res.ok && data.success) {
                    inputNombre.value = data.alumno.nombre || '';
                    selectSexo.value = data.alumno.sexo || '';
                    selectCarrera.value = data.alumno.carrera || '';
                    inputGrupo.value = data.alumno.grupo || '';
                } else {
                    console.warn("Alumno no registrado previamente. Ingrese los datos manualmente.");
                }
            } catch (err) {
                console.error("Error de red al consultar alumno:", err);
            }
        });

        // Evento Submit de Guardar Tutoría
        formTutor.addEventListener('submit', async (e) => {
            e.preventDefault();

            const payload = {
                profesor: selectProfesor.value,
                matricula: inputMatricula.value.trim(),
                nombre: inputNombre.value.trim(),
                sexo: selectSexo.value,
                carrera: selectCarrera.value,
                grupo: inputGrupo.value.trim(),
                turno: document.getElementById('turno-alumno').value,
                motivos: document.getElementById('motivos-tutoria').value,
                canalizacion: document.getElementById('canalizacion-alumno').value,
                observaciones: document.getElementById('observaciones-tutoria').value
            };

            try {
                const res = await fetch('/api/tutorias', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    alert('✅ ' + data.message);
                    formTutor.reset();
                } else {
                    alert('❌ ' + (data.message || 'Error al procesar el registro.'));
                }
            } catch (err) {
                console.error("Error al enviar registro:", err);
                alert("❌ Error de comunicación con el servidor.");
            }
        });
    }

    // ==========================================
    // 2. LÓGICA DE ADMINISTRACIÓN (admin.html)
    // ==========================================
    if (isAdminPage) {
        const tablaTutores = document.getElementById('tabla-tutores');
        const tablaHistorial = document.getElementById('tabla-historial');
        const btnGuardarTutor = document.getElementById('btn-guardar-tutor');

        // Cargar todo el Dashboard
        async function cargarDashboard() {
            try {
                // 1. Cargar Estadísticas
                const resStats = await fetch('/api/stats');
                const stats = await resStats.json();
                document.getElementById('kpi-total-alumnos').textContent = stats.totalAlumnos || 0;
                document.getElementById('kpi-tutores-activos').textContent = stats.tutoresActivos || 0;
                document.getElementById('kpi-canalizados').textContent = stats.canalizados || 0;

                // 2. Cargar Tabla Tutores
                const resTutores = await fetch('/api/tutores');
                const tutores = await resTutores.json();
                tablaTutores.innerHTML = tutores.map(t => `
                    <tr>
                        <td class="fw-semibold">${t.nombre}</td>
                        <td><span class="badge bg-success">Activo</span></td>
                        <td class="text-end">
                            <button onclick="eliminarTutor(${t.id})" class="btn btn-outline-danger btn-sm">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');

                // 3. Cargar Tabla Historial
                const resHistorial = await fetch('/api/tutorias');
                const historial = await resHistorial.json();
                tablaHistorial.innerHTML = historial.map(h => `
                    <tr>
                        <td>${new Date(h.fecha_registro).toLocaleDateString()}</td>
                        <td class="fw-bold">${h.nombre_alumno}</td>
                        <td>${h.carrera}</td>
                        <td>${h.grupo}</td>
                        <td>${h.turno}</td>
                        <td>${h.profesor}</td>
                        <td>${h.motivos}</td>
                        <td>
                            ${h.canalizacion === 'Sí'
                                ? '<span class="badge bg-warning text-dark">Canalizado</span>'
                                : '<span class="badge bg-secondary">No</span>'}
                        </td>
                    </tr>
                `).join('');

            } catch (err) {
                console.error("Error al cargar datos del dashboard:", err);
            }
        }

        // Agregar Tutor
        btnGuardarTutor.addEventListener('click', async () => {
            const nombreInput = document.getElementById('nuevo-tutor-nombre');
            const nombre = nombreInput.value.trim();
            if (!nombre) return alert('Por favor ingresa un nombre.');

            try {
                const res = await fetch('/api/tutores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre })
                });
                if (res.ok) {
                    nombreInput.value = '';
                    bootstrap.Modal.getInstance(document.getElementById('modalAgregarTutor')).hide();
                    cargarDashboard();
                }
            } catch (err) {
                console.error("Error al guardar tutor:", err);
            }
        });

        // Eliminar Tutor global
        window.eliminarTutor = async (id) => {
            if (!confirm('¿Desea eliminar este tutor?')) return;
            try {
                await fetch(`/api/tutores/${id}`, { method: 'DELETE' });
                cargarDashboard();
            } catch (err) {
                console.error("Error al eliminar tutor:", err);
            }
        };

        cargarDashboard();
    }
});
