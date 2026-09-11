let db = null;
let cart = {};
let storeOpen = true;
let productsList = [];

const money = value => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("year").textContent = new Date().getFullYear();
  $("pixKey").textContent = CONFIG.pixKey;
  bindEvents();
  initFirebase();
  updateSummary();
});

function initFirebase(){
  try{
    if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    
    db.ref("configuracoes/lojaAberta").on("value", snap => {
      storeOpen = snap.exists() ? snap.val() === true : true;
      updateStoreStatus();
    }, () => {
      storeOpen = true;
      updateStoreStatus("offline");
    });

    db.ref("produtos").on("value", snap => {
      const data = snap.val();
      if (data) {
        productsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
      } else {
        productsList = CONFIG.produtos.map(p => ({ ...p, categoria: "Marmitas" }));
      }
      renderMenu();
    });

  }catch(error){
    console.error(error);
    updateStoreStatus("offline");
  }
}

function renderMenu(){
  const menu = $("menu");

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
                    <button type="button" aria-label="Diminuir" onclick="changeQty('${p.id}',-1)" ${!isAvailable ? 'disabled' : ''}>−</button>
                    <span id="qty-${p.id}">${qty}</span>
                    <button type="button" aria-label="Aumentar" onclick="changeQty('${p.id}',1)" ${!isAvailable ? 'disabled' : ''}>+</button>
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
}

window.changeQty = function(id, delta){
  const product = productsList.find(p => p.id === id);
  if(!product) return;
  cart[id] = Math.max(0, (cart[id] || 0) + delta);
  if(cart[id] === 0) delete cart[id];
  const el = $(`qty-${id}`);
  if(el) el.textContent = cart[id] || 0;
  updateSummary();
};

function bindEvents(){
  document.querySelectorAll('input[name="deliveryType"]').forEach(r =>
    r.addEventListener("change", updateDeliveryVisibility)
  );
  $("neighborhood").addEventListener("change", updateSummary);
  $("payment").addEventListener("change", updatePayment);
  $("copyPix").addEventListener("click", copyPix);
  $("orderForm").addEventListener("submit", submitOrder);
  $("goCheckout").addEventListener("click", () => $("customerName").scrollIntoView({behavior:"smooth",block:"center"}));
}

function updateDeliveryVisibility(){
  const delivery = document.querySelector('input[name="deliveryType"]:checked').value === "delivery";
  $("deliveryFields").classList.toggle("hidden", !delivery);
  $("neighborhood").required = delivery;
  $("address").required = delivery;
  updateSummary();
}

function updatePayment(){
  const payment = $("payment").value;
  $("changeField").classList.toggle("hidden", payment !== "Dinheiro");
  $("pixBox").classList.toggle("hidden", payment !== "PIX");
}

function updateSummary(){
  let subtotal = 0, count = 0;
  let itemsHtml = "";

  productsList.forEach(p => {
    const qty = cart[p.id] || 0;
    if (qty > 0) {
      const itemTotal = qty * p.preco;
      subtotal += itemTotal;
      count += qty;
      itemsHtml += `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #eee; font-size: 0.9rem;">
          <span>${qty}x ${escapeHtml(p.nome)}</span>
          <strong>${money(itemTotal)}</strong>
        </div>
      `;
    }
  });

  const cartListEl = $("cartItemsList");
  if (cartListEl) {
    cartListEl.innerHTML = itemsHtml || "<p style='color: #888; font-size: 0.85rem; margin: 0;'>Nenhum item selecionado</p>";
  }

  const delivery = document.querySelector('input[name="deliveryType"]:checked')?.value === "delivery";
  const fee = delivery ? Number(CONFIG.taxas[$("neighborhood").value] || 0) : 0;
  $("subtotal").textContent = money(subtotal);
  $("deliveryFee").textContent = money(fee);
  $("total").textContent = money(subtotal + fee);
  $("cartCount").textContent = `${count} ${count === 1 ? "item" : "itens"}`;
  $("cartTotal").textContent = money(subtotal + fee);
  $("cartBar").classList.toggle("hidden", count === 0);
  $("sendOrder").disabled = count === 0 || !storeOpen;
}

function updateStoreStatus(mode){
  const el = $("storeStatus");
  if(mode === "offline"){
    el.className = "status open";
    el.textContent = "● Online";
  }else if(storeOpen){
    el.className = "status open";
    el.textContent = "● Aberta";
  }else{
    el.className = "status closed";
    el.textContent = "● Fechada";
  }
  updateSummary();
}

async function copyPix(){
  try{
    await navigator.clipboard.writeText(CONFIG.pixKey);
    $("copyPix").textContent = "Copiado!";
    setTimeout(() => $("copyPix").textContent = "Copiar", 1500);
  }catch{
    alert("PIX: " + CONFIG.pixKey);
  }
}

