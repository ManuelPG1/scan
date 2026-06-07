// ==========================================
// FUNCIÓN UNIVERSAL DE COMPARTIR (PDF LAB)
// ==========================================
async function compartirOpcionalPwa(blob, nombreArchivo) {
    const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try {
            await navigator.share({ files: [archivo], title: 'Documento PDF' });
        } catch (error) {
            // Si el móvil bloquea el menú o falla, forzamos descarga segura
            if (error.name !== 'AbortError' && typeof descargarPwaSeguro === 'function') {
                descargarPwaSeguro(blob, nombreArchivo);
            }
        }
    } else {
        // Fallback para PC o Firefox
        if (typeof descargarPwaSeguro === 'function') descargarPwaSeguro(blob, nombreArchivo);
    }
}


// ==========================================
// HERRAMIENTA 01: FUSIÓN DE PDFS (CON ORDENACIÓN)
// ==========================================
const inputPdfs = document.getElementById('inputPdfs');
const listaPdfsUnir = document.getElementById('listaPdfsUnir');
const btnUnirPdfs = document.getElementById('btnUnirPdfs');

let lotePdfsParaUnir = [];
let elementoPdfArrastrado = null;

// Variables de estado para el botón Compartir
let pdfFusionadoBlob = null;
let nombrePdfFusionado = null;

function resetearBotonUnir() {
    pdfFusionadoBlob = null;
    btnUnirPdfs.innerText = "PROCESAR Y UNIR PDFS";
    btnUnirPdfs.style.backgroundColor = "";
    btnUnirPdfs.style.color = "";
}

inputPdfs.addEventListener('change', (e) => {
    const nuevosArchivos = Array.from(e.target.files);
    if (nuevosArchivos.length === 0) return;

    nuevosArchivos.forEach(archivo => {
        lotePdfsParaUnir.push({
            id: 'pdf_' + Date.now() + Math.random().toString(36).substring(2),
                              file: archivo
        });
    });

    e.target.value = '';
    actualizarInterfazLotePdfs();
    resetearBotonUnir();
});

function sincronizarOrdenPdfs() {
    const ordenVisualIds = Array.from(listaPdfsUnir.children).map(div => div.dataset.id);
    lotePdfsParaUnir.sort((a, b) => ordenVisualIds.indexOf(a.id) - ordenVisualIds.indexOf(b.id));
    resetearBotonUnir(); // Si cambian el orden, obligamos a volver a procesar
}

function actualizarInterfazLotePdfs() {
    listaPdfsUnir.innerHTML = '';

    lotePdfsParaUnir.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.dataset.id = item.id;
        itemDiv.draggable = true;

        itemDiv.style.display = 'flex';
        itemDiv.style.justifyContent = 'space-between';
        itemDiv.style.alignItems = 'center';
        itemDiv.style.padding = '10px';
        itemDiv.style.backgroundColor = 'var(--bg-input)';
        itemDiv.style.border = '1px dashed var(--border-bright)';
        itemDiv.style.borderRadius = '2px';
        itemDiv.style.fontFamily = "'Space Grotesk', monospace";
        itemDiv.style.fontSize = '0.75rem';
        itemDiv.style.cursor = 'grab';

        itemDiv.addEventListener('dragstart', () => {
            elementoPdfArrastrado = itemDiv;
            itemDiv.style.opacity = '0.4';
            itemDiv.style.cursor = 'grabbing';
        });

        itemDiv.addEventListener('dragend', () => {
            itemDiv.style.opacity = '1';
            itemDiv.style.cursor = 'grab';
            elementoPdfArrastrado = null;
            sincronizarOrdenPdfs();
        });

        const nombreSpan = document.createElement('span');
        let nombreCorto = item.file.name.length > 30 ? item.file.name.substring(0, 27) + '...' : item.file.name;
        nombreSpan.textContent = `[☰] ${nombreCorto}`;

        const btnQuitar = document.createElement('button');
        btnQuitar.textContent = 'X';
        btnQuitar.style.width = 'auto';
        btnQuitar.style.margin = '0';
        btnQuitar.style.padding = '4px 10px';
        btnQuitar.style.backgroundColor = 'transparent';
        btnQuitar.style.color = 'var(--danger)';
        btnQuitar.style.border = '1px solid var(--danger)';

        btnQuitar.onclick = () => {
            lotePdfsParaUnir = lotePdfsParaUnir.filter(p => p.id !== item.id);
            actualizarInterfazLotePdfs();
            resetearBotonUnir();
        };

        itemDiv.appendChild(nombreSpan);
        itemDiv.appendChild(btnQuitar);
        listaPdfsUnir.appendChild(itemDiv);
    });

    btnUnirPdfs.disabled = lotePdfsParaUnir.length < 2;
}

