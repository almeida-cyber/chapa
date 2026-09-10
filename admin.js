let auth = null;
let db = null;
let ordersQuery = null;
let storeRef = null;
let connectionRef = null;
let resetRef = null;
let ordersCache = {};
let shiftStart = 0;

const money = value => Number(value || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const $ = id => document.getElementById(id);

function setConnection(text, type = "") {
  const el = $("connection");
  if (!el) return;
  el.textContent = text;
  el.dataset.status = type;
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    if (!window.firebase) throw new Error("SDK do Firebase não carregado.");
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

    auth = firebase.auth();
    db = firebase.database();

    auth.onAuthStateChanged(user => {
      const logged = !!user;
      $("loginScreen").classList.toggle("hidden", logged);
      $("dashboard").classList.toggle("hidden", !logged);

      if (logged) {
        console.log("Administrador autenticado:", user.uid);
        startDashboard();
      } else {
        stopDashboard();
      }
    });

    $("loginForm").addEventListener("submit", login);
    $("logout").addEventListener("click", () => auth.signOut());
    
    // Eventos dos botões de ação do Dashboard
    if ($("btnExport")) $("btnExport").addEventListener("click", exportToCSV);
    if ($("btnPrint")) $("btnPrint").addEventListener("click", printReport);
    if ($("btnReset")) $("btnReset").addEventListener("click", resetDashboard);
    
    $("storeToggle").addEventListener("click", toggleStore);
  } catch (error) {
    console.error("Erro ao iniciar Firebase:", error);
    $("loginError").textContent = "Erro ao iniciar Firebase: " + error.message;
  }
});

async function login(event) {
  event.preventDefault();
  $("loginError").textContent = "";

  try {
    await auth.signInWithEmailAndPassword(
      $("email").value.trim(),
      $("password").value
    );
  } catch (error) {
    console.error("Erro no login:", error);
    $("loginError").textContent = firebaseAuthError(error);
  }
}

function firebaseAuthError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "E-mail ou senha inválidos.";
  if (code.includes("user-not-found")) return "Usuário não encontrado no Firebase Authentication.";
  if (code.includes("too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  return "Não foi possível entrar: " + (error?.message || "erro desconhecido");
}

function startDashboard() {
  stopDashboard();
  setConnection("● conectando...", "connecting");

  // Verifica a conexão real do navegador com o Realtime Database.
  connectionRef = db.ref(".info/connected");
  connectionRef.on("value", snapshot => {
    if (snapshot.val() === true) {
      setConnection("● conectado", "online");
    } else {
      setConnection("● desconectado", "offline");
    }
  }, error => {
    console.error("Erro .info/connected:", error);
    setConnection("● erro de conexão", "error");
  });

  // Escuta a última vez que o painel foi zerado
  resetRef = db.ref("configuracoes/ultimoReset");
  resetRef.on("value", snapshot => {
    shiftStart = snapshot.val() || 0;
    renderDashboard();
  }, error => {
    console.error("Erro ao acompanhar ultimoReset:", error);
  });

  // Status da loja em tempo real.
  storeRef = db.ref("configuracoes/lojaAberta");
  storeRef.on("value", snapshot => {
    const open = snapshot.exists() ? snapshot.val() === true : true;
    const button = $("storeToggle");
    button.textContent = open ? "● Aberta" : "● Fechada";
    button.className = open ? "open" : "";
  }, error => {
    console.error("Erro ao acompanhar status da loja:", error);
    alertFirebaseError("status da loja", error);
  });

  // PEDIDOS: listener permanente do Realtime Database.
  ordersQuery = db.ref("pedidos").orderByChild("criadoEm").limitToLast(100);
  ordersQuery.on("value", snapshot => {
    ordersCache = snapshot.val() || {};
    console.log("Pedidos recebidos em tempo real:", Object.keys(ordersCache).length);
    renderDashboard();
  }, error => {
    console.error("Erro ao acompanhar pedidos:", error);
    setConnection("● erro Firebase", "error");
    alertFirebaseError("pedidos", error);
  });
}

function alertFirebaseError(area, error) {
  const code = error?.code || "";
  const message = error?.message || "Erro desconhecido.";
  console.error(`Firebase (${area}):`, code, message);

  const old = $("firebaseError");
  if (old) old.textContent = `Firebase: ${area} — ${message}`;
}

function stopDashboard() {
  if (storeRef) {
    storeRef.off();
    storeRef = null;
  }

  if (ordersQuery) {
    ordersQuery.off();
    ordersQuery = null;
  }

  if (connectionRef) {
    connectionRef.off();
    connectionRef = null;
  }

  if (resetRef) {
    resetRef.off();
    resetRef = null;
  }

  ordersCache = {};
}

async function toggleStore() {
  const current = $("storeToggle").classList.contains("open");

  try {
    await db.ref("configuracoes/lojaAberta").set(!current);
  } catch (error) {
    console.error("Erro ao alterar status da loja:", error);
    alertFirebaseError("alteração do status", error);
  }
}

function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const get = type => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function orderDateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return localDateKey(date);
}

