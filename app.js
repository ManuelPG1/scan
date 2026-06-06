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
    for (let i = 1; i < puntos.length; i++) {
        ctx.lineTo(puntos[i].x, puntos[i].y);
    }
    ctx.closePath();
    ctx.lineWidth = 4;
   // ctx.strokeStyle = '#b85d19'; // Color cobre
    ctx.strokeStyle = '#3b82f6'; // Azul eléctrico de la paleta
    ctx.stroke();
    //ctx.fillStyle = 'rgba(184, 93, 25, 0.2)';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'; // Mismo azul, semitransparente
    ctx.fill();

    // Dibujamos los 4 puntos (manejadores)
    puntos.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radioPunto, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 3;
       // ctx.strokeStyle = '#b85d19'; // Color cobre
        ctx.strokeStyle = '#3b82f6'; // Borde azul
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

// Mostrar u ocultar el slider cuando se marca "Blanco y Negro"
checkBlancoNegro.addEventListener('change', (e) => {
    controlesFiltro.style.display = e.target.checked ? 'block' : 'none';
});

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
    // --- 4. NUEVA ARQUITECTURA DE PROCESAMIENTO VISUAL ---
    let imgProcesada = new cv.Mat();

    if (checkBlancoNegro.checked) {
        // --- MODO DOCUMENTO PURO (BLANCO Y NEGRO) ---

        // 1. Escala de grises
        cv.cvtColor(imgRecortada, imgProcesada, cv.COLOR_RGBA2GRAY, 0);

        // 2. Desenfoque inicial ligero para planchar el ruido del sensor
        cv.GaussianBlur(imgProcesada, imgProcesada, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

        // 3. Umbral Adaptativo de Bloque Gigante
        // Al usar un bloque de 81 o superior, el filtro es capaz de "ver" fuera del código QR
        // y darse cuenta de que es una figura negra sobre papel blanco, no dejándolo hueco.
        let blockSize = 85; // DEBE ser un número impar.
        let constante = parseInt(rangoSensibilidad.value);


        cv.adaptiveThreshold(
            imgProcesada,
            imgProcesada,
            255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            blockSize,
            constante
        );

    } else {
        // --- MODO FOTOGRAFÍA / REVISTA (COLOR) ---

        let imgDesenfocada = new cv.Mat();

        // 1. Aumento sutil de contraste y brillo para quitar el tono grisáceo
        imgRecortada.convertTo(imgProcesada, -1, 1.1, 15);

        // 2. Creamos una copia desenfocada de la imagen original
        cv.GaussianBlur(imgProcesada, imgDesenfocada, new cv.Size(0, 0), 3, 3, cv.BORDER_DEFAULT);

        // 3. Unsharp Masking (Máscara de Desenfoque)
        // Al restar la copia borrosa a la original, logramos que solo los bordes nítidos
        // (letras, dibujos) destaquen, ignorando el ruido del fondo.
        // Fórmula: (Original * 1.5) + (Borrosa * -0.5) + 0
        cv.addWeighted(imgProcesada, 1.5, imgDesenfocada, -0.5, 0, imgProcesada);

        imgDesenfocada.delete(); // Limpieza de memoria temporal
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
    btnCompartirImagen.disabled = false;

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
