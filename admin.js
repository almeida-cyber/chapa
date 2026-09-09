let auth = null;
let db = null;
let ordersQuery = null;
let storeRef = null;
let connectionRef = null;
let ordersCache = {};

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
  // O listener dispara novamente sempre que um pedido é criado, alterado ou removido.
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

  const today = localDateKey();
  const todayOrders = orders.filter(order => orderDateKey(order.criadoEm) === today);
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
