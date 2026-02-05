// --- ESTADO GLOBAL ---
let filaProcessamento = []; 
let activeConfig = 'Merito'; 

// Configuração Calibrada (A4)
let templates = {
    'Merito': { 
        imgData: null, 
        imgObj: new Image(), 
        posY_percent: 0.30,  
        fontSize_percent: 0.021, // Arial 11/12
        lineHeight_factor: 1.5, 
        bgText: true 
    },
    'Promocao': { 
        imgData: null, 
        imgObj: new Image(), 
        posY_percent: 0.30,
        fontSize_percent: 0.021,
        lineHeight_factor: 1.5,
        bgText: true
    }
};
let generatedCount = 0;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    loadMode();
    loadTemplatesFromStorage();
    loadHistory();
    renderFila();

    // Listeners UI
    const menuToggle = document.getElementById('menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebar = document.getElementById('sidebar');
    const switchMode = document.getElementById('switch-mode');

    if(menuToggle) menuToggle.addEventListener('click', () => sidebar.classList.add('show'));
    if(sidebarClose) sidebarClose.addEventListener('click', () => sidebar.classList.remove('show'));
    if(switchMode) {
        switchMode.addEventListener('change', function() {
            const theme = this.checked ? 'dark' : 'light';
            document.body.classList.toggle('dark', this.checked);
            localStorage.setItem('aegea_mode', theme);
            updateLogo();
        });
    }

    // Sliders
    ['confPosY', 'confPosX', 'confWidth', 'confFontSize'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updateConfigUI);
    });

    // Upload Template
    const bgInput = document.getElementById('bgImageInput');
    if(bgInput) {
        bgInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            showToast("Processando template...", "info");

            let resultData = null;
            if (file.type === 'application/pdf') {
                try { resultData = await loadPdfAsImage(file); } 
                catch (err) { alert("Erro PDF: " + err.message); return; }
            } else {
                resultData = await readFileAsDataURL(file);
            }

            templates[activeConfig].imgData = resultData;
            templates[activeConfig].imgObj.src = resultData;
            templates[activeConfig].imgObj.onload = () => {
                updatePreview();
                saveTemplatesToStorage();
                showToast(`Template ${activeConfig} carregado!`);
            };
        });
    }

    // Upload Excel
    const excelInput = document.getElementById('excelInput');
    if(excelInput) excelInput.addEventListener('change', handleExcelUpload);
    
    // Automação Manual
    const inputSalario = document.getElementById('formSalario');
    const inputExtenso = document.getElementById('formSalarioExtenso');
    if(inputSalario && inputExtenso) {
        inputSalario.addEventListener('blur', function() {
            let val = this.value.replace(/[^\d,.]/g, '').replace(',', '.');
            if(val) {
                const extenso = numeroParaExtenso(parseFloat(val));
                inputExtenso.value = extenso;
            }
        });
    }

    resetSliders();
});