listaPdfsUnir.addEventListener('dragover', (e) => {
    e.preventDefault();
    const elementosArrastrables = [...listaPdfsUnir.querySelectorAll('div:not([style*="opacity: 0.4"])')];

    const elementoSiguiente = elementosArrastrables.find(hijo => {
        const caja = hijo.getBoundingClientRect();
        return e.clientY <= caja.top + caja.height / 2;
    });

    if (elementoPdfArrastrado) {
        if (!elementoSiguiente) {
            listaPdfsUnir.appendChild(elementoPdfArrastrado);
        } else {
            listaPdfsUnir.insertBefore(elementoPdfArrastrado, elementoSiguiente);
        }
    }
});

btnUnirPdfs.addEventListener('click', async () => {
    if (lotePdfsParaUnir.length < 2) return;

    // PASO 2: Si ya está generado, compartimos al instante
    if (pdfFusionadoBlob) {
        compartirOpcionalPwa(pdfFusionadoBlob, nombrePdfFusionado);
        return;
    }

    // PASO 1: Procesar y Generar
    const textoOriginal = btnUnirPdfs.innerText;
    btnUnirPdfs.innerText = "PROCESANDO FUSIÓN... ⏳";
    btnUnirPdfs.disabled = true;

    try {
        const { PDFDocument } = PDFLib;
        const pdfFinal = await PDFDocument.create();

        for (const item of lotePdfsParaUnir) {
            const datosBinarios = await item.file.arrayBuffer();
            const pdfOrigen = await PDFDocument.load(datosBinarios);
            const indicesPaginas = pdfOrigen.getPageIndices();
            const paginasCopiadas = await pdfFinal.copyPages(pdfOrigen, indicesPaginas);
            for (const pagina of paginasCopiadas) {
                pdfFinal.addPage(pagina);
            }
        }

        const bytesPdfFinal = await pdfFinal.save();
        pdfFusionadoBlob = new Blob([bytesPdfFinal], { type: 'application/pdf' });
        nombrePdfFusionado = `fusion_${Date.now()}.pdf`;

        // Transformar botón para compartir
        btnUnirPdfs.innerText = "📤 ¡LISTO! TOCAR PARA COMPARTIR";
        btnUnirPdfs.style.backgroundColor = "var(--accent-green)";
        btnUnirPdfs.style.color = "#000";
        btnUnirPdfs.disabled = false;

    } catch (error) {
        alert("SISTEMA: Error al procesar los documentos.");
        btnUnirPdfs.innerText = textoOriginal;
        btnUnirPdfs.disabled = false;
    }
});


// ==========================================
// HERRAMIENTA 02: EXTRACCIÓN (SEPARAR PDF)
// ==========================================
const inputPdfSeparar = document.getElementById('inputPdfSeparar');
const infoPdfSeparar = document.getElementById('infoPdfSeparar');
const inputRangoPaginas = document.getElementById('inputRangoPaginas');
const btnSepararPdf = document.getElementById('btnSepararPdf');

let pdfAExtraer = null;
let totalPaginasExtraer = 0;

let pdfExtraidoBlob = null;
let nombrePdfExtraido = null;

