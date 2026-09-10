let db = null;
let cart = {};
let storeOpen = true;

const money = value => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("year").textContent = new Date().getFullYear();
  $("pixKey").textContent = CONFIG.pixKey;
  renderMenu();
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
  }catch(error){
    console.error(error);
    updateStoreStatus("offline");
  }
}

function renderMenu(){
  const menu = $("menu");
  const available = CONFIG.produtos.filter(p => p.disponivel);
  menu.innerHTML = available.map(p => `
    <article class="product">
      <img src="${escapeAttr(p.imagem)}" alt="${escapeAttr(p.nome)}" onerror="this.src='https://placehold.co/800x500/f3f3f3/777?text=Marmita'">
      <div class="product-body">
        <h3>${escapeHtml(p.nome)}</h3>
        <p>${escapeHtml(p.descricao)}</p>
        <div class="product-bottom">
          <span class="price">${money(p.preco)}</span>
          <div class="qty">
            <button type="button" aria-label="Diminuir" onclick="changeQty('${p.id}',-1)">−</button>
            <span id="qty-${p.id}">0</span>
            <button type="button" aria-label="Aumentar" onclick="changeQty('${p.id}',1)">+</button>
          </div>
        </div>
      </div>
    </article>
  `).join("");
}

window.changeQty = function(id, delta){
  const product = CONFIG.produtos.find(p => p.id === id);
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
  CONFIG.produtos.forEach(p => {
    const qty = cart[p.id] || 0;
    subtotal += qty * p.preco;
    count += qty;
  });
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

  const items = CONFIG.produtos
    .filter(p => (cart[p.id] || 0) > 0)
    .map(p => ({id:p.id,nome:p.nome,quantidade:cart[p.id],preco:p.preco}));

  if(!items.length){
    message.textContent = "Adicione pelo menos uma marmita.";
    return;
  }

  const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;
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
      nome: $("customerName").value.trim(),
      recebimento: deliveryType === "delivery" ? "Entrega" : "Retirada",
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

  try{
    if(!db) throw new Error("Firebase não inicializado.");
    await db.ref("pedidos/" + pedidoId).set(order);
  }catch(error){
    console.error(error);
    message.textContent = "Não foi possível registrar o pedido no sistema. Verifique o Firebase e tente novamente.";
    return;
  }

  window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(whatsappText)}`, "_blank");
  cart = {};
  renderMenu();
  $("orderForm").reset();
  $("pixBox").classList.add("hidden");
  $("changeField").classList.add("hidden");
  updateDeliveryVisibility();
  updateSummary();
  message.textContent = `Pedido ${pedidoId} registrado! O WhatsApp foi aberto.`;
}

function buildWhatsAppText(order){
  const lines = [
    `*🍳 COMIDA NA CHAPA*`,
    `*Pedido ${order.id}*`,
    ``,
    `*Cliente:* ${order.cliente.nome}`,
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
    order.observacoes ? `Observações: ${order.observacoes}` : ""
  ];
  return lines.filter(Boolean).join("\n");
}

function createOrderId(){
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const random = Math.floor(1000 + Math.random()*9000);
  return `CN-${date}-${random}`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function escapeAttr(s){return escapeHtml(s)}
