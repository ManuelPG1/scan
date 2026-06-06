// ==========================================
// HERRAMIENTA 01: FUSIÓN DE PDFS (CON ORDENACIÓN)
// ==========================================
const inputPdfs = document.getElementById('inputPdfs');
const listaPdfsUnir = document.getElementById('listaPdfsUnir');
const btnUnirPdfs = document.getElementById('btnUnirPdfs');

// Ahora guardamos objetos con un ID único para poder arrastrarlos sin perder la referencia del archivo
let lotePdfsParaUnir = [];
let elementoPdfArrastrado = null;

inputPdfs.addEventListener('change', (e) => {
    const nuevosArchivos = Array.from(e.target.files);
    if (nuevosArchivos.length === 0) return;

    // Convertimos cada archivo en un objeto con ID
    nuevosArchivos.forEach(archivo => {
        lotePdfsParaUnir.push({
            id: 'pdf_' + Date.now() + Math.random().toString(36).substring(2),
                              file: archivo
        });
    });

    e.target.value = '';
    actualizarInterfazLotePdfs();
});

// Sincroniza el array interno con el orden visual tras soltar un elemento
function sincronizarOrdenPdfs() {
    const ordenVisualIds = Array.from(listaPdfsUnir.children).map(div => div.dataset.id);
    lotePdfsParaUnir.sort((a, b) => ordenVisualIds.indexOf(a.id) - ordenVisualIds.indexOf(b.id));
}

function actualizarInterfazLotePdfs() {
    listaPdfsUnir.innerHTML = '';

    lotePdfsParaUnir.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.dataset.id = item.id;
        itemDiv.draggable = true; // Lo hacemos arrastrable

        // Estilos técnicos
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
        itemDiv.style.transition = 'transform 0.2s, opacity 0.2s';

        // Lógica Drag & Drop
        itemDiv.addEventListener('dragstart', () => {
            elementoPdfArrastrado = itemDiv;
            itemDiv.style.opacity = '0.4';
            itemDiv.style.cursor = 'grabbing';
        });

        itemDiv.addEventListener('dragend', () => {
            itemDiv.style.opacity = '1';
            itemDiv.style.cursor = 'grab';
            elementoPdfArrastrado = null;
            sincronizarOrdenPdfs(); // Reordenamos el array interno
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
        };

        itemDiv.appendChild(nombreSpan);
        itemDiv.appendChild(btnQuitar);
        listaPdfsUnir.appendChild(itemDiv);
    });

    btnUnirPdfs.disabled = lotePdfsParaUnir.length < 2;
}

