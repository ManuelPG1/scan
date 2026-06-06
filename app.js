if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
        .then(registro => {
            console.log('Service Worker registrado con éxito:', registro.scope);
        })
        .catch(error => {
            console.log('Error al registrar el Service Worker:', error);
        });
    });
}

let colaArchivos = [];

const inputImagen = document.getElementById('inputImagen');
const canvas = document.getElementById('lienzoApp');
const ctx = canvas.getContext('2d');

const btnModoLibro = document.getElementById('btnModoLibro');
let modoLibroActivo = false;

let img = new Image();
let puntos = []; // Guardará las 4 esquinas: [{x,y}, {x,y}, {x,y}, {x,y}]
let puntoArrastrado = null; // Índice del punto que estamos moviendo
const radioPunto = 35; // Tamaño del área táctil para agarrar el punto

// 1. Cargar la imagen cuando el usuario la selecciona
inputImagen.addEventListener('change', (e) => {
    // Convertimos los archivos seleccionados en un array y los añadimos a la cola
    const archivosNuevos = Array.from(e.target.files);
    if (archivosNuevos.length === 0) return;

    colaArchivos = colaArchivos.concat(archivosNuevos);

    // Vaciamos el input para que vuelva a funcionar si hacemos fotos repetidas (El bug de la cámara)
    e.target.value = '';

    // Si es la primera imagen que cargamos, iniciamos el proceso
    cargarSiguienteArchivo();
});


// Evento para alternar entre 4 y 8 puntos
btnModoLibro.addEventListener('click', () => {
    if (!img.src || puntos.length === 0) return;

    modoLibroActivo = !modoLibroActivo;

    if (modoLibroActivo) {
        btnModoLibro.innerText = "[ MODO: LIBRO 3D (8 PUNTOS) ]";
        btnModoLibro.style.color = "var(--accent-green)";
        btnModoLibro.style.borderColor = "var(--accent-green)";

        // Convertimos 4 puntos a 8 insertando puntos medios
        // Orden (Horario): 0(SupIzq), 1(SupMed), 2(SupDer), 3(DerMed), 4(InfDer), 5(InfMed), 6(InfIzq), 7(IzqMed)
        puntos = [
            puntos[0], // 0
            { x: (puntos[0].x + puntos[1].x) / 2, y: (puntos[0].y + puntos[1].y) / 2 }, // 1
                              puntos[1], // 2
                              { x: (puntos[1].x + puntos[2].x) / 2, y: (puntos[1].y + puntos[2].y) / 2 }, // 3
                              puntos[2], // 4
                              { x: (puntos[2].x + puntos[3].x) / 2, y: (puntos[2].y + puntos[3].y) / 2 }, // 5
                              puntos[3], // 6
                              { x: (puntos[3].x + puntos[0].x) / 2, y: (puntos[3].y + puntos[0].y) / 2 }  // 7
        ];
    } else {
        btnModoLibro.innerText = "[ MODO: PLANO (4 PUNTOS) ]";
        btnModoLibro.style.color = "var(--text-muted)";
        btnModoLibro.style.borderColor = "var(--border-bright)";

        // Volvemos a 4 puntos (solo las esquinas: índices 0, 2, 4, 6)
        if (puntos.length === 8) {
            puntos = [puntos[0], puntos[2], puntos[4], puntos[6]];
        }
    }
    dibujarEscena();
});

