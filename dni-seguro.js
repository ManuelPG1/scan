// ==========================================
// MÓDULO 03: DNI SEGURO (ANVERSO / REVERSO)
// ==========================================

const inputImagenDni = document.getElementById('inputImagenDni');
const canvasDni = document.getElementById('lienzoDni');
const ctxDni = canvasDni.getContext('2d');

const panelRecorteDni = document.getElementById('panelRecorteDni');
const panelEdicionDni = document.getElementById('panelEdicionDni');
const btnRecortarDni = document.getElementById('btnRecortarDni');
const comboCaraDni = document.getElementById('comboCaraDni');
const contenedorCensura = document.getElementById('contenedorCensura');
const inputMotivoDni = document.getElementById('inputMotivoDni');
const inputFechaDni = document.getElementById('inputFechaDni');
const btnDescargarDni = document.getElementById('btnDescargarDni');
const btnRotarDni = document.getElementById('btnRotarDni');
const checkBnDni = document.getElementById('checkBnDni');
const checkEscanerDni = document.getElementById('checkEscanerDni');

checkBnDni.addEventListener('change', renderizarDniSeguro);
checkEscanerDni.addEventListener('change', renderizarDniSeguro);

btnRotarDni.addEventListener('click', () => {
    if (!matDniRecortado) return;
    cv.rotate(matDniRecortado, matDniRecortado, cv.ROTATE_90_CLOCKWISE);
    renderizarDniSeguro();
});

let imgDniOriginal = new Image();
let matDniRecortado = null; // Guardará el DNI ya aplanado de forma global

// Coordenadas trasladadas desde tu Python
const ZONAS_ANVERSO = {
    "Firma": [0.39, 0.765, 0.77, 0.945],
    "Num. Soporte": [0.39, 0.72, 0.58, 0.775],
    "Láser Arriba": [0.777, 0.145, 0.91, 0.26],
    "CAN (Derecha)": [0.775, 0.84, 0.988, 0.945],
    "CLI Fantasma": [0.81, 0.62, 0.96, 0.81],
    "Día Validez": [0.59, 0.625, 0.64, 0.68],
    "Mes Validez": [0.64, 0.625, 0.69, 0.68],
    "Año Validez": [0.69, 0.625, 0.78, 0.68],
    "Foto principal": [0.01, 0.245, 0.38, 0.965],
    "Emisión": [0.39, 0.625, 0.58, 0.68],
    "Sexo": [0.39, 0.527, 0.44, 0.583],
    "Nacimiento": [0.79, 0.532, 0.988, 0.588]
};

const ZONAS_REVERSO = {
    "Código MRZ": [0.01, 0.62, 0.99, 0.98],
    "Equipo Expedición": [0.02, 0.25, 0.07, 0.58],
    "Dirección": [0.25, 0.065, 0.65, 0.32],
    "Láser Arriba": [0.1, 0.125, 0.22, 0.3],
    "Lugar Nacimiento": [0.25, 0.35, 0.70, 0.6]
};

const DEFECTO_ANVERSO = ["Firma", "Num. Soporte", "Láser Arriba", "CAN (Derecha)", "CLI Fantasma", "Día Validez", "Mes Validez"];
const DEFECTO_REVERSO = ["Código MRZ", "Equipo Expedición"];

let estadoCensura = {};

// --- 1. LÓGICA DE CARGA Y AUTO-DETECCIÓN ---
inputImagenDni.addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        imgDniOriginal.onload = () => intentarAutoDeteccion();
        imgDniOriginal.src = event.target.result;
    };
    reader.readAsDataURL(archivo);
    e.target.value = '';
});

function intentarAutoDeteccion() {
    let src = cv.imread(imgDniOriginal);
    let ratio = src.rows / 500.0;

    let resized = new cv.Mat();
    cv.resize(src, resized, new cv.Size(Math.round(src.cols / ratio), 500));

    let gray = new cv.Mat();
    cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    let edged = new cv.Mat();
    cv.Canny(gray, edged, 50, 150);

    let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(edged, edged, cv.MORPH_CLOSE, kernel);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let bestPoly = new cv.Mat();
    const areaTotal = resized.rows * resized.cols;

    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > 0.15 * areaTotal && area > maxArea) {
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
            if (approx.rows === 4) {
                maxArea = area;
                approx.copyTo(bestPoly);
            }
            approx.delete();
        }
        cnt.delete();
    }

    if (maxArea > 0) {
        // ¡Éxito! Detección automática completada
        procesarRecorteDni(bestPoly, ratio, src);
    } else {
        // Fallo: Iniciar modo manual (Fallback)
        iniciarRecorteManualDni();
    }

    // Limpieza de memoria
    src.delete(); resized.delete(); gray.delete(); edged.delete(); kernel.delete();
    contours.delete(); hierarchy.delete(); bestPoly.delete();
}

