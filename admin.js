let auth = null;
let db = null;
let ordersQuery = null;
let storeRef = null;
let connectionRef = null;
let resetRef = null;
let productsRef = null;
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
    
    if ($("btnPrint")) $("btnPrint").addEventListener("click", printReport);
    if ($("btnReset")) $("btnReset").addEventListener("click", resetDashboard);
    $("storeToggle").addEventListener("click", toggleStore);

    const productForm = $("productForm");
    if (productForm) {
      productForm.addEventListener("submit", handleSaveProduct);
    }
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

  connectionRef = db.ref(".info/connected");
  connectionRef.on("value", snapshot => {
    if (snapshot.val() === true) {
      setConnection("● conectado", "online");
    } else {
      setConnection("● desconectado", "offline");
    }
  });

  resetRef = db.ref("configuracoes/ultimoReset");
  resetRef.on("value", snapshot => {
    shiftStart = snapshot.val() || 0;
    renderDashboard();
  });

  storeRef = db.ref("configuracoes/lojaAberta");
  storeRef.on("value", snapshot => {
    const open = snapshot.exists() ? snapshot.val() === true : true;
    const button = $("storeToggle");
    button.textContent = open ? "● Aberta" : "● Fechada";
    button.className = open ? "open" : "";
  });

  ordersQuery = db.ref("pedidos").orderByChild("criadoEm").limitToLast(100);
  ordersQuery.on("value", snapshot => {
    ordersCache = snapshot.val() || {};
    renderDashboard();
  });

  productsRef = db.ref("produtos");
  productsRef.on("value", snapshot => {
    renderAdminProducts(snapshot.val() || {});
  });
}

function stopDashboard() {
  if (storeRef) { storeRef.off(); storeRef = null; }
  if (ordersQuery) { ordersQuery.off(); ordersQuery = null; }
  if (connectionRef) { connectionRef.off(); connectionRef = null; }
  if (resetRef) { resetRef.off(); resetRef = null; }
  if (productsRef) { productsRef.off(); productsRef = null; }
  ordersCache = {};
}

async function toggleStore() {
  const current = $("storeToggle").classList.contains("open");
  try {
    await db.ref("configuracoes/lojaAberta").set(!current);
  } catch (error) {
    console.error("Erro ao alterar status da loja:", error);
  }
}

function renderDashboard() {
  const orders = Object.values(ordersCache).sort((a, b) => {
    const da = new Date(a?.criadoEm || 0).getTime();
    const dbValue = new Date(b?.criadoEm || 0).getTime();
    return dbValue - da;
  });

  const todayOrders = orders.filter(order => new Date(order.criadoEm || 0).getTime() >= shiftStart);
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

     <div class="order-footer" style="display: flex; gap: 8px; align-items: center; justify-content: space-between;">
        <select onchange="updateStatus('${escAttr(order.id)}', this.value)">
          ${["Novo", "Em preparo", "Pronto para retirada", "Saiu para entrega", "Concluído", "Cancelado"].map(status => `
            <option ${status === order.status ? "selected" : ""}>${status}</option>
          `).join("")}
        </select>

        <button onclick="sendWhatsappNotification('${escAttr(order.id)}')" style="background-color: #25D366; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;">
          📲 Avisar Cliente
        </button>
      </div>
    </article>
  `).join("");
}

window.updateStatus = async function(id, status) {
  if (!auth?.currentUser) return alert("Sua sessão do administrador expirou.");
  try {
    await db.ref(`pedidos/${id}/status`).set(status);
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
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

// Função com redimensionamento e compressão automática da imagem
async function handleSaveProduct(event) {
  event.preventDefault();
  const msgEl = $("prodMsg");
  msgEl.textContent = "Processando imagem e salvando...";
  msgEl.style.color = "#777";

  const nome = $("prodNome").value.trim();
  const categoria = $("prodCategoria").value;
  const descricao = $("prodDesc").value.trim();
  const preco = Number($("prodPreco").value);
  const fileInput = $("prodImgFile");

  if (!fileInput.files || !fileInput.files[0]) {
    msgEl.textContent = "Selecione uma imagem para o produto.";
    msgEl.style.color = "red";
    return;
  }

  try {
    // Redimensiona a foto para no máximo 800px e comprime em JPEG (qualidade 70%)
    const base64Image = await compressImage(fileInput.files[0], 800, 0.7);

    const newRef = db.ref("produtos").push();
    await newRef.set({
      nome,
      categoria,
      descricao,
      preco,
      imagem: base64Image,
      disponivel: true,
      criadoEm: Date.now()
    });

    msgEl.textContent = "Produto cadastrado com sucesso!";
    msgEl.style.color = "green";
    $("productForm").reset();
  } catch (err) {
    console.error("Erro ao salvar produto:", err);
    msgEl.textContent = "Erro ao salvar: " + (err.message || "Verifique o console do navegador");
    msgEl.style.color = "red";
  }
}

// Função auxiliar para comprimir fotos pesadas do dispositivo
function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Converte em Base64 com tamanho otimizado
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = err => reject(err);
    };
    reader.onerror = err => reject(err);
  });
}

function renderAdminProducts(productsObj) {
  const container = $("adminProductList");
  if (!container) return;

  const keys = Object.keys(productsObj);
  if (!keys.length) {
    container.innerHTML = "<p style='color:#777; font-size:13px;'>Nenhum produto cadastrado no banco.</p>";
    return;
  }

  container.innerHTML = keys.map(key => {
    const prod = productsObj[key];
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; border: 1px solid #eee; padding: 8px 12px; border-radius: 8px; background: #fafafa;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${prod.imagem}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;" onerror="this.src='https://placehold.co/100?text=Foto'">
          <div>
            <strong style="font-size: 13px; display: block;">${esc(prod.nome)}</strong>
            <span style="font-size: 11px; color: #777;">${esc(prod.categoria)} • ${money(prod.preco)}</span>
          </div>
        </div>
        <button onclick="deleteProduct('${key}')" style="background: #d92323; color: white; border: 0; padding: 5px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;">Excluir</button>
      </div>
    `;
  }).join("");
}