// --- FUNÇÃO: NÚMERO PARA EXTENSO ---
function numeroParaExtenso(v) {
    if (v === 0) return "zero reais";
    
    const unidade = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const centena = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
    const dezena = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const qualificaS = ["reais", "mil", "milhões"];
    const qualificaP = ["reais", "mil", "milhões"];

    let s = "";
    let n = v.toFixed(2).replace(".", ",");
    let [inteiro, decimal] = n.split(",");

    for (let i = inteiro.length, c = 0; i > 0; i -= 3, c++) {
        let gr = inteiro.substring(Math.max(0, i - 3), i);
        let nGr = parseInt(gr, 10);
        let grExt = "";

        if (nGr === 0) continue;

        if (nGr === 100) {
            grExt = "cem";
        } else {
            let cVr = Math.floor(nGr / 100);
            let dVr = Math.floor((nGr % 100) / 10);
            let uVr = (nGr % 10);

            if (cVr > 0) grExt += centena[cVr];
            if (dVr > 0 || uVr > 0) {
                if (grExt !== "") grExt += " e ";
                if (nGr % 100 < 20) {
                    grExt += unidade[nGr % 100];
                } else {
                    grExt += dezena[dVr];
                    if (uVr > 0) grExt += " e " + unidade[uVr];
                }
            }
        }
        
        if (c === 0) {
            s = grExt + (nGr > 1 || nGr === 0 ? " reais" : " real");
        } else {
            let qualif = (nGr > 1) ? qualificaP[c] : qualificaS[c];
            if(c === 1 && nGr === 1) qualif = "mil"; 
            s = grExt + " " + qualif + (s ? " e " + s : " de reais"); 
        }
    }

    let nDec = parseInt(decimal, 10);
    if (nDec > 0) {
        let decExt = "";
        if (nDec < 20) {
            decExt = unidade[nDec];
        } else {
            decExt = dezena[Math.floor(nDec / 10)];
            if (nDec % 10 > 0) decExt += " e " + unidade[nDec % 10];
        }
        s += " e " + decExt + (nDec > 1 ? " centavos" : " centavo");
    }

    return s.trim();
}

// --- HELPER ARQUIVOS ---
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function loadPdfAsImage(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 3.0 }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.95);
}

// --- ENGINE DE TEXTO (ARIAL + NEGRITO) ---
function drawRichText(ctx, text, x, y, maxWidth, fontSize, lineHeight) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    let currentX = x;
    let currentY = y;
    
    const fontRegular = `${fontSize}px Arial`; 
    const fontBold = `bold ${fontSize}px Arial`;

    parts.forEach(part => {
        if (!part) return;

        let isBold = false;
        let content = part;

        if (part.startsWith('**') && part.endsWith('**')) {
            isBold = true;
            content = part.slice(2, -2); 
        }

        ctx.font = isBold ? fontBold : fontRegular;
        ctx.fillStyle = "#000000";

        const words = content.split(' ');
        
        words.forEach((word, index) => {
            const metrics = ctx.measureText(word);
            const spaceMetrics = ctx.measureText(" ");
            
            if (currentX + metrics.width > x + maxWidth) {
                currentX = x; 
                currentY += lineHeight;
            }

            ctx.fillText(word, currentX, currentY);
            
            if (index < words.length - 1 || content.endsWith(' ')) {
                 currentX += metrics.width + spaceMetrics.width;
            } else {
                 currentX += metrics.width;
            }
        });
    });

    return currentY + lineHeight;
}