function renderDashboard() {
  const orders = Object.values(ordersCache).sort((a, b) => {
    const da = new Date(a?.criadoEm || 0).getTime();
    const dbValue = new Date(b?.criadoEm || 0).getTime();
    return dbValue - da;
  });

  // Filtra apenas os pedidos realizados a partir do último encerramento de expediente (shiftStart)
  const todayOrders = orders.filter(order => {
    const orderTime = new Date(order.criadoEm || 0).getTime();
    return orderTime >= shiftStart;
  });
  
  const valid = todayOrders.filter(order => order.status !== "Cancelado");

  const meals = valid.reduce((sum, order) => {
    return sum + (order.itens || []).reduce((total, item) => total + Number(item.quantidade || 0), 0);
  }, 0);

  const sales = valid.reduce((sum, order) => sum + Number(order.total || 0), 0);

  $("statOrders").textContent = todayOrders.length;
  $("statMeals").textContent = meals;
  $("statSales").textContent = money(sales);
  $("statTicket").textContent = money(valid.length ? sales / valid.length : 0);

  renderOrders(orders.slice(0, 30));
  renderPayments(valid);
  renderProducts(valid);
}

function renderOrders(orders) {
  const element = $("orders");

  if (!orders.length) {
    element.innerHTML = "<p>Nenhum pedido registrado.</p>";
    return;
  }

  element.innerHTML = orders.map(order => `
    <article class="order">
      <div class="order-head">
        <div>
          <div class="order-id">${esc(order.id)}</div>
          <div class="order-meta">
            ${formatDate(order.criadoEm)} • ${esc(order.cliente?.nome || "")}
          </div>
        </div>
        <strong>${money(order.total)}</strong>
      </div>

      <div class="order-items">
        ${(order.itens || []).map(item => `${Number(item.quantidade || 0)}x ${esc(item.nome)} — ${money(Number(item.preco || 0) * Number(item.quantidade || 0))}`).join("<br>")}
      </div>

      <div class="order-meta">
        ${esc(order.cliente?.recebimento || "")} •
        ${esc(order.cliente?.bairro || "")} •
        ${esc(order.pagamento || "")}
      </div>

      <div class="order-footer">
        <span class="order-total">
          ${order.cliente?.endereco ? esc(order.cliente.endereco) : "Retirada"}
        </span>

        <select onchange="updateStatus('${escAttr(order.id)}', this.value)">
          ${["Novo", "Em preparo", "Saiu para entrega", "Concluído", "Cancelado"].map(status => `
            <option ${status === order.status ? "selected" : ""}>${status}</option>
          `).join("")}
        </select>
      </div>
    </article>
  `).join("");
}

window.updateStatus = async function(id, status) {
  if (!auth?.currentUser) {
    alert("Sua sessão do administrador expirou. Entre novamente.");
    return;
  }

  try {
    await db.ref(`pedidos/${id}/status`).set(status);
    console.log("Status atualizado:", id, status);
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    alertFirebaseError("atualização do pedido", error);
  }
};

function renderPayments(orders) {
  const totals = {};

  orders.forEach(order => {
    const payment = order.pagamento || "Não informado";
    totals[payment] = (totals[payment] || 0) + Number(order.total || 0);
  });

  $("payments").innerHTML = Object.keys(totals).length
    ? Object.entries(totals).map(([key, value]) => `
        <div class="metric-line"><span>${esc(key)}</span><strong>${money(value)}</strong></div>
      `).join("")
    : "<p>Nenhuma venda hoje.</p>";
}

function renderProducts(orders) {
  const totals = {};

  orders.forEach(order => (order.itens || []).forEach(item => {
    const name = item.nome || "Produto";
    totals[name] = (totals[name] || 0) + Number(item.quantidade || 0);
  }));

  $("products").innerHTML = Object.keys(totals).length
    ? Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([key, value]) => `
        <div class="metric-line"><span>${esc(key)}</span><strong>${value} un.</strong></div>
      `).join("")
    : "<p>Nenhuma venda hoje.</p>";
}

