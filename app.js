// ============================================================
//  app.js — Dashboard GRO Saúde
//  Lógica de auth, filtros, gráficos e tabela
// ============================================================

const CORES_TIPO = ["#1B392A","#3AB86A","#e74c3c","#f39c12","#2980b9","#9b59b6","#1abc9c","#e67e22"];
const MESES_PT   = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const TIPO_BG = {
  "ASO Admissional":    "#1B392A",
  "ASO Periódico":      "#3AB86A",
  "ASO Demissional":    "#e74c3c",
  "ASO Retorno":        "#e67e22",
  "ASO Mudança de Função": "#9b59b6",
  "Consulta Médica":    "#2980b9",
  "Coleta Laboratorial":"#1abc9c",
};

// ---- STATE ----
let dadosOriginais = [...GRO_EXAMES];
let filteredData   = [];
let tableData      = [];
let currentPage    = 1;
const PAGE_SIZE    = 15;
let sortKey        = "data";
let sortAsc        = false;
let tableSearch    = "";
let charts         = {};

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  const user = GRO_AUTH.requireLogin();
  if (!user) return;

  document.getElementById("userName").textContent = user.name;

  // Mostra link "Gerenciar Usuários" apenas para admin
  if (user.role === "admin") {
    const nav = document.querySelector(".header-actions");
    if (nav && !document.getElementById("linkUsuarios")) {
      const a = document.createElement("a");
      a.id = "linkUsuarios";
      a.href = "usuarios.html";
      a.className = "btn-agenda";
      a.style.cssText = "background:rgba(255,255,255,.1)";
      a.innerHTML = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg> Usuários';
      nav.insertBefore(a, nav.firstChild);
    }
  }

  setDate();
  mesclarAgendamentosLocais();
  populateFilters();
  applyFilters();
  setupListeners();

  // Lê dados reais da planilha Google Sheets (se ativado em config)
  if (GRO_CONFIG.USAR_SHEETS && GRO_CONFIG.SHEET_ID) {
    lerPlanilhaCSV();
  }
});

// ---- LEITURA DIRETA DA PLANILHA (gviz CSV, planilha pública) ----
async function lerPlanilhaCSV() {
  const btn = document.getElementById("btnSyncSheets");
  if (btn) { btn.textContent = "⟳ Lendo planilha..."; btn.disabled = true; }
  try {
    const url = GRO_CONFIG.getSheetCsvUrl(GRO_CONFIG.SHEET_ABA);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const csv = await resp.text();
    const registros = parseCSVExames(csv);
    if (registros.length > 0) {
      dadosOriginais = registros;
      mesclarAgendamentosLocais();
      populateFilters();
      applyFilters();
      if (btn) btn.textContent = "✓ Planilha conectada";
      mostrarStatusConexao(true, registros.length);
    } else {
      if (btn) btn.textContent = "⟳ Sincronizar Planilha";
      mostrarStatusConexao(false);
    }
  } catch (err) {
    if (btn) btn.textContent = "⚠ Planilha não pública";
    mostrarStatusConexao(false);
  }
  if (btn) { btn.disabled = false; setTimeout(() => { btn.textContent = "⟳ Sincronizar Planilha"; }, 5000); }
}

// Parser de CSV -> registros de exames
function parseCSVExames(csv) {
  const linhas = csv.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return [];
  const out = [];
  for (let i = 1; i < linhas.length; i++) {
    const campos = parseCSVLine(linhas[i]);
    if (campos.length < 6) continue;
    let data = (campos[0]||"").trim();
    // normaliza data DD/MM/AAAA -> AAAA-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      const [d,m,y] = data.split("/"); data = `${y}-${m}-${d}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    out.push({
      data, tipo: (campos[1]||"").trim(), descricao: (campos[2]||"").trim(),
      empresa: (campos[3]||"").trim(), paciente: (campos[4]||"").trim(),
      status: (campos[5]||"Realizado").trim(),
    });
  }
  return out;
}

function parseCSVLine(line) {
  const res = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i+1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === "," && !q) { res.push(cur); cur = ""; }
    else cur += c;
  }
  res.push(cur);
  return res;
}

function mostrarStatusConexao(ok, n) {
  const sub = document.getElementById("headerSubtitle");
  if (ok && sub) sub.insertAdjacentHTML("beforeend", ` · <span style="color:#9be8b8">● planilha conectada (${n} registros)</span>`);
}

// Compat: botão antigo aponta para a nova leitura
function sincronizarSheets() { lerPlanilhaCSV(); }