// --- DESENHO PRINCIPAL (GERAÇÃO) ---
function desenharCarta(ctx, dados, cfg) {
    if(cfg.imgObj.src) ctx.drawImage(cfg.imgObj, 0, 0);

    const W = cfg.imgObj.width;
    const H = cfg.imgObj.height;

    // Layout
    let marginX = W * 0.12; 
    let contentWidth = W * 0.76; 
    let fSize = Math.floor(W * cfg.fontSize_percent); 
    let startY = H * cfg.posY_percent;

    const sliderY = parseInt(document.getElementById('confPosY').value); 
    const sliderX = parseInt(document.getElementById('confPosX').value); 
    const sliderW = parseInt(document.getElementById('confWidth').value); 
    const sliderF = parseInt(document.getElementById('confFontSize').value);

    if(sliderY !== 500) startY += (sliderY - 500) * 2; 
    if(sliderX !== 150) marginX += (sliderX - 150);
    if(sliderW !== 650) contentWidth += (sliderW - 650);
    if(sliderF !== 22) fSize += (sliderF - 22);

    const lineHeight = fSize * cfg.lineHeight_factor;

    // Limpeza
    ctx.fillStyle = "#ffffff";
    const whiteY = startY - fSize; 
    const whiteH = H * 0.55; 
    ctx.fillRect(W * 0.08, whiteY, W * 0.84, whiteH);

    // Dados (Aqui garantimos que Cargo e CargoGestor sejam coisas diferentes)
    const nome = dados.Nome || "NOME COLABORADOR";
    const data = dados.Data || "DATA";
    
    // CARGO DO FUNCIONÁRIO (No Texto)
    const cargoFuncionario = dados.Cargo || "NOVO CARGO"; 
    
    const salario = dados.Salario || "R$ 0,00";
    
    let extensoTexto = dados.SalarioExtenso;
    if (!extensoTexto || extensoTexto.trim() === "") {
        let valorNum = parseFloat(salario.replace("R$", "").replace(/\./g, "").replace(",", ".").trim());
        if (!isNaN(valorNum)) {
            extensoTexto = numeroParaExtenso(valorNum);
        }
    }
    const extenso = extensoTexto ? `(${extensoTexto})` : "";
    
    let rawPct = dados.Porcentagem ? String(dados.Porcentagem).trim() : "";
    let pct = "";
    let showPct = false;

    if (rawPct && rawPct !== "0" && rawPct !== "0%" && rawPct !== "0.00") {
        showPct = true;
        if(rawPct.includes('%')) {
            pct = rawPct;
        } else {
            if (!isNaN(rawPct) && parseFloat(rawPct) < 1 && parseFloat(rawPct) > 0) {
                 pct = (parseFloat(rawPct) * 100).toFixed(0) + "%";
            } else {
                 pct = rawPct + "%";
            }
        }
    }

    let paragrafos = [];

    // --- TEXTO (Usa cargoFuncionario) ---
    if (dados.Tipo === 'Promocao') {
        paragrafos.push(`Prezado(a), **${nome}**`);
        paragrafos.push(`Trabalhar com um propósito tão valioso só é possível porque contamos com pessoas como você em nosso time.`);
        
        let fraseSalario = `Por isso, a partir de **${data}**, você assume um novo ciclo como **${cargoFuncionario}**, com nova remuneração mensal de **${salario}** **${extenso}**`;
        
        if (showPct) {
            fraseSalario += ` com **${pct}** reajuste.`;
        } else {
            fraseSalario += `.`;
        }
        paragrafos.push(fraseSalario);

        paragrafos.push(`A nossa natureza é saber que trabalhamos, de sol a sol, para vidas mais plenas de cidadania.`);
        paragrafos.push(`**Nossa Natureza Movimenta a Vida!**`);
        paragrafos.push(`Obrigada por acreditar neste propósito!`);
    } else {
        paragrafos.push(`Prezada(o), **${nome}**`);
        paragrafos.push(`Suas conquistas profissionais constituem-se em motivo de grande satisfação para a Aegea e, por isto, temos o prazer de cumprimentá-lo(a) pelo reconhecimento alcançado nesta trajetória.`);
        
        let fraseMerito = `Desta forma, informamos novo salário base de **${salario}** **${extenso}**`;
        
        if (showPct) {
            fraseMerito += `, com **${pct}** reajuste`;
        }
        
        fraseMerito += `, vigente a partir de **${data}**.`;
        
        paragrafos.push(fraseMerito);

        paragrafos.push(`Estamos confiantes de que você terá ainda mais oportunidades de contribuir para o crescimento da Aegea.`);
        paragrafos.push(`Contamos com a continuidade de seu apoio.`);
    }

    // Renderiza Texto
    let cursorY = startY;
    paragrafos.forEach(p => {
        if (p.includes("Nossa Natureza")) cursorY += fSize * 0.5;
        cursorY = drawRichText(ctx, p, marginX, cursorY, contentWidth, fSize, lineHeight);
        cursorY += (fSize * 0.8); 
    });

    // --- ASSINATURAS (Usa CargoGestor no rodapé) ---
    const footerY = cursorY + fSize * 3;
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(W * 0.08, footerY - fSize, W * 0.84, fSize * 5);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "left"; 
    const signatureX = marginX;

    // NOME GESTOR
    ctx.font = `bold ${fSize}px Arial`;
    ctx.fillText((dados.Gestor || "NOME GESTOR").toUpperCase(), signatureX, footerY);
    
    // CARGO GESTOR (Buscado corretamente)
    ctx.font = `bold ${fSize}px Arial`; 
    // Garante maiúsculo
    ctx.fillText((dados.CargoGestor || "CARGO").toUpperCase(), signatureX, footerY + (fSize * 1.4));
}