// Fórmula de Curva de Bézier Cuadrática
function puntoBezier(t, p0, p1, p2) {
    const u = 1 - t;
    return {
        x: (u * u * p0.x) + (2 * u * t * p1.x) + (t * t * p2.x),
        y: (u * u * p0.y) + (2 * u * t * p1.y) + (t * t * p2.y)
    };
}
// Función para ir procesando la cola uno a uno
function cargarSiguienteArchivo() {
    if (colaArchivos.length === 0) {
        alert("¡Todas las imágenes de la cola han sido procesadas!");
        return;
    }

    // Sacamos el primer archivo de la lista
    const archivoActual = colaArchivos.shift();

    const reader = new FileReader();
    reader.onload = (event) => {
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            const margenX = img.width * 0.1;
            const margenY = img.height * 0.1;
            puntos = [
                { x: margenX, y: margenY },
                { x: img.width - margenX, y: margenY },
                { x: img.width - margenX, y: img.height - margenY },
                { x: margenX, y: img.height - margenY }
            ];
            dibujarEscena();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(archivoActual);
}

// 2. Función principal para dibujar la imagen y los puntos

function dibujarEscena() {
    if (!img.src) return;

    // Limpiamos el canvas y dibujamos la imagen de fondo
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Dibujamos el polígono que une los 4 puntos (el área a recortar)
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);

    if (modoLibroActivo && puntos.length === 8) {
        // Dibujamos curvas cuadráticas usando los puntos medios como controles de tensión
        ctx.quadraticCurveTo(puntos[1].x, puntos[1].y, puntos[2].x, puntos[2].y); // Borde superior
        ctx.quadraticCurveTo(puntos[3].x, puntos[3].y, puntos[4].x, puntos[4].y); // Borde derecho
        ctx.quadraticCurveTo(puntos[5].x, puntos[5].y, puntos[6].x, puntos[6].y); // Borde inferior
        ctx.quadraticCurveTo(puntos[7].x, puntos[7].y, puntos[0].x, puntos[0].y); // Borde izquierdo
    } else {
        // Líneas rectas clásicas
        for (let i = 1; i < puntos.length; i++) {
            ctx.lineTo(puntos[i].x, puntos[i].y);
        }
    }
    ctx.closePath();
    ctx.lineWidth = 2;
   // ctx.strokeStyle = '#b85d19'; // Color cobre
    //ctx.strokeStyle = '#3b82f6'; // Azul eléctrico de la paleta
    ctx.strokeStyle = '#00fa9a'; // Verde láser
    ctx.stroke();
    //ctx.fillStyle = 'rgba(184, 93, 25, 0.2)';
    //ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'; // Mismo azul, semitransparente
    ctx.fillStyle = 'rgba(0, 250, 154, 0.1)';
    ctx.fill();

    // Dibujamos los 4 puntos (manejadores)
    puntos.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radioPunto, 0, Math.PI * 2);
        //ctx.fillStyle = '#ffffff';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.lineWidth = 2;
       // ctx.strokeStyle = '#b85d19'; // Color cobre
        //ctx.strokeStyle = '#3b82f6'; // Borde azul
        ctx.strokeStyle = '#00fa9a';
        ctx.stroke();
    });


    // NUEVO: Dibujamos la lupa si el usuario está arrastrando un punto
    if (puntoArrastrado !== null) {
        dibujarLupa(puntos[puntoArrastrado].x, puntos[puntoArrastrado].y);
    }

}

// --- NUEVO: FUNCIÓN DE LUPA DE PRECISIÓN ---
function dibujarLupa(x, y) {
    // 1. Calculamos la escala real vs visual.
    // Las fotos son inmensas (ej: 4000px), pero en el móvil se ven a 400px.
    const rect = canvas.getBoundingClientRect();
    const escalaCanvas = canvas.width / rect.width;

    // Configuramos el tamaño visual de la lupa (75 píxeles en la pantalla del móvil) y el zoom
    const radioLupaCanvas = 75 * escalaCanvas;
    const zoom = 2.5;

    // 2. Esquivamos el dedo de forma inteligente:
    // Si tu dedo está en la mitad izquierda, dibujamos la lupa a la derecha (y viceversa).
    let lupaX = x < canvas.width / 2 ? canvas.width - radioLupaCanvas - (20 * escalaCanvas) : radioLupaCanvas + (20 * escalaCanvas);
    let lupaY = radioLupaCanvas + (20 * escalaCanvas); // Siempre arriba

    ctx.save();

    // 3. Crear el monóculo (Un círculo que enmascarará lo que dibujemos dentro)
    ctx.beginPath();
    ctx.arc(lupaX, lupaY, radioLupaCanvas, 0, Math.PI * 2);
    ctx.lineWidth = 6 * escalaCanvas;
    ctx.strokeStyle = '#f8fafc'; // Borde blanco interior
    ctx.stroke();

    // Un marco exterior azul para que parezca una lente de alta tecnología
    ctx.lineWidth = 4 * escalaCanvas;
    //ctx.strokeStyle = '#3b82f6';
    ctx.strokeStyle = '#00fa9a';
    ctx.stroke();

    // Activamos la máscara: todo lo que se dibuje a partir de aquí no se saldrá del círculo
    ctx.clip();

    // 4. Dibujar la imagen ampliada
    const tamañoOrigen = (radioLupaCanvas * 2) / zoom;
    const origenX = x - tamañoOrigen / 2;
    const origenY = y - tamañoOrigen / 2;

    // drawImage(imagen, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH)
    ctx.drawImage(
        img,
        origenX, origenY, tamañoOrigen, tamañoOrigen,
        lupaX - radioLupaCanvas, lupaY - radioLupaCanvas, radioLupaCanvas * 2, radioLupaCanvas * 2
    );

    // 5. El "Punto de mira" en el centro exacto de la lupa
    ctx.beginPath();
    const tamañoCruz = 15 * escalaCanvas;

    // Línea horizontal
    ctx.moveTo(lupaX - tamañoCruz, lupaY);
    ctx.lineTo(lupaX + tamañoCruz, lupaY);
    // Línea vertical
    ctx.moveTo(lupaX, lupaY - tamañoCruz);
    ctx.lineTo(lupaX, lupaY + tamañoCruz);

    //ctx.strokeStyle = '#ef4444'; // Rojo láser
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 1.5 * escalaCanvas;
    ctx.stroke();

    ctx.restore();
}