function setDate() {
  const now = new Date();
  document.getElementById("dataAtual").textContent =
    now.toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" });
}

// ---- SINCRONIZAR GOOGLE SHEETS ----
async function sincronizarSheets() {
  if (!GRO_CONFIG.SHEETS_URL) {
    alert("Configure o SHEETS_URL em config.js para sincronizar com o Google Sheets.");
    return;
  }
  const btn = document.getElementById("btnSyncSheets");
  btn.textContent = "⟳ Sincronizando...";
  btn.disabled = true;
  try {
    const r = await fetch(GRO_CONFIG.SHEETS_URL + "?action=listExames");
    const d = await r.json();
    if (d.success && Array.isArray(d.data) && d.data.length > 0) {
      dadosOriginais = d.data;
      mesclarAgendamentosLocais();
      populateFilters();
      applyFilters();
      btn.textContent = "✓ Sheets sincronizado";
    } else {
      btn.textContent = "⟳ Sincronizar Sheets";
    }
  } catch {
    btn.textContent = "⚠ Falha na conexão";
  }
  btn.disabled = false;
  setTimeout(() => { btn.textContent = "⟳ Sincronizar Sheets"; }, 4000);
}

// Mescla agendamentos criados na tela de agendamento como registros do dashboard
function mesclarAgendamentosLocais() {
  try {
    const agendamentos = JSON.parse(localStorage.getItem("gro_agendamentos")) || [];
    const idsExistentes = new Set(dadosOriginais.map(r => r.data + r.paciente + r.descricao));
    agendamentos.forEach(a => {
      const key = a.data + a.paciente + a.descricao;
      if (!idsExistentes.has(key)) {
        dadosOriginais.push({
          data:      a.data,
          tipo:      a.tipo,
          descricao: a.descricao,
          empresa:   a.empresa,
          paciente:  a.paciente,
          status:    a.status || "Agendado",
        });
      }
    });
  } catch { /* ignore */ }
}

// ---- FILTROS ----
function populateFilters() {
  const tipos    = [...new Set(dadosOriginais.map(r => r.tipo))].sort();
  const empresas = [...new Set(dadosOriginais.map(r => r.empresa))].sort();
  const selTipo  = document.getElementById("filterTipo");
  const selEmp   = document.getElementById("filterEmpresa");
  const prevTipo = selTipo.value;
  const prevEmp  = selEmp.value;
  selTipo.innerHTML = '<option value="todos">Todos</option>';
  selEmp.innerHTML  = '<option value="todas">Todas</option>';
  tipos.forEach(t => { const o = document.createElement("option"); o.value = t; o.textContent = t; selTipo.appendChild(o); });
  empresas.forEach(e => { const o = document.createElement("option"); o.value = e; o.textContent = e; selEmp.appendChild(o); });
  if (prevTipo) selTipo.value = prevTipo;
  if (prevEmp)  selEmp.value  = prevEmp;
}

function setupListeners() {
  ["filterAno","filterMes","filterTipo","filterEmpresa","filterStatus"].forEach(id =>
    document.getElementById(id).addEventListener("change", applyFilters));
  document.getElementById("tableSearch").addEventListener("input", e => {
    tableSearch = e.target.value.toLowerCase();
    currentPage = 1;
    renderTable();
  });
}

function applyFilters() {
  const ano    = document.getElementById("filterAno").value;
  const mes    = document.getElementById("filterMes").value;
  const tipo   = document.getElementById("filterTipo").value;
  const emp    = document.getElementById("filterEmpresa").value;
  const status = document.getElementById("filterStatus").value;

  filteredData = dadosOriginais.filter(r => {
    const d = new Date(r.data + "T12:00:00");
    if (ano    !== "todos" && d.getFullYear().toString() !== ano) return false;
    if (mes    !== "todos" && (d.getMonth()+1).toString() !== mes) return false;
    if (tipo   !== "todos" && r.tipo    !== tipo) return false;
    if (emp    !== "todas" && r.empresa !== emp)  return false;
    if (status !== "todos" && r.status  !== status) return false;
    return true;
  });

  updateSubtitle();
  updateKPIs();
  renderAllCharts();
  currentPage = 1;
  tableSearch = "";
  if (document.getElementById("tableSearch"))
    document.getElementById("tableSearch").value = "";
  renderTable();
}

function resetFiltros() {
  ["filterAno","filterMes","filterTipo","filterEmpresa","filterStatus"].forEach(id => {
    const el = document.getElementById(id);
    el.selectedIndex = 0;
  });
  applyFilters();
}