window.deleteProduct = async function(key) {
  if (confirm("Tem certeza que deseja remover este produto?")) {
    try {
      await db.ref(`produtos/${key}`).remove();
    } catch (err) {
      alert("Erro ao excluir produto: " + err.message);
    }
  }
};

function formatDate(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Belem" });
  } catch {
    return String(value || "");
  }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function escAttr(value) {
  return esc(value).replace(/'/g, "&#039;");
}

async function resetDashboard() {
  if (!auth?.currentUser) return alert("Sessão expirada.");
  if (confirm("Deseja encerrar o expediente e zerar o painel para o próximo dia?")) {
    try {
      await db.ref("configuracoes/ultimoReset").set(Date.now());
    } catch (error) {
      console.error(error);
    }
  }
}

function printReport() {
  const orders = Object.values(ordersCache).sort((a, b) => new Date(b?.criadoEm || 0) - new Date(a?.criadoEm || 0));
  const valid = orders.filter(o => new Date(o.criadoEm || 0).getTime() >= shiftStart && o.status !== "Cancelado");

  if (!valid.length) return alert("Nenhum pedido válido encontrado para imprimir.");

  const meals = valid.reduce((sum, order) => sum + (order.itens || []).reduce((t, i) => t + Number(i.quantidade || 0), 0), 0);
  const sales = valid.reduce((sum, order) => sum + Number(order.total || 0), 0);

  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Relatório do Expediente</title></head>
      <body style="font-family: sans-serif; padding:20px;">
        <h2>Comida na Chapa — Relatório</h2>
        <p>Vendas Totais: ${money(sales)} | Marmitas: ${meals}</p>
      </body>
    </html>
  `;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

window.sendWhatsappNotification = function(id) {
  const order = ordersCache[id];
  if (!order) return;
  let phone = (order.cliente?.telefone || "").replace(/\D/g, "");
  if (phone && !phone.startsWith("55") && phone.length <= 11) phone = "55" + phone;

  let text = "";
  if (order.status === "Em preparo") text = `Olá *${order.cliente?.nome}*! Seu pedido *${order.id}* está em preparo!`;
  else if (order.status === "Saiu para entrega") text = `Olá *${order.cliente?.nome}*! Seu pedido *${order.id}* saiu para entrega!`;
  else if (order.status === "Pronto para retirada") text = `Olá *${order.cliente?.nome}*! Seu pedido *${order.id}* está pronto!`;
  else return alert("Disponível apenas para os status em andamento.");

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
};