// Zona de caída (Drop Zone) vertical
listaPdfsUnir.addEventListener('dragover', (e) => {
    e.preventDefault();
    const elementosArrastrables = [...listaPdfsUnir.querySelectorAll('div:not([style*="opacity: 0.4"])')];

    // Calculamos si el ratón está por encima o por debajo de la mitad del elemento
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

// Motor de Fusión
btnUnirPdfs.addEventListener('click', async () => {
    if (lotePdfsParaUnir.length < 2) return;
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
        const blobPdf = new Blob([bytesPdfFinal], { type: 'application/pdf' });

        if (typeof descargarPwaSeguro === 'function') {
            descargarPwaSeguro(blobPdf, `fusion_${Date.now()}.pdf`);
        }

        btnUnirPdfs.innerText = textoOriginal;
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

// Cargar el PDF para ver cuántas páginas tiene
inputPdfSeparar.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    infoPdfSeparar.textContent = "Analizando documento... ⏳";

    try {
        const datosBinarios = await archivo.arrayBuffer();
        const { PDFDocument } = PDFLib;

        pdfAExtraer = await PDFDocument.load(datosBinarios);
        totalPaginasExtraer = pdfAExtraer.getPageCount();

        infoPdfSeparar.textContent = `DOCUMENTO CARGADO: ${totalPaginasExtraer} PÁGINAS DETECTADAS.`;

        // Habilitamos los controles
        inputRangoPaginas.disabled = false;
        inputRangoPaginas.style.borderColor = "var(--accent-green)";
        btnSepararPdf.disabled = false;

    } catch (error) {
        infoPdfSeparar.textContent = "[ ERROR AL LEER EL DOCUMENTO ]";
        infoPdfSeparar.style.color = "var(--danger)";
    }
});

// Función inteligente para entender comandos de texto como "1, 3, 5-8"
function parsearRango(rangoStr, maxPaginas) {
    let paginas = new Set();
    // Quitamos espacios y separamos por comas
    let partes = rangoStr.replace(/\s+/g, '').split(',');

    for (let p of partes) {
        if (p.includes('-')) {
            // Es un rango (ej: 4-6)
            let [inicio, fin] = p.split('-').map(Number);
            if (inicio && fin && inicio <= fin) {
                for (let i = inicio; i <= fin; i++) {
                    if (i >= 1 && i <= maxPaginas) paginas.add(i - 1); // Restamos 1 porque pdf-lib cuenta desde 0
                }
            }
        } else {
            // Es un número suelto (ej: 3)
            let num = Number(p);
            if (num >= 1 && num <= maxPaginas) paginas.add(num - 1);
        }
    }
    // Devolvemos el array ordenado
    return Array.from(paginas).sort((a, b) => a - b);
}

// Motor de Extracción
btnSepararPdf.addEventListener('click', async () => {
    if (!pdfAExtraer) return;

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

    const textoOriginal = btnSepararPdf.innerText;
    btnSepararPdf.innerText = "EXTRAYENDO PÁGINAS... ⏳";
    btnSepararPdf.disabled = true;

    try {
        const { PDFDocument } = PDFLib;
        const pdfFinal = await PDFDocument.create();

        // Copiamos solo las páginas que el usuario ha pedido
        const paginasCopiadas = await pdfFinal.copyPages(pdfAExtraer, indicesAExtraer);
        for (const pagina of paginasCopiadas) {
            pdfFinal.addPage(pagina);
        }

        const bytesPdfFinal = await pdfFinal.save();
        const blobPdf = new Blob([bytesPdfFinal], { type: 'application/pdf' });

        if (typeof descargarPwaSeguro === 'function') {
            descargarPwaSeguro(blobPdf, `extraccion_${Date.now()}.pdf`);
        }

        btnSepararPdf.innerText = textoOriginal;
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

// Configuramos la ruta del Worker de PDF.js (necesario para que no bloquee el móvil)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDocEdicionLib = null; // El documento matemático original
let estadoPaginasPdf = [];   // Guardaremos qué le hacemos a cada página

inputPdfEditar.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    infoPdfEditar.textContent = "Renderizando vista de rayos X... ⏳";
    galeriaEdicionPdf.innerHTML = '';
    galeriaEdicionPdf.style.display = 'flex';
    btnGuardarEdicionPdf.style.display = 'block';
    btnGuardarEdicionPdf.disabled = true;

    try {
        const arrayBuffer = await file.arrayBuffer();

        // 1. Cargamos el PDF con pdf-lib para la exportación final
        pdfDocEdicionLib = await PDFLib.PDFDocument.load(arrayBuffer);

        // 2. Cargamos el PDF con pdf.js para generar la vista previa
        const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
        const pdfVisual = await loadingTask.promise;

        estadoPaginasPdf = [];

        // 3. Renderizamos cada página
        for (let i = 1; i <= pdfVisual.numPages; i++) {
            // Guardamos el estado base de esta página (0 grados, no borrada)
            estadoPaginasPdf.push({ index: i - 1, rotacion: 0, borrada: false });

            const pagina = await pdfVisual.getPage(i);

            // Calculamos la escala para que todas las miniaturas tengan 120px de ancho
            const viewportOriginal = pagina.getViewport({ scale: 1 });
            const escala = 120 / viewportOriginal.width;
            const viewport = pagina.getViewport({ scale: escala });

            // Contenedor principal de la página
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'center';
            wrapper.style.minWidth = '120px';
            wrapper.style.margin = '0 10px';
            wrapper.style.transition = 'all 0.3s ease';

            // Canvas de la miniatura
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.border = '1px solid var(--border-bright)';
            canvas.style.transition = 'transform 0.3s ease';

            // Renderizado nativo
            const renderContext = { canvasContext: ctx, viewport: viewport };
            await pagina.render(renderContext).promise;

            // Panel de botones de la miniatura
            const panelControles = document.createElement('div');
            panelControles.style.display = 'flex';
            panelControles.style.gap = '5px';
            panelControles.style.marginTop = '10px';

            // Botón Rotar
            const btnRotar = document.createElement('button');
            btnRotar.textContent = '↻ 90º';
            btnRotar.style.padding = '5px';
            btnRotar.style.margin = '0';
            btnRotar.style.width = 'auto';
            btnRotar.onclick = () => {
                const estado = estadoPaginasPdf[i-1];
                estado.rotacion = (estado.rotacion + 90) % 360;
                canvas.style.transform = `rotate(${estado.rotacion}deg)`;
            };

            // Botón Borrar
            const btnBorrar = document.createElement('button');
            btnBorrar.textContent = 'X';
            btnBorrar.style.color = 'var(--danger)';
            btnBorrar.style.borderColor = 'var(--danger)';
            btnBorrar.style.backgroundColor = 'transparent';
            btnBorrar.style.padding = '5px 10px';
            btnBorrar.style.margin = '0';
            btnBorrar.style.width = 'auto';
            btnBorrar.onclick = () => {
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
        console.error(error);
        infoPdfEditar.textContent = "[ ERROR AL LEER EL DOCUMENTO ]";
        infoPdfEditar.style.color = "var(--danger)";
    }
});

// Guardar los cambios físicos en el PDF
btnGuardarEdicionPdf.addEventListener('click', async () => {
    const textoOriginal = btnGuardarEdicionPdf.innerText;
    btnGuardarEdicionPdf.innerText = "PROCESANDO CAMBIOS... ⏳";
    btnGuardarEdicionPdf.disabled = true;

    try {
        const { PDFDocument, degrees } = PDFLib;
        const pdfFinal = await PDFDocument.create();

        for (let i = 0; i < estadoPaginasPdf.length; i++) {
            const estado = estadoPaginasPdf[i];

            // Si la página no ha sido marcada para borrar, la copiamos
            if (!estado.borrada) {
                const [paginaCopiada] = await pdfFinal.copyPages(pdfDocEdicionLib, [estado.index]);

                // Si el usuario la giró en la vista previa, aplicamos los grados matemáticamente
                if (estado.rotacion !== 0) {
                    const rotacionActual = paginaCopiada.getRotation().angle;
                    paginaCopiada.setRotation(degrees(rotacionActual + estado.rotacion));
                }

                pdfFinal.addPage(paginaCopiada);
            }
        }

        const bytesPdfFinal = await pdfFinal.save();
        const blobPdf = new Blob([bytesPdfFinal], { type: 'application/pdf' });

        if (typeof descargarPwaSeguro === 'function') {
            descargarPwaSeguro(blobPdf, `documento_editado_${Date.now()}.pdf`);
        }

        btnGuardarEdicionPdf.innerText = textoOriginal;
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

// 1. Cargar el PDF en memoria
inputPdfMarcas.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    infoPdfMarcas.textContent = "Cargando documento... ⏳";
    infoPdfMarcas.style.color = "var(--text-muted)";

    try {
        // Guardamos los datos binarios en la variable global para poder reutilizarlos
        pdfParaMarcasOriginal = await file.arrayBuffer();

        // Cargamos una copia rápida para saber cuántas hojas tiene
        const tempDoc = await PDFLib.PDFDocument.load(pdfParaMarcasOriginal);
        totalPaginasMarcas = tempDoc.getPageCount();

        infoPdfMarcas.textContent = `DOCUMENTO CARGADO: ${totalPaginasMarcas} PÁGINAS`;
        infoPdfMarcas.style.color = "var(--accent-green)";

        // Habilitamos los controles
        inputMarcaAgua.disabled = false;
        inputMarcaAgua.style.borderColor = "var(--accent-green)";
        checkPaginacion.disabled = false;
        btnAplicarMarcas.disabled = false;
    } catch (error) {
        infoPdfMarcas.textContent = "[ ERROR AL LEER EL DOCUMENTO ]";
        infoPdfMarcas.style.color = "var(--danger)";
    }
});

// 2. Estampar la información
btnAplicarMarcas.addEventListener('click', async () => {
    if (!pdfParaMarcasOriginal) return;

    const textoMarca = inputMarcaAgua.value.trim().toUpperCase();
    const numerar = checkPaginacion.checked;

    if (textoMarca === "" && !numerar) {
        alert("SISTEMA: Introduce un texto o activa la numeración para continuar.");
        return;
    }

    const textoOriginal = btnAplicarMarcas.innerText;
    btnAplicarMarcas.innerText = "ESTAMPANDO DOCUMENTO... ⏳";
    btnAplicarMarcas.disabled = true;

    try {
        // Extraemos las herramientas de dibujo de pdf-lib
        const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;

        // Cargamos el documento original
        const pdfDoc = await PDFDocument.load(pdfParaMarcasOriginal);

        // Incrustamos la fuente Helvetica en negrita por defecto
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const paginas = pdfDoc.getPages();
        const total = paginas.length;

        // Recorremos hoja por hoja para estampar los datos
        paginas.forEach((pagina, i) => {
            const { width, height } = pagina.getSize();

            // A) PAGINACIÓN (Centrado en el pie de página)
            if (numerar) {
                const textoPagina = `${i + 1} / ${total}`;
                const fontSizePag = 11;
                const textWidth = helveticaFont.widthOfTextAtSize(textoPagina, fontSizePag);

                pagina.drawText(textoPagina, {
                    x: (width / 2) - (textWidth / 2),
                                y: 25, // Margen de 25 píxeles desde abajo
                                size: fontSizePag,
                                font: helveticaFont,
                                color: rgb(0.3, 0.3, 0.3), // Gris oscuro para que quede profesional
                });
            }

            // B) MARCA DE AGUA (Diagonal y Transparente en el centro)
            if (textoMarca !== "") {
                // Hacemos que la letra sea grande o pequeña dependiendo de cuánto texto haya puesto el usuario
                const fontSizeMarca = Math.min(width / (textoMarca.length * 0.5), 100);
                const textWidth = helveticaFont.widthOfTextAtSize(textoMarca, fontSizeMarca);
                const textHeight = helveticaFont.heightAtSize(fontSizeMarca);

                // Matemáticas para centrar el texto teniendo en cuenta que lo rotamos 45 grados
                const radianes = Math.PI / 4;
                const xPos = (width / 2) - (textWidth / 2) * Math.cos(radianes) + (textHeight / 2) * Math.sin(radianes);
                const yPos = (height / 2) - (textWidth / 2) * Math.sin(radianes) - (textHeight / 2) * Math.cos(radianes);

                pagina.drawText(textoMarca, {
                    x: xPos,
                    y: yPos,
                    size: fontSizeMarca,
                    font: helveticaFont,
                    color: rgb(0.85, 0.2, 0.2), // Rojo
                                opacity: 0.15, // Muy transparente (15%) para que no tape el contenido real
                                rotate: degrees(45),
                });
            }
        });

        // 3. Guardar y Exportar
        const bytesPdfFinal = await pdfDoc.save();
        const blobPdf = new Blob([bytesPdfFinal], { type: 'application/pdf' });

        if (typeof descargarPwaSeguro === 'function') {
            descargarPwaSeguro(blobPdf, `documento_estampado_${Date.now()}.pdf`);
        }

        btnAplicarMarcas.innerText = textoOriginal;
        btnAplicarMarcas.disabled = false;

    } catch (error) {
        console.error(error);
        alert("SISTEMA: Error al estampar el documento.");
        btnAplicarMarcas.innerText = textoOriginal;
        btnAplicarMarcas.disabled = false;
    }
});