function resetearBotonSeparar() {
    pdfExtraidoBlob = null;
    btnSepararPdf.innerText = "EXTRAER A NUEVO PDF";
    btnSepararPdf.style.backgroundColor = "";
    btnSepararPdf.style.color = "";
}

// Si el usuario escribe un nuevo número, hay que generar un PDF nuevo
inputRangoPaginas.addEventListener('input', resetearBotonSeparar);

inputPdfSeparar.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    resetearBotonSeparar();
    infoPdfSeparar.textContent = "Analizando documento... ⏳";

    try {
        const datosBinarios = await archivo.arrayBuffer();
        const { PDFDocument } = PDFLib;

        pdfAExtraer = await PDFDocument.load(datosBinarios);
        totalPaginasExtraer = pdfAExtraer.getPageCount();

        infoPdfSeparar.textContent = `DOCUMENTO CARGADO: ${totalPaginasExtraer} PÁGINAS DETECTADAS.`;
        inputRangoPaginas.disabled = false;
        inputRangoPaginas.style.borderColor = "var(--accent-green)";
        btnSepararPdf.disabled = false;
    } catch (error) {
        infoPdfSeparar.textContent = "[ ERROR AL LEER EL DOCUMENTO ]";
        infoPdfSeparar.style.color = "var(--danger)";
    }
});

function parsearRango(rangoStr, maxPaginas) {
    let paginas = new Set();
    let partes = rangoStr.replace(/\s+/g, '').split(',');

    for (let p of partes) {
        if (p.includes('-')) {
            let [inicio, fin] = p.split('-').map(Number);
            if (inicio && fin && inicio <= fin) {
                for (let i = inicio; i <= fin; i++) {
                    if (i >= 1 && i <= maxPaginas) paginas.add(i - 1);
                }
            }
        } else {
            let num = Number(p);
            if (num >= 1 && num <= maxPaginas) paginas.add(num - 1);
        }
    }
    return Array.from(paginas).sort((a, b) => a - b);
}

btnSepararPdf.addEventListener('click', async () => {
    if (!pdfAExtraer) return;

    // PASO 2: Compartir al instante
    if (pdfExtraidoBlob) {
        compartirOpcionalPwa(pdfExtraidoBlob, nombrePdfExtraido);
        return;
    }

    const rangoUsuario = inputRangoPaginas.value.trim();
    if (rangoUsuario === "") {
        alert("SISTEMA: Debes introducir las páginas que quieres extraer.");
        return;
    }

    const indicesAExtraer = parsearRango(rangoUsuario, totalPaginasExtraer);
    if (indicesAExtraer.length === 0) {
        alert("SISTEMA: Rango inválido o fuera de los límites del documento.");
        return;
    }

    // PASO 1: Procesar
    const textoOriginal = btnSepararPdf.innerText;
    btnSepararPdf.innerText = "EXTRAYENDO PÁGINAS... ⏳";
    btnSepararPdf.disabled = true;

    try {
        const { PDFDocument } = PDFLib;
        const pdfFinal = await PDFDocument.create();

        const paginasCopiadas = await pdfFinal.copyPages(pdfAExtraer, indicesAExtraer);
        for (const pagina of paginasCopiadas) {
            pdfFinal.addPage(pagina);
        }

        const bytesPdfFinal = await pdfFinal.save();
        pdfExtraidoBlob = new Blob([bytesPdfFinal], { type: 'application/pdf' });
        nombrePdfExtraido = `extraccion_${Date.now()}.pdf`;

        btnSepararPdf.innerText = "📤 ¡LISTO! TOCAR PARA COMPARTIR";
        btnSepararPdf.style.backgroundColor = "var(--accent-green)";
        btnSepararPdf.style.color = "#000";
        btnSepararPdf.disabled = false;

    } catch (error) {
        alert("SISTEMA: Error al extraer las páginas.");
        btnSepararPdf.innerText = textoOriginal;
        btnSepararPdf.disabled = false;
    }
});