// --- BOILERPLATE E IMPORTAÇÃO INTELIGENTE ---
function resetSliders() {
    document.getElementById('confPosY').value = 500; 
    document.getElementById('confPosX').value = 150; 
    document.getElementById('confWidth').value = 650;
    document.getElementById('confFontSize').value = 22;
}

function updatePreview() {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const cfg = templates[activeConfig];

    if(!cfg.imgData) { ctx.clearRect(0,0,canvas.width,canvas.height); return; }

    canvas.width = cfg.imgObj.width;
    canvas.height = cfg.imgObj.height;

    const mock = { 
        Nome: "JOÃO ARAÚJO MENDONÇA NETO", 
        Tipo: activeConfig, 
        Data: "01/01/2026", 
        Salario: "R$ 5.000,00", 
        SalarioExtenso: "",
        Porcentagem: "20", 
        Gestor: "MARIA SILVA",
        Cargo: "ANALISTA DE SISTEMAS", 
        CargoGestor: "GERENTE DE RH"
    };
    desenharCarta(ctx, mock, cfg);
}

window.switchConfigTab = function(type) {
    activeConfig = type;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btns = document.querySelectorAll('.tab-btn');
    if(type === 'Merito') btns[0].classList.add('active'); else btns[1].classList.add('active');
    document.getElementById('configTitle').innerText = `Ajustando: ${type}`;
    if(templates[type].imgData) { document.getElementById('noImageMsg').style.display = 'none'; updatePreview(); } 
    else { document.getElementById('noImageMsg').style.display = 'block'; const c = document.getElementById('previewCanvas'); c.getContext('2d').clearRect(0,0,c.width,c.height); }
}

function updateConfigUI() { updatePreview(); }
window.salvarConfigAtual = function() { saveTemplatesToStorage(); showToast(`Config salva!`); }

function saveTemplatesToStorage() {
    const dataToSave = { Merito: { ...templates.Merito, imgData: null }, Promocao: { ...templates.Promocao, imgData: null } };
    localStorage.setItem('aegea_templates_cfg', JSON.stringify(dataToSave));
}

function loadTemplatesFromStorage() {
    const saved = localStorage.getItem('aegea_templates_cfg');
    if(saved) {
        const parsed = JSON.parse(saved);
        if(parsed.Merito) { Object.assign(templates.Merito, parsed.Merito); templates.Merito.imgObj = new Image(); }
        if(parsed.Promocao) { Object.assign(templates.Promocao, parsed.Promocao); templates.Promocao.imgObj = new Image(); }
    }
}

function loadMode() { const mode = localStorage.getItem('aegea_mode'); if(mode==='dark') { document.body.classList.add('dark'); document.getElementById('switch-mode').checked=true; } updateLogo(); }
function updateLogo() { const logo = document.getElementById('logo-img'); const isDark = document.body.classList.contains('dark'); if(logo) logo.src = isDark ? 'logo-branco.png' : 'logo-azul.png'; }

window.switchPage = function(pageId, linkElement) {
    document.querySelectorAll('.page-section').forEach(el => { el.classList.remove('active'); el.classList.add('hidden'); });
    const target = document.getElementById(`page-${pageId}`);
    if(target) { target.classList.remove('hidden'); setTimeout(() => target.classList.add('active'), 10); }
    if(linkElement) { document.querySelectorAll('.side-menu li').forEach(li => li.classList.remove('active')); linkElement.parentElement.classList.add('active'); }
    if(window.innerWidth < 992) document.getElementById('sidebar').classList.remove('show');
}