// --- 2. FALLBACK: RECORTE MANUAL (Los 4 Puntos, Lupa y Giro) ---
let puntosDni = [];
let puntoDniArrastrado = null;
const btnRotarManualDni = document.getElementById('btnRotarManualDni');

function iniciarRecorteManualDni() {
    panelEdicionDni.style.display = 'none';
    panelRecorteDni.style.display = 'block';
    btnRotarManualDni.style.display = 'block'; // Mostramos el botón de rotar

    canvasDni.width = imgDniOriginal.width;
    canvasDni.height = imgDniOriginal.height;

    const margenX = imgDniOriginal.width * 0.1;
    const margenY = imgDniOriginal.height * 0.1;
    puntosDni = [
        { x: margenX, y: margenY },
        { x: imgDniOriginal.width - margenX, y: margenY },
        { x: imgDniOriginal.width - margenX, y: imgDniOriginal.height - margenY },
        { x: margenX, y: imgDniOriginal.height - margenY }
    ];

    dibujarEscenaManualDni();
}

function dibujarEscenaManualDni() {
    ctxDni.clearRect(0, 0, canvasDni.width, canvasDni.height);
    ctxDni.drawImage(imgDniOriginal, 0, 0);

    ctxDni.beginPath();
    ctxDni.moveTo(puntosDni[0].x, puntosDni[0].y);
    for (let i = 1; i < 4; i++) ctxDni.lineTo(puntosDni[i].x, puntosDni[i].y);
    ctxDni.closePath();
    ctxDni.lineWidth = 4;
    ctxDni.strokeStyle = '#00fa9a';
    ctxDni.stroke();
    ctxDni.fillStyle = 'rgba(0, 250, 154, 0.15)';
    ctxDni.fill();

    puntosDni.forEach(p => {
        ctxDni.beginPath();
        ctxDni.arc(p.x, p.y, 35, 0, Math.PI * 2);
        ctxDni.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctxDni.fill();
        ctxDni.lineWidth = 2;
        ctxDni.strokeStyle = '#00fa9a';
        ctxDni.stroke();
    });

    // LA LUPA
    if (puntoDniArrastrado !== null) {
        dibujarLupaDni(puntosDni[puntoDniArrastrado].x, puntosDni[puntoDniArrastrado].y);
    }
}

function dibujarLupaDni(x, y) {
    const rect = canvasDni.getBoundingClientRect();
    const escalaCanvas = canvasDni.width / rect.width;
    const radioLupaCanvas = 75 * escalaCanvas;
    const zoom = 2.5;

    let lupaX = x < canvasDni.width / 2 ? canvasDni.width - radioLupaCanvas - (20 * escalaCanvas) : radioLupaCanvas + (20 * escalaCanvas);
    let lupaY = radioLupaCanvas + (20 * escalaCanvas);

    ctxDni.save();
    ctxDni.beginPath();
    ctxDni.arc(lupaX, lupaY, radioLupaCanvas, 0, Math.PI * 2);
    ctxDni.lineWidth = 6 * escalaCanvas;
    ctxDni.strokeStyle = '#f8fafc';
    ctxDni.stroke();
    ctxDni.lineWidth = 4 * escalaCanvas;
    ctxDni.strokeStyle = '#00fa9a';
    ctxDni.stroke();
    ctxDni.clip();

    const tamañoOrigen = (radioLupaCanvas * 2) / zoom;
    const origenX = x - tamañoOrigen / 2;
    const origenY = y - tamañoOrigen / 2;

    ctxDni.drawImage(
        imgDniOriginal,
        origenX, origenY, tamañoOrigen, tamañoOrigen,
        lupaX - radioLupaCanvas, lupaY - radioLupaCanvas, radioLupaCanvas * 2, radioLupaCanvas * 2
    );

    ctxDni.beginPath();
    const tamañoCruz = 15 * escalaCanvas;
    ctxDni.moveTo(lupaX - tamañoCruz, lupaY);
    ctxDni.lineTo(lupaX + tamañoCruz, lupaY);
    ctxDni.moveTo(lupaX, lupaY - tamañoCruz);
    ctxDni.lineTo(lupaX, lupaY + tamañoCruz);
    ctxDni.strokeStyle = '#ff3366';
    ctxDni.lineWidth = 1.5 * escalaCanvas;
    ctxDni.stroke();
    ctxDni.restore();
}