// ==========================================
// HERRAMIENTA 03: EDICIÓN VISUAL (ROTAR / ELIMINAR)
// ==========================================
const inputPdfEditar = document.getElementById('inputPdfEditar');
const infoPdfEditar = document.getElementById('infoPdfEditar');
const galeriaEdicionPdf = document.getElementById('galeriaEdicionPdf');
const btnGuardarEdicionPdf = document.getElementById('btnGuardarEdicionPdf');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDocEdicionLib = null;
let estadoPaginasPdf = [];

let pdfEditadoBlob = null;
let nombrePdfEditado = null;

function resetearBotonEdicion() {
    pdfEditadoBlob = null;
    btnGuardarEdicionPdf.innerText = "APLICAR CAMBIOS Y GUARDAR";
    btnGuardarEdicionPdf.style.backgroundColor = "";
    btnGuardarEdicionPdf.style.color = "";
}

inputPdfEditar.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    resetearBotonEdicion();
    infoPdfEditar.textContent = "Renderizando vista de rayos X... ⏳";
    galeriaEdicionPdf.innerHTML = '';
    galeriaEdicionPdf.style.display = 'flex';
    btnGuardarEdicionPdf.style.display = 'block';
    btnGuardarEdicionPdf.disabled = true;

    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDocEdicionLib = await PDFLib.PDFDocument.load(arrayBuffer);

        const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
        const pdfVisual = await loadingTask.promise;

        estadoPaginasPdf = [];

        for (let i = 1; i <= pdfVisual.numPages; i++) {
            estadoPaginasPdf.push({ index: i - 1, rotacion: 0, borrada: false });

            const pagina = await pdfVisual.getPage(i);
            const viewportOriginal = pagina.getViewport({ scale: 1 });
            const escala = 120 / viewportOriginal.width;
            const viewport = pagina.getViewport({ scale: escala });

            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'center';
            wrapper.style.minWidth = '120px';
            wrapper.style.margin = '0 10px';
            wrapper.style.transition = 'all 0.3s ease';

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.border = '1px solid var(--border-bright)';
            canvas.style.transition = 'transform 0.3s ease';

            const renderContext = { canvasContext: ctx, viewport: viewport };
            await pagina.render(renderContext).promise;

            const panelControles = document.createElement('div');
            panelControles.style.display = 'flex';
            panelControles.style.gap = '5px';
            panelControles.style.marginTop = '10px';

            const btnRotar = document.createElement('button');
            btnRotar.textContent = '↻ 90º';
            btnRotar.style.padding = '5px';
            btnRotar.style.margin = '0';
            btnRotar.style.width = 'auto';
            btnRotar.onclick = () => {
                resetearBotonEdicion(); // Si se gira, se borra el PDF previo
                const estado = estadoPaginasPdf[i-1];
                estado.rotacion = (estado.rotacion + 90) % 360;
                canvas.style.transform = `rotate(${estado.rotacion}deg)`;
            };

            const btnBorrar = document.createElement('button');
            btnBorrar.textContent = 'X';
            btnBorrar.style.color = 'var(--danger)';
            btnBorrar.style.borderColor = 'var(--danger)';
            btnBorrar.style.backgroundColor = 'transparent';
            btnBorrar.style.padding = '5px 10px';
            btnBorrar.style.margin = '0';
            btnBorrar.style.width = 'auto';
            btnBorrar.onclick = () => {
                resetearBotonEdicion(); // Si se borra algo, se descarta el PDF previo
                const estado = estadoPaginasPdf[i-1];
                estado.borrada = !estado.borrada;

                if (estado.borrada) {
                    wrapper.style.opacity = '0.3';
                    wrapper.style.filter = 'grayscale(100%)';
                    btnBorrar.style.backgroundColor = 'var(--danger)';
                    btnBorrar.style.color = '#fff';
                } else {
                    wrapper.style.opacity = '1';
                    wrapper.style.filter = 'none';
                    btnBorrar.style.backgroundColor = 'transparent';
                    btnBorrar.style.color = 'var(--danger)';
                }
            };

            panelControles.appendChild(btnRotar);
            panelControles.appendChild(btnBorrar);
            wrapper.appendChild(canvas);
            wrapper.appendChild(panelControles);
            galeriaEdicionPdf.appendChild(wrapper);
        }

        infoPdfEditar.textContent = `DOCUMENTO ANALIZADO: ${pdfVisual.numPages} PÁGINAS`;
        btnGuardarEdicionPdf.disabled = false;

    } catch (error) {
        infoPdfEditar.textContent = "[ ERROR AL LEER EL DOCUMENTO ]";
        infoPdfEditar.style.color = "var(--danger)";
    }
});