function updateSubtitle() {
  const ano = document.getElementById("filterAno").value;
  const mes = document.getElementById("filterMes").value;
  let txt = `${filteredData.length} exame(s) no período`;
  if (ano !== "todos") txt += ` · ${ano}`;
  if (mes !== "todos") txt += ` / ${MESES_FULL[+mes-1]}`;
  document.getElementById("headerSubtitle").textContent = txt;
}

// ---- KPIs ----
function updateKPIs() {
  const total      = filteredData.length;
  const realizados = filteredData.filter(r => r.status === "Realizado").length;
  const agendados  = filteredData.filter(r => r.status === "Agendado").length;
  const empresas   = new Set(filteredData.map(r => r.empresa)).size;
  const tipos      = new Set(filteredData.map(r => r.tipo)).size;
  const dias       = new Set(filteredData.map(r => r.data)).size;
  const media      = dias > 0 ? (total / dias).toFixed(1) : "—";

  // Variação vs período anterior (comparação simples com total geral)
  const anoSel = document.getElementById("filterAno").value;
  let trend = "";
  if (anoSel !== "todos" && +anoSel > 2024) {
    const anoAnt = +anoSel - 1;
    const totAnt = dadosOriginais.filter(r => new Date(r.data+"T12:00:00").getFullYear() === anoAnt).length;
    if (totAnt > 0) {
      const pct = (((total - totAnt) / totAnt) * 100).toFixed(0);
      trend = pct >= 0 ? `▲ ${pct}% vs ${anoAnt}` : `▼ ${Math.abs(pct)}% vs ${anoAnt}`;
    }
  }

  document.getElementById("kpiTotal").textContent      = total.toLocaleString("pt-BR");
  document.getElementById("kpiRealizados").textContent = realizados.toLocaleString("pt-BR");
  document.getElementById("kpiAgendados").textContent  = agendados.toLocaleString("pt-BR");
  document.getElementById("kpiEmpresas").textContent   = empresas;
  document.getElementById("kpiMedia").textContent      = media;
  document.getElementById("kpiTipos").textContent      = tipos;
  document.getElementById("kpiTotalTrend").textContent = trend;
  document.getElementById("kpiTotalTrend").style.color = trend.startsWith("▲") ? "#27ae60" : trend ? "#e74c3c" : "";
  document.getElementById("kpiRealizadosPct").textContent = total > 0 ? `${((realizados/total)*100).toFixed(1)}% do total` : "";
  document.getElementById("kpiAgendadosPct").textContent  = total > 0 ? `${((agendados/total)*100).toFixed(1)}% do total` : "";
}