// 3. Utilidad para obtener las coordenadas exactas del toque/clic
// Esto es vital porque el canvas en CSS se encoge para caber en el móvil
function obtenerCoordenadas(e) {
    const rect = canvas.getBoundingClientRect();
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;

    // Soporte para táctil o ratón
    let clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    let clienteY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
        x: (clienteX - rect.left) * escalaX,
        y: (clienteY - rect.top) * escalaY
    };
}

// 4. Lógica de Interacción (Eventos táctiles y de ratón)
function iniciarArrastre(e) {
    e.preventDefault(); // Evita que la pantalla haga scroll al tocar el canvas
    const pos = obtenerCoordenadas(e);

    const zonaDeteccion = radioPunto * 4;

    for (let i = 0; i < puntos.length; i++) {
        const dx = pos.x - puntos[i].x;
        const dy = pos.y - puntos[i].y;
        const distancia = Math.sqrt(dx * dx + dy * dy);

        if (distancia < zonaDeteccion) {
            puntoArrastrado = i;
            break;
        }
    }
}

function arrastrar(e) {
    if (puntoArrastrado !== null) {
        e.preventDefault();
        const pos = obtenerCoordenadas(e);
        puntos[puntoArrastrado].x = pos.x;
        puntos[puntoArrastrado].y = pos.y;
        dibujarEscena(); // Redibujamos a cada movimiento
    }
}

function terminarArrastre() {
    puntoArrastrado = null;
}

// Escuchadores para ratón (PC)
canvas.addEventListener('mousedown', iniciarArrastre);
canvas.addEventListener('mousemove', arrastrar);
canvas.addEventListener('mouseup', terminarArrastre);
canvas.addEventListener('mouseleave', terminarArrastre);

// Escuchadores para táctil (Móvil)
canvas.addEventListener('touchstart', iniciarArrastre, { passive: false });
canvas.addEventListener('touchmove', arrastrar, { passive: false });
canvas.addEventListener('touchend', terminarArrastre);

const btnEscanear = document.getElementById('btnEscanear');
const checkBlancoNegro = document.getElementById('checkBlancoNegro');
const btnGuardarPagina = document.getElementById('btnGuardarPagina');
const btnCompartirImagen = document.getElementById('btnCompartirImagen');
const btnCompartirPDF = document.getElementById('btnCompartirPDF');
const btnLimpiar = document.getElementById('btnLimpiar');
const contadorPaginas = document.getElementById('contadorPaginas');
const vistasPrevias = document.getElementById('vistasPrevias');

const controlesFiltro = document.getElementById('controlesFiltro');
const rangoSensibilidad = document.getElementById('rangoSensibilidad');


const panelRecorte = document.getElementById('panelRecorte');
const panelFiltros = document.getElementById('panelFiltros');
const btnVolver = document.getElementById('btnVolver');
const btnConfirmar = document.getElementById('btnConfirmar');



let matRecortadaGlobal = null; // Guardará el recorte virgen en memoria

