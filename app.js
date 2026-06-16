// ============================================================
//  Dashboard de Evolução de Exames — GRO Saúde
//  app.js — Lógica principal de filtragem, gráficos e tabela
// ============================================================

// ---- CONFIG ----
const CORES_TIPO = [
  "#1a6e3c","#2ecc71","#e74c3c","#f39c12","#3498db","#9b59b6","#1abc9c","#e67e22"
];
const CORES_DESC = [
  "#1a6e3c","#27ae60","#2980b9","#8e44ad","#e67e22","#e74c3c","#16a085","#d35400","#c0392b","#f39c12","#2c3e50","#7f8c8d"
];
const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const TIPO_BG = {
  "ASO Admissional":    "#1a6e3c",
  "ASO Periódico":      "#27ae60",
  "ASO Demissional":    "#e74c3c",
  "ASO Retorno":        "#e67e22",
  "Consulta Médica":    "#2980b9",
  "Coleta Laboratorial":"#9b59b6",
};

// ---- STATE ----
let filteredData = [];
let tableData    = [];
let currentPage  = 1;
const PAGE_SIZE  = 15;
let sortKey      = "data";
let sortAsc      = false;
let tableSearch  = "";

// Chart instances
let charts = {};

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  setDate();
  populateFilters();
  applyFilters();
  setupListeners();
});

function setDate() {
  const now = new Date();
  document.getElementById("dataAtual").textContent =
    now.toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" });
}

function populateFilters() {
  const tipos    = [...new Set(GRO_EXAMES.map(r => r.tipo))].sort();
  const empresas = [...new Set(GRO_EXAMES.map(r => r.empresa))].sort();
  const selTipo  = document.getElementById("filterTipo");
  const selEmp   = document.getElementById("filterEmpresa");
  tipos.forEach(t => { const o = document.createElement("option"); o.value = t; o.textContent = t; selTipo.appendChild(o); });
  empresas.forEach(e => { const o = document.createElement("option"); o.value = e; o.textContent = e; selEmp.appendChild(o); });
}

function setupListeners() {
  ["filterAno","filterMes","filterTipo","filterEmpresa","filterStatus"].forEach(id => {
    document.getElementById(id).addEventListener("change", applyFilters);
  });
  document.getElementById("tableSearch").addEventListener("input", e => {
    tableSearch = e.target.value.toLowerCase();
    currentPage = 1;
    renderTable();
  });
}

