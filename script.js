const ADMIN_WHATSAPP = "5596984352841"; 

let db = null;
let productsList = [];
let cart = {};
let storeOpen = true;

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const $ = id => document.getElementById(id);

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, match => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[match]);
}

document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
  setupCartEvents();
});

function initFirebase() {
  try {
    if (!window.firebase) throw new Error("Firebase SDK não carregado.");
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    db.ref("configuracoes/lojaAberta").on("value", snap => {
      storeOpen = snap.exists() ? snap.val() === true : true;
      updateStoreStatus();
      renderMenu(); 
    });

    db.ref("produtos").on("value", snap => {
      const data = snap.val() || {};
      productsList = Object.keys(data).map(key => ({
        id: key,
        ...data[key],
        preco: Number(data[key].preco || 0)
      }));
      renderMenu();
    });
  } catch (err) {
    console.error("Erro Firebase:", err);
  }
}

function updateStoreStatus() {
  const badge = $("storeBadge");
  const banner = $("storeStatusBanner");

  if (badge) {
    badge.textContent = storeOpen ? "🟢 Loja Aberta" : "🔴 Loja Fechada";
    badge.style.background = storeOpen ? "#e6f4ea" : "#fce8e6";
    badge.style.color = storeOpen ? "#137333" : "#c5221f";
  }
  if (banner) {
    banner.style.display = storeOpen ? "none" : "block";
  }
}

function renderMenu() {
  const menu = $("menu");
  if (!menu) return;

  if (!productsList.length) {
    menu.innerHTML = "<p style='text-align:center;'>Cardápio vazio no momento.</p>";
    return;
  }

  const categories = {};
  productsList.forEach(p => {
    const cat = p.categoria || "Marmitas";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(p);
  });

  let html = "";
  Object.entries(categories).forEach(([catName, items]) => {
    html += `<div style="grid-column: 1 / -1; margin-top: 15px;">
      <h2 style="font-size: 20px;">${escapeHtml(catName)}</h2>
      <div class="menu-grid">
        ${items.map(p => {
          const isAvailable = storeOpen && p.disponivel !== false;
          const qty = cart[p.id] || 0;
          return `
          <article class="product ${!isAvailable ? 'out-of-stock' : ''}">
            <div style="position: relative;">
              <img src="${p.imagem}" onerror="this.src='https://placehold.co/400?text=Sem+Foto'">
              ${!storeOpen ? '<span class="badge-esgotado">FECHADO</span>' : (!p.disponivel ? '<span class="badge-esgotado">ESGOTADO</span>' : '')}
            </div>
            <div class="product-body">
              <h3>${escapeHtml(p.nome)}</h3>
              <p>${escapeHtml(p.descricao)}</p>
              <div class="product-bottom">
                <span class="price">${money(p.preco)}</span>
                <div class="qty">
                  <button type="button" onclick="changeQty('${p.id}', -1)">−</button>
                  <span id="qty-${p.id}">${qty}</span>
                  <button type="button" onclick="changeQty('${p.id}', 1)">+</button>
                </div>
              </div>
            </div>
          </article>`;
        }).join("")}
      </div>
    </div>`;
  });

  menu.innerHTML = html;
  updateCartSummary();
}

window.changeQty = function(id, delta) {
  if (!storeOpen) return alert("A loja está fechada!");
  
  const product = productsList.find(p => p.id === id);
  if (!product || product.disponivel === false) return;

  const currentQty = cart[id] || 0;
  const newQty = Math.max(0, currentQty + delta);

  if (newQty === 0) delete cart[id];
  else cart[id] = newQty;

  const qtySpan = $(`qty-${id}`);
  if (qtySpan) qtySpan.textContent = newQty;
  updateCartSummary();
};

function updateCartSummary() {
  let totalQty = 0;
  let totalPrice = 0;

  Object.entries(cart).forEach(([id, qty]) => {
    const prod = productsList.find(p => p.id === id);
    if (prod) {
      totalQty += qty;
      totalPrice += Number(prod.preco || 0) * qty;
    }
  });

  if ($("cartTotalQty")) $("cartTotalQty").textContent = totalQty;
  if ($("cartTotalPrice")) $("cartTotalPrice").textContent = money(totalPrice);
  
  const floatCart = $("floatingCart");
  if (floatCart) floatCart.style.display = totalQty > 0 ? "block" : "none";
}

function setupCartEvents() {
  $("openCartBtn")?.addEventListener("click", () => {
    renderCartModal();
    $("cartModal").style.display = "flex";
  });
  $("closeCartBtn")?.addEventListener("click", () => {
    $("cartModal").style.display = "none";
  });
  $("checkoutForm")?.addEventListener("submit", handleCheckout);
}

function renderCartModal() {
  const container = $("cartItemsList");
  if (!container) return;

  const entries = Object.entries(cart);
  if (!entries.length) {
    container.innerHTML = "<p>Carrinho vazio.</p>";
    if ($("modalTotal")) $("modalTotal").textContent = money(0);
    return;
  }

  let html = "";
  let total = 0;

  entries.forEach(([id, qty]) => {
    const prod = productsList.find(p => p.id === id);
    if (prod) {
      const sub = Number(prod.preco || 0) * qty;
      total += sub;
      html += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:8px 0;">
        <span>${qty}x ${escapeHtml(prod.nome)}</span>
        <strong>${money(sub)}</strong>
      </div>`;
    }
  });

  container.innerHTML = html;
  if ($("modalTotal")) $("modalTotal").textContent = money(total);
}

async function handleCheckout(event) {
  event.preventDefault();

  if (!storeOpen) return alert("Loja fechada!");
  
  const entries = Object.entries(cart);
  if (!entries.length) return alert("Carrinho vazio!");

  const nome = $("custName").value.trim();
  const telefone = $("custPhone").value.trim();
  const bairro = $("custBairro").value.trim();
  const recebimento = $("custRecebimento").value;
  const pagamento = $("custPagamento").value;

  const itens = entries.map(([id, qty]) => {
    const prod = productsList.find(p => p.id === id);
    return { id, nome: prod.nome, preco: Number(prod.preco), quantidade: qty };
  });

  const total = itens.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  const orderId = "ORD-" + Math.floor(1000 + Math.random() * 9000);

  const orderData = {
    id: orderId,
    cliente: { nome, telefone, bairro, recebimento },
    pagamento, itens, total, status: "Novo", criadoEm: Date.now()
  };

  try {
    if (db) await db.ref(`pedidos/${orderId}`).set(orderData);

    let msg = `*NOVO PEDIDO: #${orderId}*\n\n*Cliente:* ${nome}\n*Telefone:* ${telefone}\n*Forma:* ${recebimento} (${bairro})\n*Pagamento:* ${pagamento}\n\n*ITENS:*\n`;
    itens.forEach(i => msg += `• ${i.quantidade}x ${i.nome} - ${money(i.preco * i.quantidade)}\n`);
    msg += `\n*TOTAL: ${money(total)}*`;

    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank");

    cart = {};
    updateCartSummary();
    $("cartModal").style.display = "none";
    $("checkoutForm").reset();
  } catch (err) {
    alert("Erro ao processar: " + err.message);
  }
}