// Mostrar u ocultar el slider cuando se marca "Blanco y Negro"
checkBlancoNegro.addEventListener('change', (e) => {
    controlesFiltro.style.display = e.target.checked ? 'block' : 'none';
});

// El almacén de nuestro documento multipágina
let listaPaginas = [];
let imagenActualBase64 = null;
let dimensionesActuales = { ancho: 0, alto: 0 };



// --- 1. BOTÓN APLICAR RECORTE ---
btnEscanear.addEventListener('click', () => {
    if (typeof cv === 'undefined' || puntos.length < 4) return;

    let src = cv.imread(img);
    matRecortadaGlobal = new cv.Mat();
    dimensionesActuales = { ancho: 0, alto: 0 };

    if (!modoLibroActivo) {
        // --- MOTOR CLÁSICO: PERSPECTIVA PLANA (4 Puntos) ---
        let ancho = Math.max(
            Math.hypot(puntos[0].x - puntos[1].x, puntos[0].y - puntos[1].y),
                             Math.hypot(puntos[3].x - puntos[2].x, puntos[3].y - puntos[2].y)
        );
        let alto = Math.max(
            Math.hypot(puntos[0].x - puntos[3].x, puntos[0].y - puntos[3].y),
                            Math.hypot(puntos[1].x - puntos[2].x, puntos[1].y - puntos[2].y)
        );

        let ptsOrigen = cv.matFromArray(4, 1, cv.CV_32FC2, [
            puntos[0].x, puntos[0].y, puntos[1].x, puntos[1].y,
            puntos[2].x, puntos[2].y, puntos[3].x, puntos[3].y
        ]);
        let ptsDestino = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, ancho, 0, ancho, alto, 0, alto]);

        let matrizTransformacion = cv.getPerspectiveTransform(ptsOrigen, ptsDestino);
        cv.warpPerspective(src, matRecortadaGlobal, matrizTransformacion, new cv.Size(ancho, alto));

        dimensionesActuales = { ancho: ancho, alto: alto };
        ptsOrigen.delete(); ptsDestino.delete(); matrizTransformacion.delete();

    } else {
        // --- NUEVO MOTOR: DE-WARPING CURVO (8 Puntos + Remap) ---

        // 1. Calculamos las dimensiones del rectángulo aplanado
        let ancho = Math.max(
            Math.hypot(puntos[0].x - puntos[2].x, puntos[0].y - puntos[2].y),
                             Math.hypot(puntos[6].x - puntos[4].x, puntos[6].y - puntos[4].y)
        );
        let alto = Math.max(
            Math.hypot(puntos[0].x - puntos[6].x, puntos[0].y - puntos[6].y),
                            Math.hypot(puntos[2].x - puntos[4].x, puntos[2].y - puntos[4].y)
        );
        dimensionesActuales = { ancho: ancho, alto: alto };

        // 2. Generamos una malla de baja resolución (20x20)
        const gridX = 20;
        const gridY = 20;
        let mapXSmall = new cv.Mat(gridY, gridX, cv.CV_32FC1);
        let mapYSmall = new cv.Mat(gridY, gridX, cv.CV_32FC1);

        for (let i = 0; i < gridY; i++) {
            let v = i / (gridY - 1); // Progreso vertical (0 a 1)

// Puntos interpolados en el borde izquierdo y derecho para esta fila
let pIzquierda = puntoBezier(v, puntos[0], puntos[7], puntos[6]);
let pDerecha = puntoBezier(v, puntos[2], puntos[3], puntos[4]);

for (let j = 0; j < gridX; j++) {
    let u = j / (gridX - 1); // Progreso horizontal (0 a 1)

// Puntos interpolados en el borde superior e inferior para esta columna
let pArriba = puntoBezier(u, puntos[0], puntos[1], puntos[2]);
let pAbajo = puntoBezier(u, puntos[6], puntos[5], puntos[4]);

// Coons Patch simplificado: Interpolación bilineal de coordenadas
let xCoord = (1 - v) * pArriba.x + v * pAbajo.x;
let yCoord = (1 - u) * pIzquierda.y + u * pDerecha.y;

// Guardamos en la matriz de la malla usando Float32
mapXSmall.floatPtr(i, j)[0] = xCoord;
mapYSmall.floatPtr(i, j)[0] = yCoord;
}
        }

        // 3. El Hack de Rendimiento: Ampliamos la malla 20x20 a resolución total (Ej: 1500x2000)
        let mapX = new cv.Mat();
        let mapY = new cv.Mat();
        cv.resize(mapXSmall, mapX, new cv.Size(ancho, alto), 0, 0, cv.INTER_LINEAR);
        cv.resize(mapYSmall, mapY, new cv.Size(ancho, alto), 0, 0, cv.INTER_LINEAR);

        // 4. Aplicamos el re-mapeo curvo sobre la imagen de alta resolución
        cv.remap(src, matRecortadaGlobal, mapX, mapY, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 255));

        // Limpieza de mallas
        mapXSmall.delete(); mapYSmall.delete(); mapX.delete(); mapY.delete();
    }

    src.delete();
    // Cambiamos el estado de la interfaz
    panelRecorte.style.display = 'none';
    panelFiltros.style.display = 'flex';

    // Aplicamos los filtros por primera vez
    aplicarFiltros();
});