window.toggleCargoField = function() { const tipo = document.getElementById('formTipo').value; const group = document.getElementById('groupCargo'); if(group) { if(tipo === 'Promocao') group.classList.remove('hidden'); else group.classList.add('hidden'); } }

window.adicionarManual = function() {
    const nome = document.getElementById('formNome').value;
    if(!nome) { showToast('Nome obrigatório!', 'error'); return; }
    const dados = {
        Nome: nome, Tipo: document.getElementById('formTipo').value, Data: document.getElementById('formData').value,
        Salario: document.getElementById('formSalario').value, SalarioExtenso: document.getElementById('formSalarioExtenso').value,
        Porcentagem: document.getElementById('formPct').value, Gestor: document.getElementById('formGestor').value,
        CargoGestor: document.getElementById('formCargoGestor').value, Cargo: document.getElementById('formCargo').value
    };
    filaProcessamento.push(dados); renderFila(); showToast('Adicionado!'); document.getElementById('formNome').value = '';
}

// --- IMPORTAÇÃO EXCEL (BUSCA AGRESSIVA POR COLUNAS) ---
function handleExcelUpload(e) {
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, {type: 'array', cellDates: true});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(firstSheet);
            
            const novos = json.map(row => {
                let tipo = 'Merito';
                const motivo = row['Motivo do evento'] || '';
                if(motivo.toString().toUpperCase().includes('PROMO')) tipo = 'Promocao';
                
                let salRaw = parseFloat(row['Montante']);
                let sal = 'R$ 0,00';
                if(row['Montante']) sal = salRaw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                
                let extenso = row['Salario por Extenso'] || row['Extenso'] || '';
                if(!extenso && !isNaN(salRaw)) {
                    extenso = numeroParaExtenso(salRaw);
                }

                let data = '01/01/2026';
                if(row['Data do evento']) { const d = new Date(row['Data do evento']); if(!isNaN(d.getTime())) data = d.toLocaleDateString('pt-BR'); else data = row['Data do evento']; }
                
                // --- 1. CARGO FUNCIONÁRIO ---
                let cargoFuncionario = row['Nome do Cargo'] || row['Novo Cargo'] || row['Cargo'] || '';

                // --- 2. CARGO GESTOR (BUSCA AGRESSIVA) ---
                let cargoGestor = '';
                
                // Função para normalizar: minúsculo e sem NENHUM caractere especial ou espaço
                const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

                // Procura a coluna
                const chaves = Object.keys(row);
                const chaveEncontrada = chaves.find(k => {
                    const limpa = normalize(k);
                    // "Cargo Gestor" -> "cargogestor"
                    return limpa.includes('cargo') && limpa.includes('gestor');
                });

                if (chaveEncontrada) {
                    cargoGestor = row[chaveEncontrada];
                }

                return { 
                    id: Date.now() + Math.random(), 
                    Nome: row['Nome completo'] || row['Nome'] || 'Sem Nome', 
                    Gestor: row['Superior Imediato'] || row['Gestor'] || '', 
                    
                    // SEPARAÇÃO CLARA
                    Cargo: cargoFuncionario, // Corpo
                    CargoGestor: cargoGestor || '', // Rodapé
                    
                    Salario: sal, 
                    Data: data, 
                    Tipo: tipo, 
                    Porcentagem: row['Porcentagem'] || '', 
                    SalarioExtenso: extenso
                };
            });
            filaProcessamento = [...filaProcessamento, ...novos]; renderFila(); showToast(`${novos.length} importados!`); window.switchPage('dashboard');
        } catch(err) { alert('Erro Excel'); }
    };
    reader.readAsArrayBuffer(e.target.files[0]);
}