async function submitOrder(event){
  event.preventDefault();
  const message = $("formMessage");
  message.textContent = "";

  if(!storeOpen){
    message.textContent = "A loja está fechada no momento.";
    return;
  }

  const items = productsList
    .filter(p => (cart[p.id] || 0) > 0)
    .map(p => ({id:p.id,nome:p.nome,quantidade:cart[p.id],preco:p.preco}));

  if(!items.length){
    message.textContent = "Adicione pelo menos um item.";
    return;
  }

  const customerName = document.getElementById("customerName")?.value.trim() || "Cliente";
  let rawCustomerPhone = document.getElementById("telefone")?.value.trim() || "";
  
  let cleanCustomerPhone = rawCustomerPhone.replace(/\D/g, "");
  if (cleanCustomerPhone && !cleanCustomerPhone.startsWith("55") && cleanCustomerPhone.length <= 11) {
    cleanCustomerPhone = "55" + cleanCustomerPhone;
  }

  let storePhone = String(CONFIG.whatsappNumber || "").replace(/\D/g, "");
  if (storePhone && !storePhone.startsWith("55")) {
    storePhone = "55" + storePhone;
  }

  const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;
  const recebimento = deliveryType === "delivery" ? "Entrega" : "Retirada";
  const neighborhood = deliveryType === "delivery" ? $("neighborhood").value : "Retirada";
  const address = deliveryType === "delivery" ? $("address").value.trim() : "Retirada no local";
  const payment = $("payment").value;
  const changeFor = payment === "Dinheiro" ? Number($("changeFor").value || 0) : null;

  if(!payment){
    message.textContent = "Selecione a forma de pagamento.";
    $("payment").focus();
    return;
  }

  if(deliveryType === "delivery" && (!neighborhood || !address)){
    message.textContent = "Preencha bairro e endereço para entrega.";
    return;
  }

  if(payment === "Dinheiro" && (!changeFor || changeFor <= 0)){
    message.textContent = "Informe o valor para o troco.";
    $("changeFor").focus();
    return;
  }

  let subtotal = items.reduce((sum,item) => sum + item.preco * item.quantidade, 0);
  const deliveryFee = deliveryType === "delivery" ? Number(CONFIG.taxas[neighborhood] || 0) : 0;
  const total = subtotal + deliveryFee;

  if(payment === "Dinheiro" && changeFor < total){
    message.textContent = "O valor do troco precisa ser maior ou igual ao total.";
    return;
  }

  const pedidoId = createOrderId();
  const order = {
    id: pedidoId,
    criadoEm: new Date().toLocaleString("en-US", { hour12: false, timeZone: "America/Belem" }),
    status: "Novo",
    cliente: {
      nome: customerName,
      telefone: cleanCustomerPhone,
      recebimento: recebimento,
      bairro: neighborhood,
      endereco: address
    },
    pagamento: payment,
    trocoPara: changeFor,
    observacoes: $("notes").value.trim(),
    itens: items,
    subtotal,
    taxaEntrega: deliveryFee,
    total
  };

  const whatsappText = buildWhatsAppText(order);

  try {
    if(!db) throw new Error("Firebase não inicializado.");
    await db.ref("pedidos/" + pedidoId).set(order);
  } catch(error) {
    console.error(error);
    message.textContent = "Não foi possível registrar o pedido no sistema.";
    return;
  }

  window.open(`https://wa.me/${storePhone}?text=${encodeURIComponent(whatsappText)}`, "_blank");
  cart = {};
  renderMenu();
  $("orderForm").reset();
  $("pixBox").classList.add("hidden");
  $("changeField").classList.add("hidden");
  updateDeliveryVisibility();
  updateSummary();
  message.textContent = `Pedido ${pedidoId} registrado! O WhatsApp foi aberto.`;
}

function buildWhatsAppText(order) {
  const lines = [
    `*🍳 COMIDA NA CHAPA*`,
    `*Pedido ${order.id}*`,
    ``,
    `*Cliente:* ${order.cliente.nome}`,
    order.cliente.telefone ? `*Telefone:* ${order.cliente.telefone}` : "",
    `*Recebimento:* ${order.cliente.recebimento}`,
    order.cliente.recebimento === "Entrega" ? `*Bairro:* ${order.cliente.bairro}\n*Endereço:* ${order.cliente.endereco}` : `*Local:* Retirada`,
    ``,
    `*Itens:*`,
    ...order.itens.map(i => `• ${i.quantidade}x ${i.nome} — ${money(i.preco * i.quantidade)}`),
    ``,
    `Subtotal: ${money(order.subtotal)}`,
    `Entrega: ${money(order.taxaEntrega)}`,
    `*TOTAL: ${money(order.total)}*`,
    `Pagamento: ${order.pagamento}`,
    order.trocoPara ? `Troco para: ${money(order.trocoPara)}` : "",
    order.observacoes ? `Observações: ${order.observacoes}` : "",
    ``,
    order.pagamento === "PIX" ? `📌 *IMPORTANTE:* Estou enviando o comprovante do PIX a seguir nesta conversa!` : ""
  ];

  return lines.filter(Boolean).join("\n");
}

function createOrderId(){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  
  const get = type => parts.find(part => part.type === type).value;
  const date = `${get("year")}${get("month")}${get("day")}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  
  return `CN-${date}-${random}`;
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function escapeAttr(s){return escapeHtml(s)}