// MATEMÁTICAS DE ESCALA (El arreglo a tu problema de arrastre)
function obtenerCoordenadasDni(e) {
    const rect = canvasDni.getBoundingClientRect();
    const escalaX = canvasDni.width / rect.width;
    const escalaY = canvasDni.height / rect.height;
    let clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    let clienteY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clienteX - rect.left) * escalaX,
        y: (clienteY - rect.top) * escalaY
    };
}

function iniciarArrastreDni(e) {
    if (panelRecorteDni.style.display !== 'block') return;
    e.preventDefault();
    const pos = obtenerCoordenadasDni(e);
    const zonaDeteccion = 35 * 4; // Radio táctil ampliado

    for (let i = 0; i < puntosDni.length; i++) {
        const dx = pos.x - puntosDni[i].x;
        const dy = pos.y - puntosDni[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < zonaDeteccion) {
            puntoDniArrastrado = i;
            break;
        }
    }
}

function arrastrarDni(e) {
    if (puntoDniArrastrado !== null) {
        e.preventDefault();
        const pos = obtenerCoordenadasDni(e);
        puntosDni[puntoDniArrastrado].x = pos.x;
        puntosDni[puntoDniArrastrado].y = pos.y;
        dibujarEscenaManualDni();
    }
}

function terminarArrastreDni() {
    puntoDniArrastrado = null;
    dibujarEscenaManualDni(); // Redibujar para borrar la lupa al soltar
}

// Escuchadores Táctiles y de PC
canvasDni.addEventListener('mousedown', iniciarArrastreDni);
canvasDni.addEventListener('mousemove', arrastrarDni);
canvasDni.addEventListener('mouseup', terminarArrastreDni);
canvasDni.addEventListener('mouseleave', terminarArrastreDni);

canvasDni.addEventListener('touchstart', iniciarArrastreDni, { passive: false });
canvasDni.addEventListener('touchmove', arrastrarDni, { passive: false });
canvasDni.addEventListener('touchend', terminarArrastreDni);

// BOTÓN DE ROTAR (Previo al recorte manual)
btnRotarManualDni.addEventListener('click', () => {
    if (!imgDniOriginal.src) return;

    const canvasTemp = document.createElement('canvas');
    const ctxTemp = canvasTemp.getContext('2d');
    canvasTemp.width = imgDniOriginal.height;
    canvasTemp.height = imgDniOriginal.width;

    ctxTemp.translate(canvasTemp.width / 2, canvasTemp.height / 2);
    ctxTemp.rotate(90 * Math.PI / 180);
    ctxTemp.drawImage(imgDniOriginal, -imgDniOriginal.width / 2, -imgDniOriginal.height / 2);

    imgDniOriginal.onload = () => {
        canvasDni.width = imgDniOriginal.width;
        canvasDni.height = imgDniOriginal.height;
        const margenX = imgDniOriginal.width * 0.1;
        const margenY = imgDniOriginal.height * 0.1;
        puntosDni = [
            { x: margenX, y: margenY },
            { x: imgDniOriginal.width - margenX, y: margenY },
            { x: imgDniOriginal.width - margenX, y: imgDniOriginal.height - margenY },
            { x: margenX, y: imgDniOriginal.height - margenY }
        ];
        dibujarEscenaManualDni();
    };
    imgDniOriginal.src = canvasTemp.toDataURL('image/jpeg', 1.0);
});

// APLICAR EL RECORTE MANUAL Y PASAR A EDICIÓN
btnRecortarDni.addEventListener('click', () => {
    let src = cv.imread(imgDniOriginal);
    let ptsOrigen = cv.matFromArray(4, 1, cv.CV_32FC2, [
        puntosDni[0].x, puntosDni[0].y, puntosDni[1].x, puntosDni[1].y,
        puntosDni[2].x, puntosDni[2].y, puntosDni[3].x, puntosDni[3].y
    ]);

    // Proporción estándar DNI (ID-1) 85.6mm x 53.98mm -> ratio 1.586
    let maxW = 856; let maxH = 540;
    let ptsDestino = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxW, 0, maxW, maxH, 0, maxH]);

    let M = cv.getPerspectiveTransform(ptsOrigen, ptsDestino);
    matDniRecortado = new cv.Mat();
    cv.warpPerspective(src, matDniRecortado, M, new cv.Size(maxW, maxH));

    // Fuerza horizontal si el usuario recortó en vertical
    if (maxH > maxW) {
        cv.rotate(matDniRecortado, matDniRecortado, cv.ROTATE_90_COUNTERCLOCKWISE);
    }

    src.delete(); ptsOrigen.delete(); ptsDestino.delete(); M.delete();

    panelRecorteDni.style.display = 'none';
    btnRotarManualDni.style.display = 'none'; // Ocultamos el botón al pasar a edición
    prepararPanelEdicion();
});

