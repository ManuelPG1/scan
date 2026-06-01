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


const inputImagen = document.getElementById('inputImagen');
const canvas = document.getElementById('lienzoApp');
const ctx = canvas.getContext('2d');

let img = new Image();
let puntos = []; // Guardará las 4 esquinas: [{x,y}, {x,y}, {x,y}, {x,y}]
let puntoArrastrado = null; // Índice del punto que estamos moviendo
const radioPunto = 20; // Tamaño del área táctil para agarrar el punto

// 1. Cargar la imagen cuando el usuario la selecciona
inputImagen.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        img.onload = () => {
            // Ajustamos el tamaño interno del canvas al de la imagen
            canvas.width = img.width;
            canvas.height = img.height;

            // Inicializamos los 4 puntos (dejamos un margen del 10% de los bordes)
            const margenX = img.width * 0.1;
            const margenY = img.height * 0.1;

            puntos = [
                { x: margenX, y: margenY },                                 // Sup-Izq
                { x: img.width - margenX, y: margenY },                     // Sup-Der
                { x: img.width - margenX, y: img.height - margenY },        // Inf-Der
                { x: margenX, y: img.height - margenY }                     // Inf-Izq
            ];

            dibujarEscena();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// 2. Función principal para dibujar la imagen y los puntos

function dibujarEscena() {
    if (!img.src) return;

    // Limpiamos el canvas y dibujamos la imagen de fondo
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Dibujamos el polígono que une los 4 puntos (el área a recortar)
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);
    for (let i = 1; i < puntos.length; i++) {
        ctx.lineTo(puntos[i].x, puntos[i].y);
    }
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#b85d19'; // Color cobre
    ctx.stroke();
    ctx.fillStyle = 'rgba(184, 93, 25, 0.2)';
    ctx.fill();

    // Dibujamos los 4 puntos (manejadores)
    puntos.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radioPunto, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#b85d19'; // Color cobre
        ctx.stroke();
    });
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

    // Comprobamos si el usuario ha tocado cerca de algún punto (usando Pitágoras)
    for (let i = 0; i < puntos.length; i++) {
        const dx = pos.x - puntos[i].x;
        const dy = pos.y - puntos[i].y;
        const distancia = Math.sqrt(dx * dx + dy * dy);

        // Damos un margen generoso (radioPunto * 3) para que sea fácil acertar con el dedo gordo
        if (distancia < radioPunto * 3) {
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
const btnDescargarImagen = document.getElementById('btnDescargarImagen');
const btnDescargarPDF = document.getElementById('btnDescargarPDF');
const btnLimpiar = document.getElementById('btnLimpiar');
const contadorPaginas = document.getElementById('contadorPaginas');
const vistasPrevias = document.getElementById('vistasPrevias');

// El almacén de nuestro documento multipágina
let listaPaginas = [];
let imagenActualBase64 = null;
let dimensionesActuales = { ancho: 0, alto: 0 };

btnEscanear.addEventListener('click', () => {
    if (typeof cv === 'undefined' || puntos.length !== 4) {
        alert("Espera a que cargue la librería o selecciona una imagen.");
        return;
    }

    let src = cv.imread(img);

    // 2. Calcular el ancho y alto del nuevo documento rectángular
    // Usamos el teorema de Pitágoras para medir la distancia máxima entre los puntos
    let ancho = Math.max(
        Math.hypot(puntos[0].x - puntos[1].x, puntos[0].y - puntos[1].y), // Lado superior
                         Math.hypot(puntos[3].x - puntos[2].x, puntos[3].y - puntos[2].y)  // Lado inferior
    );
    let alto = Math.max(
        Math.hypot(puntos[0].x - puntos[3].x, puntos[0].y - puntos[3].y), // Lado izquierdo
                        Math.hypot(puntos[1].x - puntos[2].x, puntos[1].y - puntos[2].y)  // Lado derecho
    );

    // 3. Transformación de perspectiva (Recorte)
    let ptsOrigen = cv.matFromArray(4, 1, cv.CV_32FC2, [
        puntos[0].x, puntos[0].y,
        puntos[1].x, puntos[1].y,
        puntos[2].x, puntos[2].y,
        puntos[3].x, puntos[3].y
    ]);
    let ptsDestino = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,               ancho, 0,
        ancho, alto,        0, alto
    ]);

    let matrizTransformacion = cv.getPerspectiveTransform(ptsOrigen, ptsDestino);
    let imgRecortada = new cv.Mat();
    cv.warpPerspective(src, imgRecortada, matrizTransformacion, new cv.Size(ancho, alto));

    // 4. APLICAR EFECTO ESCÁNER (Tu lógica de Python en JS)
    let imgProcesada = new cv.Mat();

    // Aumentar contraste y brillo (Equivalente a cv2.convertScaleAbs)
    // .convertTo(destino, tipo_dato, alpha, beta)
    imgRecortada.convertTo(imgProcesada, -1, 1.2, 10);

    // Filtro de enfoque (Sharpening kernel)
    let matrizKernel = cv.matFromArray(3, 3, cv.CV_32F, [
        -1, -1, -1,
        -1,  9, -1,
        -1, -1, -1
    ]);
    // cv.filter2D(src, dst, ddepth, kernel, anchor, delta, borderType)
    cv.filter2D(imgProcesada, imgProcesada, cv.CV_8U, matrizKernel, new cv.Point(-1, -1), 0, cv.BORDER_DEFAULT);

    // 5. Opcional: Blanco y Negro
    if (checkBlancoNegro.checked) {
        // Pasamos a escala de grises
        cv.cvtColor(imgProcesada, imgProcesada, cv.COLOR_RGBA2GRAY, 0);

        // Usamos Threshold Adaptativo: es mejor que el simple porque calcula
        // las sombras locales del papel y deja el fondo blanco puro.
        cv.adaptiveThreshold(imgProcesada, imgProcesada, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
    }

    // 6. Mostrar el resultado final
    canvas.width = ancho;
    canvas.height = alto;
    cv.imshow('lienzoApp', imgProcesada);

    // Guardamos las dimensiones y el contenido en Base64 de la página escaneada
    dimensionesActuales = { ancho: ancho, alto: alto };
    imagenActualBase64 = canvas.toDataURL('image/jpeg', 0.85); // 0.85 mantiene buena compresión/calidad

    // Activamos los botones de acción inmediata
    btnGuardarPagina.disabled = false;
    btnDescargarImagen.disabled = false;

    puntos = [];

    // Limpieza de memoria OpenCV
    src.delete(); ptsOrigen.delete(); ptsDestino.delete();
    matrizTransformacion.delete(); imgRecortada.delete();
    imgProcesada.delete(); matrizKernel.delete();
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
}

// 1. Añadir la página escaneada al lote
btnGuardarPagina.addEventListener('click', () => {
    if (!imagenActualBase64) return;

    // Creamos un ID único basado en el tiempo exacto
    const idUnico = "pag_" + Date.now();

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

            // Actualizamos la interfaz
            contadorPaginas.textContent = listaPaginas.length;
            if (listaPaginas.length === 0) btnDescargarPDF.disabled = true;
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
    btnDescargarPDF.disabled = false;
    btnGuardarPagina.disabled = true; // Bloquear hasta el siguiente escaneo
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

// 2. Descargar únicamente la imagen que se ve actualmente en pantalla
btnDescargarImagen.addEventListener('click', () => {
    if (!imagenActualBase64) return;
    const enlace = document.createElement('a');
    enlace.download = `escaneo_${Date.now()}.jpg`;
    enlace.href = imagenActualBase64;
    enlace.click();
});

// 3. Compilar todas las páginas acumuladas en un único archivo PDF alternando tamaños
btnDescargarPDF.addEventListener('click', () => {
    if (listaPaginas.length === 0) return;

    const { jsPDF } = window.jspdf;
    const formato = document.getElementById('formatoPdf').value;

    // Inicializamos el documento. Si es A4 usamos milímetros (mm), si es dinámico usamos píxeles (px).
    const doc = new jsPDF({
        orientation: 'p',
        unit: formato === 'a4' ? 'mm' : 'px',
        hotfixes: ["px_scaling"]
    });

    listaPaginas.forEach((pagina, indice) => {
        // Borramos la página 1 por defecto en la primera iteración
        if (indice === 0) doc.deletePage(1);

        if (formato === 'a4') {
            // --- LÓGICA PARA TAMAÑO A4 ESTÁNDAR ---
            doc.addPage('a4', 'p');

            // Dimensiones de un folio A4 en milímetros
            const anchoA4 = 210;
            const altoA4 = 297;

            // Calculamos proporciones para no deformar la fotografía
            const ratioImagen = pagina.ancho / pagina.alto;
            const ratioA4 = anchoA4 / altoA4;

            let anchoFinal = anchoA4;
            let altoFinal = altoA4;
            let x = 0;
            let y = 0;

            if (ratioImagen > ratioA4) {
                // La imagen es más ancha que el A4 en proporción (ej: apaisada)
                altoFinal = anchoA4 / ratioImagen;
                y = (altoA4 - altoFinal) / 2; // La centramos verticalmente
            } else {
                // La imagen es más estrecha/alta que el A4
                anchoFinal = altoA4 * ratioImagen;
                x = (anchoA4 - anchoFinal) / 2; // La centramos horizontalmente
            }

            doc.addImage(pagina.datos, 'JPEG', x, y, anchoFinal, altoFinal);

        } else {
            // --- LÓGICA PARA TAMAÑO DINÁMICO (La que ya tenías) ---
            doc.addPage([pagina.ancho, pagina.alto], pagina.ancho > pagina.alto ? 'l' : 'p');
            doc.addImage(pagina.datos, 'JPEG', 0, 0, pagina.ancho, pagina.alto);
        }
    });

    doc.save(`documento_escaneado_${Date.now()}.pdf`);
});

// 4. Reiniciar el estado por completo
btnLimpiar.addEventListener('click', () => {
    if (confirm("¿Seguro que quieres borrar todas las páginas guardadas?")) {
        listaPaginas = [];
        imagenActualBase64 = null;
        contadorPaginas.textContent = "0";
        vistasPrevias.innerHTML = "";
        btnDescargarPDF.disabled = true;
        btnGuardarPagina.disabled = true;
        btnDescargarImagen.disabled = true;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});