btnGuardarEdicionPdf.addEventListener('click', async () => {
    // PASO 2
    if (pdfEditadoBlob) {
        compartirOpcionalPwa(pdfEditadoBlob, nombrePdfEditado);
        return;
    }

    // PASO 1
    const textoOriginal = btnGuardarEdicionPdf.innerText;
    btnGuardarEdicionPdf.innerText = "PROCESANDO CAMBIOS... ⏳";
    btnGuardarEdicionPdf.disabled = true;

    try {
        const { PDFDocument, degrees } = PDFLib;
        const pdfFinal = await PDFDocument.create();

        for (let i = 0; i < estadoPaginasPdf.length; i++) {
            const estado = estadoPaginasPdf[i];

            if (!estado.borrada) {
                const [paginaCopiada] = await pdfFinal.copyPages(pdfDocEdicionLib, [estado.index]);

                if (estado.rotacion !== 0) {
                    const rotacionActual = paginaCopiada.getRotation().angle;
                    paginaCopiada.setRotation(degrees(rotacionActual + estado.rotacion));
                }

                pdfFinal.addPage(paginaCopiada);
            }
        }

        const bytesPdfFinal = await pdfFinal.save();
        pdfEditadoBlob = new Blob([bytesPdfFinal], { type: 'application/pdf' });
        nombrePdfEditado = `documento_editado_${Date.now()}.pdf`;

        btnGuardarEdicionPdf.innerText = "📤 ¡LISTO! TOCAR PARA COMPARTIR";
        btnGuardarEdicionPdf.style.backgroundColor = "var(--accent-green)";
        btnGuardarEdicionPdf.style.color = "#000";
        btnGuardarEdicionPdf.disabled = false;

    } catch (error) {
        alert("SISTEMA: Error al aplicar los cambios.");
        btnGuardarEdicionPdf.innerText = textoOriginal;
        btnGuardarEdicionPdf.disabled = false;
    }
});


// ==========================================
// HERRAMIENTA 04: MARCAS DE AGUA Y PAGINACIÓN
// ==========================================
const inputPdfMarcas = document.getElementById('inputPdfMarcas');
const infoPdfMarcas = document.getElementById('infoPdfMarcas');
const inputMarcaAgua = document.getElementById('inputMarcaAgua');
const checkPaginacion = document.getElementById('checkPaginacion');
const btnAplicarMarcas = document.getElementById('btnAplicarMarcas');

let pdfParaMarcasOriginal = null;
let totalPaginasMarcas = 0;

let pdfMarcasBlob = null;
let nombrePdfMarcas = null;

function resetearBotonMarcas() {
    pdfMarcasBlob = null;
    btnAplicarMarcas.innerText = "ESTAMPAR DOCUMENTO";
    btnAplicarMarcas.style.backgroundColor = "";
    btnAplicarMarcas.style.color = "";
}

// Si escribe texto o activa el check, invalidamos el PDF anterior
inputMarcaAgua.addEventListener('input', resetearBotonMarcas);
checkPaginacion.addEventListener('change', resetearBotonMarcas);

