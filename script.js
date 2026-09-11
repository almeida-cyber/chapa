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

function escapeAttr(text) {
  return escapeHtml(text).replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  initFirebase();
  setupCartEvents();
});

function initFirebase() {
  try {
    if (!window.firebase) throw new Error("Firebase SDK não foi carregado.");
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    // Escuta o status de funcionamento da loja
    db.ref("configuracoes/lojaAberta").on("value", snap => {
      storeOpen = snap.exists() ? snap.val() === true : true;
      updateStoreStatus();
    }, () => {
      storeOpen = true;
      updateStoreStatus();
    });

    // Carrega APENAS os produtos cadastrados dinamicamente no Firebase
    db.ref("produtos").on("value", snap => {
      const data = snap.val() || {};
      
      productsList = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));

      renderMenu();
    }, error => {
      console.error("Erro de leitura do Firebase:", error);
      productsList = [];
      renderMenu();
    });

  } catch (err) {
    console.error("Erro ao inicializar Firebase no cliente:", err);
    productsList = [];
    renderMenu();
  }
}

function updateStoreStatus() {
  // Procura pelo elemento do topo ou pelo banner
  const badge = $("storeBadge") || $("storeStatus") || document.querySelector("[class*='Verificando']");
  
  if (badge) {
    if (storeOpen) {
      badge.textContent = "🟢 Loja Aberta";
      badge.style.backgroundColor = "#e6f4ea";
      badge.style.color = "#137333";
    } else {
      badge.textContent = "🔴 Loja Fechada";
      badge.style.backgroundColor = "#fce8e6";
      badge.style.color = "#c5221f";
    }
  }
}

function renderMenu() {
  const menu = $("menu");
  if (!menu) return;

  if (!productsList.length) {
    menu.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>Nenhum produto cadastrado no momento.</p>";
    return;
  }

  const categories = {};
  productsList.forEach(p => {
    const cat = p.categoria || "Marmitas";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(p);
  });

  let html = "";

  Object.entries(categories).forEach(([categoryName, items]) => {
    const categoryIcon = categoryName === "Bebidas" ? "🥤" : "🍱";

    html += `
      <div class="category-section" style="grid-column: 1 / -1; margin-top: 15px;">
        <h2 class="category-title">${categoryIcon} ${escapeHtml(categoryName)}</h2>
        <div class="menu-grid">
          ${items.map(p => {
            const isAvailable = p.disponivel !== false;
            const qty = cart[p.id] || 0;

            return `
            <article class="product ${!isAvailable ? 'out-of-stock' : ''}">
              <div style="position: relative;">
                <img src="${escapeAttr(p.imagem)}" alt="${escapeAttr(p.nome)}" onerror="this.src='https://placehold.co/800x500/f3f3f3/777?text=Sem+Foto'">
                ${!isAvailable ? '<span class="badge-esgotado">ESGOTADO</span>' : ''}
              </div>
              <div class="product-body">
                <h3>${escapeHtml(p.nome)}</h3>
                <p>${escapeHtml(p.descricao)}</p>
                <div class="product-bottom">
                  <span class="price">${money(p.preco)}</span>
                  <div class="qty">
                    <button type="button" aria-label="Diminuir" onclick="changeQty('${escapeAttr(p.id)}', -1)" ${!isAvailable ? 'disabled' : ''}>−</button>
                    <span id="qty-${escapeAttr(p.id)}">${qty}</span>
                    <button type="button" aria-label="Aumentar" onclick="changeQty('${escapeAttr(p.id)}', 1)" ${!isAvailable ? 'disabled' : ''}>+</button>
                  </div>
                </div>
              </div>
            </article>
          `;
          }).join("")}
        </div>
      </div>
    `;
  });

  menu.innerHTML = html;
  updateCartSummary();
}

window.changeQty = function(id, delta) {
  const product = productsList.find(p => p.id === id);
  if (!product || product.disponivel === false) return;

  const currentQty = cart[id] || 0;
  const newQty = Math.max(0, currentQty + delta);

  if (newQty === 0) {
    delete cart[id];
  } else {
    cart[id] = newQty;
  }

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
      totalPrice += prod.preco * qty;
    }
  });

  const totalQtyEl = $("cartTotalQty");
  const totalPriceEl = $("cartTotalPrice");
  const floatCart = $("floatingCart");

  if (totalQtyEl) totalQtyEl.textContent = totalQty;
  if (totalPriceEl) totalPriceEl.textContent = money(totalPrice);
  if (floatCart) floatCart.classList.toggle("active", totalQty > 0);
}