function renderFila() {
    const tbody = document.getElementById('queueBody'); const empty = document.getElementById('emptyQueue'); const count = document.getElementById('queueCount');
    if(!tbody) return; tbody.innerHTML = ''; if(count) count.innerText = filaProcessamento.length;
    if(filaProcessamento.length === 0) empty.style.display = 'block'; else empty.style.display = 'none';
    filaProcessamento.forEach((item, index) => {
        const tr = document.createElement('tr');
        const style = item.Tipo === 'Promocao' ? 'background:#e3f2fd; color:#0066ff' : 'background:#fff3e0; color:#ff6600';
        tr.innerHTML = `<td><strong>${item.Nome}</strong></td><td><span style="padding:4px 10px; border-radius:12px; font-size:12px; font-weight:700; ${style}">${item.Tipo}</span></td><td>${item.Cargo || '-'}</td><td>${item.Salario || '-'}</td><td style="text-align: right;"><button class="icon-btn" onclick="removeItem(${index})"><i class='bx bx-trash'></i></button></td>`;
        tbody.appendChild(tr);
    });
}

window.removeItem = function(index) { filaProcessamento.splice(index, 1); renderFila(); }
window.limparFila = function() { if(confirm("Limpar?")) { filaProcessamento = []; renderFila(); } }

window.processarFila = async function() {
    if(!templates.Merito.imgData && !templates.Promocao.imgData) { showToast("Carregue templates!", "error"); window.switchPage('settings'); return; }
    if(filaProcessamento.length === 0) { showToast("Fila vazia", "error"); return; }
    const zip = new JSZip(); const { jsPDF } = window.jspdf; const tCanvas = document.createElement('canvas'); const ctx = tCanvas.getContext('2d');
    for(let item of filaProcessamento) {
        let cfg = (item.Tipo === 'Promocao' && templates.Promocao.imgData) ? templates.Promocao : templates.Merito;
        if(!cfg.imgData) continue;
        tCanvas.width = cfg.imgObj.width; tCanvas.height = cfg.imgObj.height;
        desenharCarta(ctx, item, cfg);
        const imgData = tCanvas.toDataURL('image/jpeg', 0.9);
        const pdf = new jsPDF({ orientation: tCanvas.width > tCanvas.height ? 'l' : 'p', unit: 'px', format: [tCanvas.width, tCanvas.height] });
        pdf.addImage(imgData, 'JPEG', 0, 0, tCanvas.width, tCanvas.height);
        const nomeSafe = (item.Nome || 'carta').replace(/[^a-z0-9]/gi, '_');
        zip.file(`${item.Tipo}_${nomeSafe}.pdf`, pdf.output('blob'));
        generatedCount++; salvarHistorico(item);
    }
    document.getElementById('generatedCount').innerText = generatedCount;
    const content = await zip.generateAsync({type:"blob"}); saveAs(content, "Cartas_Aegea.zip");
    filaProcessamento = []; renderFila(); loadHistory(); showToast("Download iniciado!");
}

function salvarHistorico(item) { let hist = JSON.parse(localStorage.getItem('aegea_hist')) || []; hist.unshift({date: new Date().toLocaleDateString(), ...item}); localStorage.setItem('aegea_hist', JSON.stringify(hist)); }
function loadHistory() { const tbody = document.getElementById('historyBody'); if(!tbody) return; const hist = JSON.parse(localStorage.getItem('aegea_hist')) || []; tbody.innerHTML = ''; hist.forEach(h => { tbody.innerHTML += `<tr><td>${h.date}</td><td>${h.Nome}</td><td>${h.Tipo}</td></tr>`; }); }
window.limparHistorico = function() { localStorage.removeItem('aegea_hist'); loadHistory(); }
function showToast(message, type='success') { const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = 'toast'; toast.innerText = message; if(type==='error') toast.style.borderLeftColor = '#ef4444'; container.appendChild(toast); setTimeout(() => { toast.remove(); }, 3000); }