// ---- FILTER ----
function applyFilters() {
  const ano    = document.getElementById("filterAno").value;
  const mes    = document.getElementById("filterMes").value;
  const tipo   = document.getElementById("filterTipo").value;
  const emp    = document.getElementById("filterEmpresa").value;
  const status = document.getElementById("filterStatus").value;

  filteredData = GRO_EXAMES.filter(r => {
    const d = new Date(r.data);
    if (ano    !== "todos" && d.getFullYear().toString() !== ano) return false;
    if (mes    !== "todos" && (d.getMonth()+1).toString()  !== mes) return false;
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
  document.getElementById("tableSearch").value = "";
  renderTable();
}

function resetFiltros() {
  document.getElementById("filterAno").value    = "todos";
  document.getElementById("filterMes").value    = "todos";
  document.getElementById("filterTipo").value   = "todos";
  document.getElementById("filterEmpresa").value = "todas";
  document.getElementById("filterStatus").value = "todos";
  applyFilters();
}

function updateSubtitle() {
  const ano = document.getElementById("filterAno").value;
  const mes = document.getElementById("filterMes").value;
  let txt = `${filteredData.length} exame(s) no período`;
  if (ano !== "todos") txt += ` — ${ano}`;
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

  document.getElementById("kpiTotal").textContent      = total.toLocaleString("pt-BR");
  document.getElementById("kpiRealizados").textContent = realizados.toLocaleString("pt-BR");
  document.getElementById("kpiAgendados").textContent  = agendados.toLocaleString("pt-BR");
  document.getElementById("kpiEmpresas").textContent   = empresas;
  document.getElementById("kpiMedia").textContent      = media;
  document.getElementById("kpiTipos").textContent      = tipos;

  document.getElementById("kpiRealizadosPct").textContent =
    total > 0 ? `${((realizados/total)*100).toFixed(1)}% do total` : "";
  document.getElementById("kpiAgendadosPct").textContent =
    total > 0 ? `${((agendados/total)*100).toFixed(1)}% do total` : "";
}

// ---- CHARTS ----
function renderAllCharts() {
  renderChartAnual();
  renderChartMensal();
  renderChartTipo();
  renderChartDescricao();
  renderChartSemanal();
  renderChartEmpresa();
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function buildGradient(ctx, color) {
  const g = ctx.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, color + "CC");
  g.addColorStop(1, color + "11");
  return g;
}

/* Anual */
function renderChartAnual() {
  destroyChart("anual");
  const anos = [...new Set(GRO_EXAMES.map(r => new Date(r.data).getFullYear()))].sort();
  const totais = anos.map(a => GRO_EXAMES.filter(r => new Date(r.data).getFullYear() === a).length);
  const ctx = document.getElementById("chartAnual").getContext("2d");
  charts["anual"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: anos.map(String),
      datasets: [{
        label: "Total de Exames",
        data: totais,
        backgroundColor: anos.map((a,i) => CORES_TIPO[i % CORES_TIPO.length] + "CC"),
        borderColor:     anos.map((a,i) => CORES_TIPO[i % CORES_TIPO.length]),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: baseBarOptions("Total de exames por ano", false)
  });
}

/* Mensal */
function renderChartMensal() {
  destroyChart("mensal");
  const anos = [...new Set(filteredData.map(r => new Date(r.data).getFullYear()))].sort();
  const datasets = [];
  anos.forEach((ano, idx) => {
    const byMes = MESES_PT.map((_,m) =>
      filteredData.filter(r => { const d = new Date(r.data); return d.getFullYear()===ano && d.getMonth()===m; }).length
    );
    const cor = CORES_TIPO[idx % CORES_TIPO.length];
    datasets.push({
      label: String(ano),
      data: byMes,
      borderColor: cor,
      backgroundColor: cor + "20",
      borderWidth: 2.5,
      pointBackgroundColor: cor,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: idx === 0,
      tension: .35,
    });
  });
  const ctx = document.getElementById("chartMensal").getContext("2d");
  charts["mensal"] = new Chart(ctx, {
    type: "line",
    data: { labels: MESES_PT, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position:"top", labels:{ font:{size:11}, usePointStyle:true, boxWidth:8 } },
        tooltip: { mode:"index", intersect:false }
      },
      scales: {
        x: { grid:{ color:"#f0f4f1" }, ticks:{ font:{size:11} } },
        y: { grid:{ color:"#f0f4f1" }, ticks:{ font:{size:11} }, beginAtZero:true }
      },
      interaction: { mode:"index", intersect:false },
    }
  });
}

/* Tipo (donut) */
function renderChartTipo() {
  destroyChart("tipo");
  const tipoMap = {};
  filteredData.forEach(r => { tipoMap[r.tipo] = (tipoMap[r.tipo]||0)+1; });
  const labels = Object.keys(tipoMap).sort((a,b)=>tipoMap[b]-tipoMap[a]);
  const values = labels.map(k => tipoMap[k]);
  const cores  = labels.map(k => TIPO_BG[k] || "#999");
  const ctx    = document.getElementById("chartTipo").getContext("2d");
  charts["tipo"] = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data:values, backgroundColor:cores, borderWidth:2, borderColor:"#fff", hoverOffset:8 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position:"bottom", labels:{ font:{size:10}, usePointStyle:true, boxWidth:8, padding:8 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} (${((ctx.parsed/ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`
          }
        }
      },
      cutout: "60%"
    }
  });
}

/* Descrição */
function renderChartDescricao() {
  destroyChart("descricao");
  const descMap = {};
  filteredData.forEach(r => { descMap[r.descricao] = (descMap[r.descricao]||0)+1; });
  const sorted = Object.entries(descMap).sort((a,b) => b[1]-a[1]).slice(0,12);
  const labels = sorted.map(([k])=>k);
  const values = sorted.map(([,v])=>v);
  const ctx    = document.getElementById("chartDescricao").getContext("2d");
  charts["descricao"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Quantidade",
        data: values,
        backgroundColor: labels.map((_,i) => CORES_DESC[i % CORES_DESC.length] + "CC"),
        borderColor:     labels.map((_,i) => CORES_DESC[i % CORES_DESC.length]),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display:false },
        tooltip: { callbacks:{ label: ctx => ` ${ctx.parsed.x} exames` } }
      },
      scales: {
        x: { grid:{ color:"#f0f4f1" }, ticks:{ font:{size:11} }, beginAtZero:true },
        y: { grid:{ display:false }, ticks:{ font:{size:11} } }
      }
    }
  });
}

/* Semanal */
function renderChartSemanal() {
  destroyChart("semanal");
  const semanaMap = {};
  filteredData.forEach(r => {
    const d = new Date(r.data);
    const w = getISOWeek(d);
    const key = `${d.getFullYear()}-S${String(w).padStart(2,"0")}`;
    semanaMap[key] = (semanaMap[key]||0)+1;
  });
  const sorted = Object.entries(semanaMap).sort((a,b) => a[0].localeCompare(b[0]));
  const MAX_WEEKS = 24;
  const slice    = sorted.slice(-MAX_WEEKS);
  const labels   = slice.map(([k])=>k.replace("-"," "));
  const values   = slice.map(([,v])=>v);
  const ctx      = document.getElementById("chartSemanal").getContext("2d");
  document.getElementById("badgeSemanal").textContent =
    slice.length > 0 ? `${slice.length} semana(s)` : "Sem dados";
  charts["semanal"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Exames por Semana",
        data: values,
        backgroundColor: "#1a6e3cCC",
        borderColor: "#1a6e3c",
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: baseBarOptions("Exames por semana", false)
  });
}

/* Empresa */
function renderChartEmpresa() {
  destroyChart("empresa");
  const empMap = {};
  filteredData.filter(r => r.status === "Realizado").forEach(r => {
    empMap[r.empresa] = (empMap[r.empresa]||0)+1;
  });
  const sorted = Object.entries(empMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels = sorted.map(([k])=>k.length>25?k.substring(0,22)+"…":k);
  const values = sorted.map(([,v])=>v);
  const ctx    = document.getElementById("chartEmpresa").getContext("2d");
  charts["empresa"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Exames Realizados",
        data: values,
        backgroundColor: labels.map((_,i) => CORES_TIPO[i % CORES_TIPO.length] + "CC"),
        borderColor:     labels.map((_,i) => CORES_TIPO[i % CORES_TIPO.length]),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display:false },
        tooltip: { callbacks:{ label: ctx => ` ${ctx.parsed.x} exames` } }
      },
      scales: {
        x: { grid:{ color:"#f0f4f1" }, ticks:{ font:{size:11} }, beginAtZero:true },
        y: { grid:{ display:false }, ticks:{ font:{size:10} } }
      }
    }
  });
}

function baseBarOptions(label, horizontal) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display:false },
      tooltip: { callbacks:{ label: ctx => ` ${horizontal ? ctx.parsed.x : ctx.parsed.y} exames` } }
    },
    scales: {
      x: { grid:{ color:"#f0f4f1" }, ticks:{ font:{size:11} } },
      y: { grid:{ color:"#f0f4f1" }, ticks:{ font:{size:11} }, beginAtZero:true }
    }
  };
}

// ---- TABLE ----
function renderTable() {
  let data = [...filteredData];

  // search
  if (tableSearch) {
    data = data.filter(r =>
      r.paciente.toLowerCase().includes(tableSearch) ||
      r.empresa.toLowerCase().includes(tableSearch)  ||
      r.descricao.toLowerCase().includes(tableSearch)||
      r.tipo.toLowerCase().includes(tableSearch)
    );
  }
  tableData = data;

  // sort
  tableData.sort((a,b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === "data") { va = new Date(va); vb = new Date(vb); }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const total  = tableData.length;
  const pages  = Math.ceil(total / PAGE_SIZE) || 1;
  currentPage  = Math.min(currentPage, pages);
  const start  = (currentPage-1)*PAGE_SIZE;
  const slice  = tableData.slice(start, start+PAGE_SIZE);

  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  if (slice.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Nenhum exame encontrado com os filtros selecionados.</td>`;
    tbody.appendChild(tr);
  } else {
    slice.forEach(r => {
      const tr = document.createElement("tr");
      const cor = TIPO_BG[r.tipo] || "#999";
      const dataFmt = new Date(r.data+"T12:00:00").toLocaleDateString("pt-BR");
      tr.innerHTML = `
        <td><strong>${dataFmt}</strong></td>
        <td><span class="tipo-badge" style="background:${cor}">${r.tipo}</span></td>
        <td>${r.descricao}</td>
        <td style="font-size:.8rem">${r.empresa}</td>
        <td style="font-size:.8rem;color:var(--text-secondary)">${r.paciente}</td>
        <td>
          <span class="status-badge status-${r.status.toLowerCase()}">
            <span class="status-dot"></span>${r.status}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("tableCount").textContent =
    `${total.toLocaleString("pt-BR")} registro(s)`;
  document.getElementById("pageInfo").textContent =
    `Pág. ${currentPage} de ${pages}`;
  document.getElementById("btnPrev").disabled = currentPage <= 1;
  document.getElementById("btnNext").disabled = currentPage >= pages;
}

function sortTable(key) {
  if (sortKey === key) { sortAsc = !sortAsc; }
  else { sortKey = key; sortAsc = true; }
  currentPage = 1;
  renderTable();
}

function prevPage() { if (currentPage > 1) { currentPage--; renderTable(); } }
function nextPage() {
  const pages = Math.ceil(tableData.length / PAGE_SIZE);
  if (currentPage < pages) { currentPage++; renderTable(); }
}

// ---- UTIL ----
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