function setupCartEvents() {
  const openCartBtn = $("openCartBtn");
  const closeCartBtn = $("closeCartBtn");
  const cartModal = $("cartModal");
  const checkoutForm = $("checkoutForm");

  if (openCartBtn && cartModal) {
    openCartBtn.addEventListener("click", () => {
      renderCartModal();
      cartModal.classList.add("open");
    });
  }

  if (closeCartBtn && cartModal) {
    closeCartBtn.addEventListener("click", () => {
      cartModal.classList.remove("open");
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", handleCheckout);
  }
}

function renderCartModal() {
  const cartItemsContainer = $("cartItemsList");
  if (!cartItemsContainer) return;

  const entries = Object.entries(cart);
  if (!entries.length) {
    cartItemsContainer.innerHTML = "<p style='text-align:center; color:#777;'>Seu carrinho está vazio.</p>";
    return;
  }

  let html = "";
  let total = 0;

  entries.forEach(([id, qty]) => {
    const prod = productsList.find(p => p.id === id);
    if (prod) {
      const subtotal = prod.preco * qty;
      total += subtotal;
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:8px;">
          <div>
            <strong>${escapeHtml(prod.nome)}</strong><br>
            <small>${qty}x ${money(prod.preco)}</small>
          </div>
          <div>
            <strong>${money(subtotal)}</strong>
          </div>
        </div>
      `;
    }
  });

  cartItemsContainer.innerHTML = html;
  if ($("modalTotal")) $("modalTotal").textContent = money(total);
}

async function handleCheckout(event) {
  event.preventDefault();

  if (!storeOpen) {
    alert("A loja está fechada no momento. Não é possível enviar o pedido.");
    return;
  }

  const entries = Object.entries(cart);
  if (!entries.length) {
    alert("Adicione pelo menos um item ao carrinho.");
    return;
  }

  const nome = $("custName")?.value.trim() || "";
  const telefone = $("custPhone")?.value.trim() || "";
  const bairro = $("custBairro")?.value.trim() || "";
  const recebimento = $("custRecebimento")?.value || "Entrega";
  const pagamento = $("custPagamento")?.value || "Pix";

  if (!nome || !telefone) {
    alert("Por favor, preencha nome e telefone.");
    return;
  }

  const itens = entries.map(([id, qty]) => {
    const prod = productsList.find(p => p.id === id);
    return {
      id,
      nome: prod?.nome || "Produto",
      preco: prod?.preco || 0,
      quantidade: qty
    };
  });

  const total = itens.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  const orderId = "ORD-" + Math.floor(1000 + Math.random() * 9000);

  const orderData = {
    id: orderId,
    cliente: { nome, telefone, bairro, recebimento },
    pagamento,
    itens,
    total,
    status: "Novo",
    criadoEm: Date.now()
  };

  try {
    if (db) {
      await db.ref(`pedidos/${orderId}`).set(orderData);
    }

    let msg = `*NOVO PEDIDO: #${orderId}*\n\n`;
    msg += `*Cliente:* ${nome}\n`;
    msg += `*Telefone:* ${telefone}\n`;
    msg += `*Forma:* ${recebimento} (${bairro})\n`;
    msg += `*Pagamento:* ${pagamento}\n\n`;
    msg += `*ITENS:*\n`;
    itens.forEach(i => {
      msg += `• ${i.quantidade}x ${i.nome} - ${money(i.preco * i.quantidade)}\n`;
    });
    msg += `\n*TOTAL: ${money(total)}*`;

    const whatsappNumber = "5596999999999";
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`, "_blank");

    cart = {};
    updateCartSummary();
    $("cartModal")?.classList.remove("open");
    $("checkoutForm")?.reset();
    alert("Pedido realizado com sucesso!");

  } catch (err) {
    console.error("Erro ao salvar pedido:", err);
    alert("Erro ao processar o pedido: " + err.message);
  }
}