inputPdfMarcas.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    resetearBotonMarcas();
    infoPdfMarcas.textContent = "Cargando documento... ⏳";
    infoPdfMarcas.style.color = "var(--text-muted)";

    try {
        pdfParaMarcasOriginal = await file.arrayBuffer();
        const tempDoc = await PDFLib.PDFDocument.load(pdfParaMarcasOriginal);
        totalPaginasMarcas = tempDoc.getPageCount();

        infoPdfMarcas.textContent = `DOCUMENTO CARGADO: ${totalPaginasMarcas} PÁGINAS`;
        infoPdfMarcas.style.color = "var(--accent-green)";

        inputMarcaAgua.disabled = false;
        inputMarcaAgua.style.borderColor = "var(--accent-green)";
        checkPaginacion.disabled = false;
        btnAplicarMarcas.disabled = false;
    } catch (error) {
        infoPdfMarcas.textContent = "[ ERROR AL LEER EL DOCUMENTO ]";
        infoPdfMarcas.style.color = "var(--danger)";
    }
});

btnAplicarMarcas.addEventListener('click', async () => {
    if (!pdfParaMarcasOriginal) return;

    // PASO 2
    if (pdfMarcasBlob) {
        compartirOpcionalPwa(pdfMarcasBlob, nombrePdfMarcas);
        return;
    }

    const textoMarca = inputMarcaAgua.value.trim().toUpperCase();
    const numerar = checkPaginacion.checked;

    if (textoMarca === "" && !numerar) {
        alert("SISTEMA: Introduce un texto o activa la numeración para continuar.");
        return;
    }

    // PASO 1
    const textoOriginal = btnAplicarMarcas.innerText;
    btnAplicarMarcas.innerText = "ESTAMPANDO DOCUMENTO... ⏳";
    btnAplicarMarcas.disabled = true;

    try {
        const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.load(pdfParaMarcasOriginal);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const paginas = pdfDoc.getPages();
        const total = paginas.length;

        paginas.forEach((pagina, i) => {
            const { width, height } = pagina.getSize();

            if (numerar) {
                const textoPagina = `${i + 1} / ${total}`;
                const fontSizePag = 11;
                const textWidth = helveticaFont.widthOfTextAtSize(textoPagina, fontSizePag);

                pagina.drawText(textoPagina, {
                    x: (width / 2) - (textWidth / 2),
                                y: 25,
                                size: fontSizePag,
                                font: helveticaFont,
                                color: rgb(0.3, 0.3, 0.3),
                });
            }

            if (textoMarca !== "") {
                const fontSizeMarca = Math.min(width / (textoMarca.length * 0.5), 100);
                const textWidth = helveticaFont.widthOfTextAtSize(textoMarca, fontSizeMarca);
                const textHeight = helveticaFont.heightAtSize(fontSizeMarca);

                const radianes = Math.PI / 4;
                const xPos = (width / 2) - (textWidth / 2) * Math.cos(radianes) + (textHeight / 2) * Math.sin(radianes);
                const yPos = (height / 2) - (textWidth / 2) * Math.sin(radianes) - (textHeight / 2) * Math.cos(radianes);

                pagina.drawText(textoMarca, {
                    x: xPos,
                    y: yPos,
                    size: fontSizeMarca,
                    font: helveticaFont,
                    color: rgb(0.85, 0.2, 0.2),
                                opacity: 0.15,
                                rotate: degrees(45),
                });
            }
        });

        const bytesPdfFinal = await pdfDoc.save();
        pdfMarcasBlob = new Blob([bytesPdfFinal], { type: 'application/pdf' });
        nombrePdfMarcas = `documento_estampado_${Date.now()}.pdf`;

        btnAplicarMarcas.innerText = "📤 ¡LISTO! TOCAR PARA COMPARTIR";
        btnAplicarMarcas.style.backgroundColor = "var(--accent-green)";
        btnAplicarMarcas.style.color = "#000";
        btnAplicarMarcas.disabled = false;

    } catch (error) {
        alert("SISTEMA: Error al estampar el documento.");
        btnAplicarMarcas.innerText = textoOriginal;
        btnAplicarMarcas.disabled = false;
    }
});