// ---- CHARTS ----
function renderAllCharts() {
  renderChartAnual();
  renderChartMensal();
  renderChartTipo();
  renderChartDescricao();
  renderChartSemanal();
  renderChartEmpresa();
  renderChartTipoTempo();
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

/* Anual — compara 2024, 2025, 2026 */
function renderChartAnual() {
  destroyChart("anual");
  const anos   = [2024, 2025, 2026];
  const totais = anos.map(a => dadosOriginais.filter(r => new Date(r.data+"T12:00:00").getFullYear() === a).length);
  const ctx    = document.getElementById("chartAnual").getContext("2d");

  // Gradientes
  const grads = anos.map((_, i) => {
    const g = ctx.createLinearGradient(0, 0, 0, 280);
    g.addColorStop(0, CORES_TIPO[i] + "DD"); g.addColorStop(1, CORES_TIPO[i] + "33");
    return g;
  });

  charts["anual"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: anos.map(String),
      datasets: [{
        label: "Exames realizados",
        data: totais,
        backgroundColor: grads,
        borderColor: CORES_TIPO.slice(0,3),
        borderWidth: 2, borderRadius: 10, borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => ` ${c.parsed.y.toLocaleString("pt-BR")} exames`,
            afterLabel: c => {
              const prev = totais[c.dataIndex - 1];
              if (!prev) return '';
              const pct = (((c.parsed.y - prev) / prev)*100).toFixed(1);
              return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs ano anterior`;
            }
          }
        },
        datalabels: { display: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12, weight: '700' } } },
        y: { grid: { color: "#f0f4f1" }, ticks: { font: { size: 11 } }, beginAtZero: true }
      }
    }
  });
}

/* Mensal comparativo — 2024 vs 2025 vs 2026 sobrepostos */
function renderChartMensal() {
  destroyChart("mensal");
  const anos = [2024, 2025, 2026];
  const coresAno = ["#7f9e8a", "#3AB86A", "#1B392A"];

  const datasets = anos.map((ano, idx) => {
    const byMes = MESES_PT.map((_, m) =>
      dadosOriginais.filter(r => {
        const d = new Date(r.data+"T12:00:00");
        return d.getFullYear() === ano && d.getMonth() === m;
      }).length
    );
    const cor = coresAno[idx];
    return {
      label: String(ano),
      data: byMes,
      borderColor: cor,
      backgroundColor: cor + "18",
      borderWidth: idx === 2 ? 3 : 2,
      pointBackgroundColor: cor,
      pointRadius: idx === 2 ? 5 : 3,
      pointHoverRadius: 7,
      fill: false,
      tension: .38,
    };
  });

  const ctx = document.getElementById("chartMensal").getContext("2d");
  charts["mensal"] = new Chart(ctx, {
    type: "line",
    data: { labels: MESES_PT, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { font: { size: 11, weight: '600' }, usePointStyle: true, boxWidth: 8, padding: 12 } },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: { grid: { color: "#f0f4f1" }, ticks: { font: { size: 11 } } },
        y: { grid: { color: "#f0f4f1" }, ticks: { font: { size: 11 } }, beginAtZero: true }
      },
      interaction: { mode: "index", intersect: false }
    }
  });
}

/* Por tipo — donut */
function renderChartTipo() {
  destroyChart("tipo");
  const map = {};
  filteredData.forEach(r => { map[r.tipo] = (map[r.tipo]||0)+1; });
  const labels = Object.keys(map).sort((a,b) => map[b]-map[a]);
  const values = labels.map(k => map[k]);
  const cores  = labels.map(k => TIPO_BG[k] || "#999");
  const ctx    = document.getElementById("chartTipo").getContext("2d");
  charts["tipo"] = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: cores, borderWidth: 2, borderColor: "#fff", hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 8, padding: 8 } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed} (${((c.parsed / c.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)` } }
      },
      cutout: "58%"
    }
  });
}