// --- 3. PROCESAMIENTO GEOMÉTRICO (Desde Auto-Detect) ---
function procesarRecorteDni(bestPoly, ratio, src) {
    let pts = [];
    for (let i = 0; i < 4; i++) {
        pts.push({ x: bestPoly.data32S[i*2] * ratio, y: bestPoly.data32S[i*2+1] * ratio });
    }

    // Ordenar coordenadas con la misma técnica matemática que tu script de Python
    let sum = pts.map(p => p.x + p.y);
    let tl = pts[sum.indexOf(Math.min(...sum))];
    let br = pts[sum.indexOf(Math.max(...sum))];

    let diff = pts.map(p => p.x - p.y);
    let tr = pts[diff.indexOf(Math.max(...diff))];
    let bl = pts[diff.indexOf(Math.min(...diff))];

    // Calcular medidas reales para evitar estiramientos
    let wA = Math.hypot(br.x - bl.x, br.y - bl.y);
    let wB = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    let maxW = Math.max(wA, wB);

    let hA = Math.hypot(tr.x - br.x, tr.y - br.y);
    let hB = Math.hypot(tl.x - bl.x, tl.y - bl.y);
    let maxH = Math.max(hA, hB);

    let ptsOrigen = cv.matFromArray(4, 1, cv.CV_32FC2, [
        tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
    ]);
    let ptsDestino = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxW, 0, maxW, maxH, 0, maxH]);

    let M = cv.getPerspectiveTransform(ptsOrigen, ptsDestino);
    matDniRecortado = new cv.Mat();
    cv.warpPerspective(src, matDniRecortado, M, new cv.Size(maxW, maxH));

    // --- FUERZA HORIZONTAL AUTOMÁTICA ---
    if (maxH > maxW) {
        cv.rotate(matDniRecortado, matDniRecortado, cv.ROTATE_90_COUNTERCLOCKWISE);
    }

    ptsOrigen.delete(); ptsDestino.delete(); M.delete();
    prepararPanelEdicion();
}


// --- 4. PANEL DE EDICIÓN Y CENSURA ---
function prepararPanelEdicion() {
    panelEdicionDni.style.display = 'block';

    // Convertir de OpenCV a HTML Canvas
    canvasDni.width = matDniRecortado.cols;
    canvasDni.height = matDniRecortado.rows;
    cv.imshow('lienzoDni', matDniRecortado);

    generarTogglesCensura(comboCaraDni.value);
    renderizarDniSeguro();
}

comboCaraDni.addEventListener('change', (e) => {
    generarTogglesCensura(e.target.value);
    renderizarDniSeguro();
});

function generarTogglesCensura(cara) {
    contenedorCensura.innerHTML = '';
    const diccionario = cara === 'anverso' ? ZONAS_ANVERSO : ZONAS_REVERSO;
    const arrayDefecto = cara === 'anverso' ? DEFECTO_ANVERSO : DEFECTO_REVERSO;

    estadoCensura = {};

    Object.keys(diccionario).forEach(zona => {
        estadoCensura[zona] = arrayDefecto.includes(zona);

        const label = document.createElement('label');
        label.className = 'toggle-tecnico';
        label.style.fontSize = '0.75rem';
        label.style.marginBottom = '5px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = estadoCensura[zona];
        checkbox.addEventListener('change', (e) => {
            estadoCensura[zona] = e.target.checked;
            renderizarDniSeguro();
        });

        const span = document.createElement('span');
        span.textContent = zona;

        label.appendChild(checkbox);
        label.appendChild(span);
        contenedorCensura.appendChild(label);
    });
}

// Eventos para que se actualice la marca de agua al escribir
inputMotivoDni.addEventListener('input', renderizarDniSeguro);
inputFechaDni.addEventListener('input', renderizarDniSeguro);