// --- 2. FUNCIÓN PARA APLICAR FILTROS EN TIEMPO REAL ---
function aplicarFiltros() {
    if (!matRecortadaGlobal) return;

    let imgProcesada = new cv.Mat();
    // Clonamos la imagen original recortada para no destruirla con los filtros
    matRecortadaGlobal.copyTo(imgProcesada);

    if (checkBlancoNegro.checked) {
        cv.cvtColor(imgProcesada, imgProcesada, cv.COLOR_RGBA2GRAY, 0);
        cv.GaussianBlur(imgProcesada, imgProcesada, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
        let constante = parseInt(rangoSensibilidad.value);
        cv.adaptiveThreshold(imgProcesada, imgProcesada, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 85, constante);
    } else {
        let imgDesenfocada = new cv.Mat();
        imgProcesada.convertTo(imgProcesada, -1, 1.1, 15);
        cv.GaussianBlur(imgProcesada, imgDesenfocada, new cv.Size(0, 0), 3, 3, cv.BORDER_DEFAULT);
        cv.addWeighted(imgProcesada, 1.5, imgDesenfocada, -0.5, 0, imgProcesada);
        imgDesenfocada.delete();
    }

    canvas.width = dimensionesActuales.ancho;
    canvas.height = dimensionesActuales.alto;
    cv.imshow('lienzoApp', imgProcesada);

    imgProcesada.delete(); // Limpiamos la clonación
}

// Escuchadores para actualizar los filtros en vivo
checkBlancoNegro.addEventListener('change', (e) => {
    controlesFiltro.style.display = e.target.checked ? 'block' : 'none';
    aplicarFiltros();
});

// Usamos 'input' para que se actualice MIENTRAS arrastras el dedo
rangoSensibilidad.addEventListener('input', aplicarFiltros);

// --- 3. BOTÓN VOLVER (REAJUSTAR PUNTOS) ---
btnVolver.addEventListener('click', () => {
    // Vaciamos la memoria global
    if (matRecortadaGlobal) {
        matRecortadaGlobal.delete();
        matRecortadaGlobal = null;
    }

    // Cambiamos la interfaz de vuelta
    panelFiltros.style.display = 'none';
    panelRecorte.style.display = 'flex';

    // Restauramos el Canvas original con los puntos en la posición exacta donde los dejaste
    canvas.width = img.width;
    canvas.height = img.height;
    dibujarEscena();
});

// --- 4. BOTÓN CONFIRMAR ---
btnConfirmar.addEventListener('click', () => {
    // Guardamos el resultado en Base64
    imagenActualBase64 = canvas.toDataURL('image/jpeg', 0.85);

    // Limpiamos la memoria global
    if (matRecortadaGlobal) {
        matRecortadaGlobal.delete();
        matRecortadaGlobal = null;
    }

    // Restauramos la interfaz para la SIGUIENTE foto
    panelFiltros.style.display = 'none';
    panelRecorte.style.display = 'flex';
    puntos = [];

    // Automatizamos el clic en el botón oculto "Añadir y Siguiente"
    btnGuardarPagina.disabled = false;
    btnGuardarPagina.click();
});

// --- NUEVA LÓGICA DE ALMACENAMIENTO Y DESCARGA ---

// 1. Añadir la página escaneada al lote del documento
// Variable para saber qué elemento estamos arrastrando
let elementoArrastrado = null;

// Función vital: Sincroniza nuestro array de datos con el orden visual de las miniaturas
function sincronizarOrdenArray() {
    // Obtenemos los IDs en el orden exacto en el que han quedado en pantalla
    const ordenVisualIds = Array.from(vistasPrevias.children).map(wrapper => wrapper.dataset.id);

    // Reordenamos nuestro array interno de páginas para que coincida
    listaPaginas.sort((a, b) => ordenVisualIds.indexOf(a.id) - ordenVisualIds.indexOf(b.id));
    // Reiniciar el botón de PDF por si habían generado uno antes
    pdfBlobGenerado = null;
    pdfArchivoGenerado = null;
    btnCompartirPDF.innerHTML = "Crear y Compartir PDF 📤";
    btnCompartirPDF.style.backgroundColor = "";
}

// 1. Añadir la página escaneada al lote
btnGuardarPagina.addEventListener('click', () => {
    if (!imagenActualBase64) return;

    // Creamos un ID único basado en el tiempo exacto
    const idUnico = "pag_" + Date.now();
    // Reiniciar el botón de PDF por si habían generado uno antes
    pdfBlobGenerado = null;
    pdfArchivoGenerado = null;
    btnCompartirPDF.innerHTML = "Crear y Compartir PDF 📤";
    btnCompartirPDF.style.backgroundColor = "";
    // Guardamos los datos con su ID
    listaPaginas.push({
        id: idUnico,
        datos: imagenActualBase64,
        ancho: dimensionesActuales.ancho,
        alto: dimensionesActuales.alto
    });

    // --- CREACIÓN DE LA MINIATURA INTERACTIVA ---
    const wrapper = document.createElement('div');
    wrapper.className = 'miniatura-wrapper';
    wrapper.draggable = true; // Permite arrastrar el elemento
    wrapper.dataset.id = idUnico;

    const miniatura = document.createElement('img');
    miniatura.src = imagenActualBase64;
    miniatura.style.height = "100px"; // Un poco más grande para verla bien
    miniatura.style.border = "2px solid #ccc";
    miniatura.style.borderRadius = "4px";

    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'btn-eliminar-pag';
    btnBorrar.innerHTML = '×';

    // --- LÓGICA DE BORRAR PÁGINA ---
    btnBorrar.addEventListener('click', () => {
        if(confirm("¿Eliminar esta página del documento?")) {
            // Quitamos la página del array
            listaPaginas = listaPaginas.filter(p => p.id !== idUnico);
            // Quitamos la miniatura de la pantalla
            wrapper.remove();
            // Reiniciar el botón de PDF por si habían generado uno antes
            pdfBlobGenerado = null;
            pdfArchivoGenerado = null;
            btnCompartirPDF.innerHTML = "Crear y Compartir PDF 📤";
            btnCompartirPDF.style.backgroundColor = "";

            // Actualizamos la interfaz
            contadorPaginas.textContent = listaPaginas.length;
            if (listaPaginas.length === 0) btnCompartirPDF.disabled = true;
        }
    });

    // --- LÓGICA DE ARRASTRAR (DRAG) ---
    wrapper.addEventListener('dragstart', (e) => {
        elementoArrastrado = wrapper;
        setTimeout(() => wrapper.style.opacity = '0.4', 0); // Efecto visual fantasma
    });

    wrapper.addEventListener('dragend', () => {
        wrapper.style.opacity = '1';
        elementoArrastrado = null;
        sincronizarOrdenArray(); // Guardamos el nuevo orden al soltar
    });

    // Añadimos todo al contenedor
    wrapper.appendChild(miniatura);
    wrapper.appendChild(btnBorrar);
    vistasPrevias.appendChild(wrapper);

    // Actualizamos interfaz general
    contadorPaginas.textContent = listaPaginas.length;
    btnCompartirPDF.disabled = false;
    btnGuardarPagina.disabled = true; // Bloquear hasta el siguiente escaneo

    if (colaArchivos.length > 0) {
        cargarSiguienteArchivo();
    }
});

// --- LÓGICA DE SOLTAR (DROP) EN EL CONTENEDOR PRINCIPAL ---
// Evitamos el comportamiento por defecto para permitir soltar
vistasPrevias.addEventListener('dragover', (e) => {
    e.preventDefault();

    // Calculamos visualmente dónde soltar la página (antes o después de otra)
    const despuesDeElemento = obtenerElementoSiguiente(vistasPrevias, e.clientX);

    if (elementoArrastrado) {
        if (despuesDeElemento == null) {
            vistasPrevias.appendChild(elementoArrastrado);
        } else {
            vistasPrevias.insertBefore(elementoArrastrado, despuesDeElemento);
        }
    }
});

// Utilidad matemática para saber entre qué dos páginas estamos arrastrando el ratón/dedo
function obtenerElementoSiguiente(contenedor, x) {
    const elementosArrastrables = [...contenedor.querySelectorAll('.miniatura-wrapper:not(.arrastrando)')];

    return elementosArrastrables.reduce((masCercano, hijo) => {
        const caja = hijo.getBoundingClientRect();
        // Calculamos la distancia entre el ratón y el centro de cada miniatura
        const offset = x - caja.left - caja.width / 2;
        if (offset < 0 && offset > masCercano.offset) {
            return { offset: offset, element: hijo };
        } else {
            return masCercano;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
/////////////////////
// --- FUNCIONES DE UTILIDAD PARA COMPARTIR Y DESCARGAR ---

function base64ToBlob(base64, mimeType) {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeType });
}

// NUEVO: Descarga Síncrona 100% compatible con Firefox PWA y Chrome
function descargarPwaSeguro(blob, nombreArchivo) {
    // 1. Creamos un enlace directo a la memoria (Síncrono e instantáneo)
    const url = window.URL.createObjectURL(blob);

    // 2. Creamos el botón invisible
    const enlace = document.createElement('a');
    enlace.style.display = 'none';
    enlace.href = url;
    enlace.download = nombreArchivo;

    // 3. Lo pegamos y lo clicamos en el mismo ciclo de ejecución
    document.body.appendChild(enlace);
    enlace.click();

    // 4. Le damos 1 segundo de margen a Firefox para que intercepte la
    // descarga antes de borrar el archivo de la memoria temporal
    setTimeout(() => {
        document.body.removeChild(enlace);
        window.URL.revokeObjectURL(url);
    }, 1000);
}

// 2. COMPARTIR IMAGEN
btnCompartirImagen.addEventListener('click', async () => {
    if (!imagenActualBase64) return;

    const blob = base64ToBlob(imagenActualBase64, 'image/jpeg');
    const nombreArchivo = `escaner_${Date.now()}.jpg`;
    const archivo = new File([blob], nombreArchivo, { type: 'image/jpeg' });

    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
            await navigator.share({ files: [archivo], title: 'Imagen Escaneada' });
        } catch (error) {
            if (error.name !== 'AbortError') descargarPwaSeguro(blob, nombreArchivo);
        }
    } else {
        descargarPwaSeguro(blob, nombreArchivo);
    }
});


// --- LÓGICA DE PDF EN 2 PASOS (Evita el bloqueo de Android) ---
let pdfBlobGenerado = null;
let pdfArchivoGenerado = null;

btnCompartirPDF.addEventListener('click', async () => {
    if (listaPaginas.length === 0) return;

    // PASO 2: Si el PDF ya está generado, lo compartimos INSTANTÁNEAMENTE
    if (pdfArchivoGenerado) {
        if (navigator.canShare && navigator.canShare({ files: [pdfArchivoGenerado] })) {
            try {
                await navigator.share({
                    files: [pdfArchivoGenerado],
                    title: 'Documento Escaneado'
                });
            } catch (error) {
                if (error.name !== 'AbortError') descargarPwaSeguro(pdfBlobGenerado, pdfArchivoGenerado.name);
            }
        } else {
            descargarPwaSeguro(pdfBlobGenerado, pdfArchivoGenerado.name);
        }
        return; // Salimos para que no vuelva a generar el PDF
    }

    // PASO 1: Generar el PDF (Bloquea la pantalla, así que lo hacemos separado del Share)
    const textoOriginal = btnCompartirPDF.innerHTML;
    btnCompartirPDF.innerHTML = "Generando PDF... ⏳";
    btnCompartirPDF.disabled = true;

    setTimeout(() => {
        const { jsPDF } = window.jspdf;
        const formato = document.getElementById('formatoPdf').value;

        const doc = new jsPDF({
            orientation: 'p',
            unit: formato === 'a4' ? 'mm' : 'px',
            hotfixes: ["px_scaling"]
        });

        listaPaginas.forEach((pagina, indice) => {
            if (indice === 0) doc.deletePage(1);

            if (formato === 'a4') {
                doc.addPage('a4', 'p');
                const anchoA4 = 210, altoA4 = 297;
                const ratioImagen = pagina.ancho / pagina.alto, ratioA4 = anchoA4 / altoA4;
                let anchoFinal = anchoA4, altoFinal = altoA4, x = 0, y = 0;

                if (ratioImagen > ratioA4) {
                    altoFinal = anchoA4 / ratioImagen;
                    y = (altoA4 - altoFinal) / 2;
                } else {
                    anchoFinal = altoA4 * ratioImagen;
                    x = (anchoA4 - anchoFinal) / 2;
                }
                doc.addImage(pagina.datos, 'JPEG', x, y, anchoFinal, altoFinal);
            } else {
                doc.addPage([pagina.ancho, pagina.alto], pagina.ancho > pagina.alto ? 'l' : 'p');
                doc.addImage(pagina.datos, 'JPEG', 0, 0, pagina.ancho, pagina.alto);
            }
        });

        // Guardamos el PDF en memoria para el Paso 2
        pdfBlobGenerado = doc.output('blob');
        const nombreDoc = `documento_${Date.now()}.pdf`;
        pdfArchivoGenerado = new File([pdfBlobGenerado], nombreDoc, { type: 'application/pdf' });

        // Transformamos el botón para el Paso 2
        btnCompartirPDF.innerHTML = "📤 ¡PDF Listo! Tocar para Compartir";
        btnCompartirPDF.style.backgroundColor = "#10b981"; // Color verde éxito
        btnCompartirPDF.disabled = false;
    }, 50);
});

// 4. Reiniciar el estado por completo
btnLimpiar.addEventListener('click', () => {
    if (confirm("¿Seguro que quieres borrar todas las páginas guardadas?")) {
        listaPaginas = [];
        imagenActualBase64 = null;
        pdfBlobGenerado = null;
        pdfArchivoGenerado = null;

        contadorPaginas.textContent = "0";
        vistasPrevias.innerHTML = "";

        btnCompartirPDF.innerHTML = "Crear y Compartir PDF 📤";
        btnCompartirPDF.style.backgroundColor = "";
        btnCompartirPDF.disabled = true;
        btnGuardarPagina.disabled = true;
        btnCompartirImagen.disabled = true;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});


const btnRotar = document.getElementById('btnRotar');

btnRotar.addEventListener('click', () => {
    // Si no hay ninguna imagen cargada, no hacemos nada
    if (!img.src) return;

    // 1. Creamos un canvas temporal en la memoria
    const canvasTemp = document.createElement('canvas');
    const ctxTemp = canvasTemp.getContext('2d');

    // 2. Intercambiamos ancho y alto para alojar el giro de 90º
    canvasTemp.width = img.height;
    canvasTemp.height = img.width;

    // 3. Movemos el "eje de rotación" al centro exacto del nuevo canvas
    ctxTemp.translate(canvasTemp.width / 2, canvasTemp.height / 2);
    // Giramos 90 grados (en radianes)
    ctxTemp.rotate(90 * Math.PI / 180);

    // 4. Dibujamos la imagen original anclada a ese nuevo centro
    ctxTemp.drawImage(img, -img.width / 2, -img.height / 2);

    // 5. Sustituimos la imagen actual por la nueva versión rotada
    img.onload = () => {
        // Adaptamos nuestro lienzo principal a la nueva orientación
        canvas.width = img.width;
        canvas.height = img.height;

        // Volvemos a colocar los 4 puntos de recorte con el margen del 10%
        const margenX = img.width * 0.1;
        const margenY = img.height * 0.1;

        puntos = [
            { x: margenX, y: margenY },
            { x: img.width - margenX, y: margenY },
            { x: img.width - margenX, y: img.height - margenY },
            { x: margenX, y: img.height - margenY }
        ];

        dibujarEscena();
    };

    // Extraemos los píxeles del canvas temporal y disparamos el onload
    img.src = canvasTemp.toDataURL('image/jpeg', 1.0);
});