function formatDate(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");

    return date.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Belem"
    });
  } catch {
    return String(value || "");
  }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function escAttr(value) {
  return esc(value).replace(/'/g, "&#039;");
}

function exportToCSV() {
  const orders = Object.values(ordersCache);
  if (!orders.length) return alert("Nenhum pedido para exportar.");

  let csv = "Data,ID,Cliente,Pagamento,Entrega,Status,Total\n";

  orders.forEach(order => {
    const data = formatDate(order.criadoEm);
    const id = order.id || "";
    const cliente = order.cliente?.nome || "";
    const pagamento = order.pagamento || "";
    const entrega = order.cliente?.recebimento || "";
    const status = order.status || "";
    const total = order.total || 0;

    csv += `"${data}","${id}","${cliente}","${pagamento}","${entrega}","${status}","${total}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `relatorio_vendas.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function resetDashboard() {
  if (!auth?.currentUser) {
    alert("Sua sessão do administrador expirou.");
    return;
  }

  if (confirm("Deseja encerrar o expediente e zerar o painel para o próximo dia?\n\nTodo o histórico continuará salvo no Firebase.")) {
    try {
      await db.ref("configuracoes/ultimoReset").set(Date.now());
      console.log("Expediente zerado!");
    } catch (error) {
      console.error("Erro ao zerar expediente:", error);
      alertFirebaseError("zerar expediente", error);
    }
  }
}

function printReport() {
  const orders = Object.values(ordersCache).sort((a, b) => {
    const da = new Date(a?.criadoEm || 0).getTime();
    const dbValue = new Date(b?.criadoEm || 0).getTime();
    return dbValue - da;
  });

  const currentOrders = orders.filter(order => new Date(order.criadoEm || 0).getTime() >= shiftStart);
  const valid = currentOrders.filter(order => order.status !== "Cancelado");

  if (!valid.length) {
    alert("Nenhum pedido válido encontrado neste expediente para imprimir.");
    return;
  }

  const meals = valid.reduce((sum, order) => sum + (order.itens || []).reduce((t, i) => t + Number(i.quantidade || 0), 0), 0);
  const sales = valid.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const ticket = valid.length ? sales / valid.length : 0;

  const paymentsObj = {};
  valid.forEach(order => {
    const p = order.pagamento || "Não informado";
    paymentsObj[p] = (paymentsObj[p] || 0) + Number(order.total || 0);
  });

  const productsObj = {};
  valid.forEach(order => (order.itens || []).forEach(item => {
    const name = item.nome || "Produto";
    productsObj[name] = (productsObj[name] || 0) + Number(item.quantidade || 0);
  }));

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório do Expediente - Comida na Chapa</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
          h1 { text-align: center; margin-bottom: 5px; font-size: 22px; }
          .subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 20px; }
          .metrics-grid { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 10px; }
          .metric-card { flex: 1; border: 1px solid #ccc; padding: 10px; text-align: center; border-radius: 6px; background: #fafafa; }
          .metric-card span { font-size: 11px; color: #666; text-transform: uppercase; display: block; }
          .metric-card strong { font-size: 18px; color: #000; display: block; margin-top: 4px; }
          .section-title { font-size: 15px; font-weight: bold; margin-top: 20px; margin-bottom: 8px; border-bottom: 2px solid #2196F3; padding-bottom: 4px; }
          .columns { display: flex; gap: 20px; margin-bottom: 15px; }
          .column { flex: 1; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>Comida na Chapa — Relatório do Expediente</h1>
        <div class="subtitle">Gerado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Belem" })}</div>

        <div class="metrics-grid">
          <div class="metric-card"><span>Pedidos Concluídos</span><strong>${valid.length}</strong></div>
          <div class="metric-card"><span>Marmitas Vendidas</span><strong>${meals}</strong></div>
          <div class="metric-card"><span>Faturamento Total</span><strong>${money(sales)}</strong></div>
          <div class="metric-card"><span>Ticket Médio</span><strong>${money(ticket)}</strong></div>
        </div>

        <div class="columns">
          <div class="column">
            <div class="section-title">Vendas por Pagamento</div>
            <table>
              <thead><tr><th>Forma</th><th>Total</th></tr></thead>
              <tbody>
                ${Object.entries(paymentsObj).map(([k, v]) => `<tr><td>${esc(k)}</td><td><strong>${money(v)}</strong></td></tr>`).join("")}
              </tbody>
            </table>
          </div>
          <div class="column">
            <div class="section-title">Produtos Vendidos</div>
            <table>
              <thead><tr><th>Item</th><th>Qtd.</th></tr></thead>
              <tbody>
                ${Object.entries(productsObj).map(([k, v]) => `<tr><td>${esc(k)}</td><td><strong>${v} un.</strong></td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="section-title">Detalhamento dos Pedidos</div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Data/Hora</th>
              <th>Cliente</th>
              <th>Recebimento</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${valid.map(o => `
              <tr>
                <td>${esc(o.id)}</td>
                <td>${formatDate(o.criadoEm)}</td>
                <td>${esc(o.cliente?.nome || "")}</td>
                <td>${esc(o.cliente?.recebimento || "")}</td>
                <td>${esc(o.pagamento || "")}</td>
                <td>${esc(o.status || "")}</td>
                <td><strong>${money(o.total)}</strong></td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  const printWin = window.open('', '_blank');
  if (!printWin) return alert("Por favor, permita pop-ups no navegador para visualizar o relatório.");
  printWin.document.write(html);
  printWin.document.close();
}