/* Por descrição — barras horizontais */
function renderChartDescricao() {
  destroyChart("descricao");
  const map    = {};
  filteredData.forEach(r => { map[r.descricao] = (map[r.descricao]||0)+1; });
  const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,12);
  const labels = sorted.map(([k])=>k);
  const values = sorted.map(([,v])=>v);
  const CORES_D = ["#1B392A","#3AB86A","#2980b9","#8e44ad","#e67e22","#e74c3c","#1abc9c","#d35400","#c0392b","#f39c12","#7f8c8d","#27ae60"];
  const ctx = document.getElementById("chartDescricao").getContext("2d");
  charts["descricao"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Quantidade", data: values,
        backgroundColor: labels.map((_,i) => CORES_D[i % CORES_D.length] + "CC"),
        borderColor:     labels.map((_,i) => CORES_D[i % CORES_D.length]),
        borderWidth: 1.5, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.x} exames` } } },
      scales: {
        x: { grid: { color: "#f0f4f1" }, ticks: { font: { size: 11 } }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

/* Semanal */
function renderChartSemanal() {
  destroyChart("semanal");
  const map = {};
  filteredData.forEach(r => {
    const d   = new Date(r.data+"T12:00:00");
    const w   = getISOWeek(d);
    const key = `${d.getFullYear()}-S${String(w).padStart(2,"0")}`;
    map[key] = (map[key]||0)+1;
  });
  const sorted = Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).slice(-20);
  const labels = sorted.map(([k]) => k.replace("-", " "));
  const values = sorted.map(([,v]) => v);
  document.getElementById("badgeSemanal").textContent = `${sorted.length} semana(s)`;
  const ctx = document.getElementById("chartSemanal").getContext("2d");
  const g   = ctx.createLinearGradient(0,0,0,280);
  g.addColorStop(0, "#3AB86ACC"); g.addColorStop(1, "#3AB86A22");
  charts["semanal"] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Exames", data: values, backgroundColor: g, borderColor: "#3AB86A", borderWidth: 1.5, borderRadius: 6, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: "#f0f4f1" }, ticks: { font: { size: 11 } }, beginAtZero: true }
      }
    }
  });
}

/* Top empresas */
function renderChartEmpresa() {
  destroyChart("empresa");
  const map = {};
  filteredData.filter(r => r.status === "Realizado").forEach(r => { map[r.empresa] = (map[r.empresa]||0)+1; });
  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels = sorted.map(([k]) => k.length > 22 ? k.substring(0,20)+"…" : k);
  const values = sorted.map(([,v]) => v);
  const ctx = document.getElementById("chartEmpresa").getContext("2d");
  charts["empresa"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Exames", data: values,
        backgroundColor: labels.map((_,i) => CORES_TIPO[i % CORES_TIPO.length] + "CC"),
        borderColor:     labels.map((_,i) => CORES_TIPO[i % CORES_TIPO.length]),
        borderWidth: 1.5, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "#f0f4f1" }, ticks: { font: { size: 11 } }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

/* Série histórica por tipo ao longo do tempo */
function renderChartTipoTempo() {
  destroyChart("tipoTempo");
  // Usa TODOS os dados (não filtrado) para mostrar a série histórica completa
  const todos = dadosOriginais;
  const tipos = [...new Set(todos.map(r => r.tipo))].sort();

  // Gera lista de meses cobertos
  const mesesSet = new Set(todos.map(r => {
    const d = new Date(r.data+"T12:00:00");
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }));
  const meses = [...mesesSet].sort();
  const labels = meses.map(m => {
    const [y, mo] = m.split("-");
    return `${MESES_PT[+mo-1]}/${y.slice(2)}`;
  });

  const datasets = tipos.map((tipo, idx) => {
    const cor = TIPO_BG[tipo] || CORES_TIPO[idx % CORES_TIPO.length];
    const data = meses.map(m => todos.filter(r => {
      const d = new Date(r.data+"T12:00:00");
      const rm = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      return rm === m && r.tipo === tipo;
    }).length);
    return {
      label: tipo, data,
      borderColor: cor, backgroundColor: cor + "22",
      borderWidth: 2, pointRadius: 3, pointHoverRadius: 5,
      fill: false, tension: .35,
    };
  });

  const ctx = document.getElementById("chartTipoTempo").getContext("2d");
  charts["tipoTempo"] = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 8, padding: 10 } },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: { grid: { color: "#f0f4f1" }, ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: "#f0f4f1" }, ticks: { font: { size: 11 } }, beginAtZero: true }
      },
      interaction: { mode: "index", intersect: false }
    }
  });
}

// ---- TABLE ----
function renderTable() {
  let data = [...filteredData];
  if (tableSearch) {
    data = data.filter(r =>
      (r.paciente||"").toLowerCase().includes(tableSearch) ||
      (r.empresa||"").toLowerCase().includes(tableSearch)  ||
      (r.descricao||"").toLowerCase().includes(tableSearch)||
      (r.tipo||"").toLowerCase().includes(tableSearch)
    );
  }
  tableData = data;
  tableData.sort((a,b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === "data") { va = new Date(va); vb = new Date(vb); }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });
  const total = tableData.length;
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage-1) * PAGE_SIZE;
  const slice = tableData.slice(start, start+PAGE_SIZE);
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";
  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--text-muted)">Nenhum exame encontrado com os filtros selecionados.</td></tr>`;
  } else {
    slice.forEach(r => {
      const cor     = TIPO_BG[r.tipo] || "#999";
      const dataFmt = new Date((r.data||"2000-01-01")+"T12:00:00").toLocaleDateString("pt-BR");
      const isSched = r.status === "Agendado";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${dataFmt}</strong></td>
        <td><span class="tipo-badge" style="background:${cor}">${r.tipo}</span></td>
        <td>${r.descricao}</td>
        <td style="font-size:.78rem">${r.empresa}</td>
        <td style="font-size:.78rem;color:var(--text-secondary)">${r.paciente}</td>
        <td><span class="status-badge status-${(r.status||"").toLowerCase()}">
          <span class="status-dot"></span>${r.status||"—"}
        </span></td>`;
      tbody.appendChild(tr);
    });
  }
  document.getElementById("tableCount").textContent = `${total.toLocaleString("pt-BR")} registro(s)`;
  document.getElementById("pageInfo").textContent   = `Pág. ${currentPage} de ${pages}`;
  document.getElementById("btnPrev").disabled = currentPage <= 1;
  document.getElementById("btnNext").disabled = currentPage >= pages;
}

function sortTable(key) {
  if (sortKey === key) { sortAsc = !sortAsc; } else { sortKey = key; sortAsc = true; }
  currentPage = 1;
  renderTable();
}
function prevPage() { if (currentPage > 1)  { currentPage--; renderTable(); } }
function nextPage() { if (currentPage < Math.ceil(tableData.length/PAGE_SIZE)) { currentPage++; renderTable(); } }

// ---- UTIL ----
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const y = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-y)/86400000)+1)/7);
}