function renderizarDniSeguro() {
    if (!matDniRecortado) return;

    // 1. Clonamos la imagen aplanada para no destruirla y permitir activar/desactivar filtros
    let matVisual = matDniRecortado.clone();

    // EFECTO ESCÁNER: Contraste y Enfoque (Nitidez)
    if (checkEscanerDni.checked) {
        // Aumenta el contraste (Multiplica cada pixel por 1.4)
        matVisual.convertTo(matVisual, -1, 1.4, 0);

        // Equivalente exacto de ImageFilter.SHARPEN (Máscara de Enfoque)
        let kernel = cv.matFromArray(3, 3, cv.CV_32F, [
            0, -1, 0,
            -1,  5, -1,
            0, -1, 0
        ]);
        cv.filter2D(matVisual, matVisual, cv.CV_8U, kernel);
        kernel.delete();
    }

    // BLANCO Y NEGRO DE SEGURIDAD
    if (checkBnDni.checked) {
        cv.cvtColor(matVisual, matVisual, cv.COLOR_RGBA2GRAY, 0);
    }

    // Ajustamos el tamaño del HTML Canvas al tamaño del DNI procesado
    canvasDni.width = matVisual.cols;
    canvasDni.height = matVisual.rows;

    // Dibujamos el resultado base en la pantalla
    cv.imshow('lienzoDni', matVisual);
    matVisual.delete(); // Vaciamos la memoria del clon

    const w = canvasDni.width;
    const h = canvasDni.height;
    const cara = comboCaraDni.value;
    const diccionario = cara === 'anverso' ? ZONAS_ANVERSO : ZONAS_REVERSO;

    // 2. Pintar las cajas negras de censura (Se dibujan por encima del Canvas en B/N o Color)
    ctxDni.fillStyle = '#0a0a0c'; // Negro Laboratorio
    Object.keys(estadoCensura).forEach(zona => {
        if (estadoCensura[zona] && diccionario[zona]) {
            const coords = diccionario[zona];
            const px = coords[0] * w;
            const py = coords[1] * h;
            const pWidth = (coords[2] - coords[0]) * w;
            const pHeight = (coords[3] - coords[1]) * h;
            ctxDni.fillRect(px, py, pWidth, pHeight);
        }
    });

    // 3. Marca de agua inteligente
    const motivo = inputMotivoDni.value.trim();
    const fecha = inputFechaDni.value.trim();

    let textoMarca = "";
    if (motivo !== "") textoMarca += motivo;
    if (motivo !== "" && fecha !== "") textoMarca += " - ";
    if (fecha !== "") textoMarca += fecha;

    if (textoMarca !== "") {
        ctxDni.save();
        ctxDni.font = 'bold 24px "Space Grotesk", sans-serif';
        // Usamos blanco translúcido con reborde negro para que se lea tanto si el DNI es B/N como si es en Color
        ctxDni.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctxDni.translate(w/2, h/2);
        ctxDni.rotate(-25 * Math.PI / 180);
        ctxDni.translate(-w/2, -h/2);

        const textMetrics = ctxDni.measureText(textoMarca + "    ");
        const pasoX = textMetrics.width;
        const pasoY = 80;

        for (let y = -h; y < h * 2; y += pasoY) {
            for (let x = -w; x < w * 2; x += pasoX) {
                const offsetX = (Math.abs(y / pasoY) % 2 === 0) ? x : x + (pasoX / 2);
                ctxDni.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                ctxDni.lineWidth = 3;
                ctxDni.strokeText(textoMarca, offsetX, y);
                ctxDni.fillText(textoMarca, offsetX, y);
            }
        }
        ctxDni.restore();
    }

    btnDescargarDni.innerText = "EXPORTAR DNI SEGURO";
    btnDescargarDni.style.backgroundColor = "";
    btnDescargarDni.style.color = "";
}

// --- 5. EXPORTAR EL RESULTADO ---
let blobDniGenerado = null;

btnDescargarDni.addEventListener('click', async () => {
    // Fase 2: Compartir
    if (blobDniGenerado && btnDescargarDni.innerText.includes("TOCAR PARA COMPARTIR")) {
        const nombreDni = `dni_seguro_${Date.now()}.jpg`;
        if (typeof compartirOpcionalPwa === 'function') {
            compartirOpcionalPwa(blobDniGenerado, nombreDni);
        } else if (typeof descargarPwaSeguro === 'function') {
            descargarPwaSeguro(blobDniGenerado, nombreDni);
        }
        return;
    }

    // Fase 1: Procesar
    btnDescargarDni.innerText = "GENERANDO... ⏳";
    btnDescargarDni.disabled = true;

    canvasDni.toBlob((blob) => {
        blobDniGenerado = blob;
        btnDescargarDni.innerText = "📤 ¡LISTO! TOCAR PARA COMPARTIR";
        btnDescargarDni.style.backgroundColor = "var(--accent-green)";
        btnDescargarDni.style.color = "#000";
        btnDescargarDni.disabled = false;
    }, 'image/jpeg', 0.9);
});
