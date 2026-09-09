// LÓGICA DO CARDÁPIO DIGITAL

const CONFIG = {
  whatsappNumber: "5596984352841", // WhatsApp da Vendedora
  taxaEntrega: 3.00,               // Taxa em R$
  senhaAdmin: "17082005",              // Senha da proprietária para ver o caixa
  
  lojaAbertaManual: true, 
  usarHorarioAutomatico: false,    // Loja continuamente aberta
  horaAbertura: 10,  
  horaFechamento: 22 
};

const items = {
  calabresa: { name: "Marmita de Calabresa", price: 25, qty: 0 },
  carne: { name: "Marmita de Carne", price: 25, qty: 0 },
  frango: { name: "Marmita de Frango", price: 25, qty: 0 }
};

// Verifica se a loja está aberta
function isStoreOpen() {
  if (!CONFIG.lojaAbertaManual) return false;

  if (CONFIG.usarHorarioAutomatico) {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= CONFIG.horaAbertura && currentHour < CONFIG.horaFechamento;
  }

  return true;
}

// Atualiza o aviso de status na tela
function updateStoreStatus() {
  const badge = document.getElementById("status-badge");
  const btnOrder = document.getElementById("btn-order");
  const storeOpen = isStoreOpen();

  if (storeOpen) {
    badge.innerText = "🟢 Aberto para Pedidos";
    badge.className = "status-badge open";
    if (btnOrder) {
      btnOrder.disabled = false;
      btnOrder.innerText = "Enviar Pedido pelo WhatsApp";
    }
  } else {
    badge.innerText = "🔴 Fechado no Momento";
    badge.className = "status-badge closed";
    if (btnOrder) {
      btnOrder.disabled = true;
      btnOrder.innerText = "Loja Fechada (Fora do Horário)";
    }
  }
}

// Controla os botões + e -
function changeQty(key, delta) {
  if (!isStoreOpen()) {
    alert("A loja está fechada no momento.");
    return;
  }

  if (items[key].qty + delta >= 0) {
    items[key].qty += delta;
    document.getElementById(`qty-${key}`).innerText = items[key].qty;
    updateTotal();
  }
}

// Alterna a exibição do endereço conforme o tipo de pedido
function toggleOrderType() {
  const orderType = document.getElementById("order-type").value;
  const addressGroup = document.getElementById("address-group");
  
  if (addressGroup) {
    addressGroup.style.display = (orderType === "Retirada") ? "none" : "block";
  }

  updateTotal();
}

// Alterna a exibição do troco e da chave PIX
function togglePayment() {
  const payment = document.getElementById("payment").value;
  const trocoGroup = document.getElementById("troco-group");
  const pixGroup = document.getElementById("pix-info-group");

  if (trocoGroup) trocoGroup.style.display = payment === "Dinheiro" ? "block" : "none";
  if (pixGroup) pixGroup.style.display = payment === "PIX" ? "block" : "none";
}

// Atualiza os valores do resumo considerando entrega ou retirada
function updateTotal() {
  let subtotal = 0;
  let totalQty = 0;

  for (const key in items) {
    subtotal += items[key].qty * items[key].price;
    totalQty += items[key].qty;
  }

  const orderTypeSelect = document.getElementById("order-type");
  const orderType = orderTypeSelect ? orderTypeSelect.value : "Entrega";
  const fee = (totalQty > 0 && orderType === "Entrega") ? CONFIG.taxaEntrega : 0;
  const total = subtotal + fee;

  document.getElementById("subtotal-price").innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
  document.getElementById("delivery-fee").innerText = `R$ ${fee.toFixed(2).replace('.', ',')}`;
  document.getElementById("total-price").innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

// --- REGISTRO E FECHAMENTO DE CAIXA SECRETO ---

function registrarVenda(subtotal, taxa, total, pagamento, itensPedido) {
  const historico = JSON.parse(localStorage.getItem('vendas_hoje')) || [];
  
  historico.push({
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    total: total,
    pagamento: pagamento,
    itens: JSON.parse(JSON.stringify(itensPedido))
  });

  localStorage.setItem('vendas_hoje', JSON.stringify(historico));
}

// Lógica para clique triplo no título principal
let clickCount = 0;
let clickTimer = null;

function secretClick() {
  clickCount++;
  if (clickTimer) clearTimeout(clickTimer);

  if (clickCount >= 3) {
    clickCount = 0;
    verFechamentoCaixa();
  } else {
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 1500);
  }
}

function autenticarDona() {
  const senhaDigitada = prompt("🔒 Área Restrita da Proprietária.\nDigite sua senha:");
  if (senhaDigitada !== CONFIG.senhaAdmin) {
    alert("❌ Senha incorreta ou acesso cancelado.");
    return false;
  }
  return true;
}

function verFechamentoCaixa() {
  if (!autenticarDona()) return;

  const historico = JSON.parse(localStorage.getItem('vendas_hoje')) || [];

  if (historico.length === 0) {
    alert("Nenhuma venda registrada no expediente atual.");
    return;
  }

  let totalMarmitas = 0;
  let valorTotalGeral = 0;
  let qtdItens = { calabresa: 0, carne: 0, frango: 0 };
  let valoresPorForma = { PIX: 0, Cartão: 0, Dinheiro: 0 };

  historico.forEach(pedido => {
    valorTotalGeral += pedido.total;
    
    if (valoresPorForma[pedido.pagamento] !== undefined) {
      valoresPorForma[pedido.pagamento] += pedido.total;
    }

    for (const key in pedido.itens) {
      const qtd = pedido.itens[key].qty || 0;
      totalMarmitas += qtd;
      if (qtdItens[key] !== undefined) {
        qtdItens[key] += qtd;
      }
    }
  });

  let relatorio = `📊 FECHAMENTO DO EXPEDIENTE\n\n`;
  relatorio += `🍱 Total de Marmitas Vendidas: ${totalMarmitas}\n`;
  relatorio += ` • Calabresa: ${qtdItens.calabresa}\n`;
  relatorio += ` • Carne: ${qtdItens.carne}\n`;
  relatorio += ` • Frango: ${qtdItens.frango}\n\n`;
  relatorio += `💰 VALOR TOTAL BRUTO: R$ ${valorTotalGeral.toFixed(2).replace('.', ',')}\n`;
  relatorio += ` • PIX: R$ ${valoresPorForma.PIX.toFixed(2).replace('.', ',')}\n`;
  relatorio += ` • Cartão: R$ ${valoresPorForma.Cartão.toFixed(2).replace('.', ',')}\n`;
  relatorio += ` • Dinheiro: R$ ${valoresPorForma.Dinheiro.toFixed(2).replace('.', ',')}\n`;

  alert(relatorio);

  if (confirm("⚠️ Deseja zerar o caixa para o próximo dia?")) {
    localStorage.removeItem('vendas_hoje');
    alert("Caixa zerado com sucesso!");
  }
}

// Formata e envia a mensagem para o WhatsApp
function sendOrder() {
  if (!isStoreOpen()) {
    alert("Desculpe, a loja está fechada no momento.");
    return;
  }

  let subtotal = 0;
  let totalItems = 0;
  let orderText = "";

  for (const key in items) {
    if (items[key].qty > 0) {
      totalItems += items[key].qty;
      const itemTotal = items[key].qty * items[key].price;
      subtotal += itemTotal;
      orderText += `• ${items[key].qty}x ${items[key].name} (R$ ${itemTotal.toFixed(2).replace('.', ',')})\n`;
    }
  }

  if (totalItems === 0) {
    alert("Por favor, adicione pelo menos uma marmita ao seu pedido.");
    return;
  }

  const name = document.getElementById("name").value.trim();
  const orderType = document.getElementById("order-type").value;
  const address = document.getElementById("address").value.trim();
  const payment = document.getElementById("payment").value;
  const troco = document.getElementById("troco").value.trim();
  const notes = document.getElementById("notes").value.trim();

  if (!name || (orderType === "Entrega" && !address)) {
    alert("Por favor, preencha seu nome e o endereço de entrega.");
    return;
  }

  const fee = orderType === "Entrega" ? CONFIG.taxaEntrega : 0;
  const totalFinal = subtotal + fee;

  // Salva no relatório de vendas
  registrarVenda(subtotal, fee, totalFinal, payment, items);

  let message = `*NOVO PEDIDO - COMIDA NA CHAPA*\n\n`;
  message += `*Tipo de Pedido:* ${orderType === "Entrega" ? "🛵 Entrega" : "🛍️ Retirada no Local"}\n`;
  message += `*Cliente:* ${name}\n`;
  
  if (orderType === "Entrega") {
    message += `*Endereço:* ${address} (Bairro Água Fria)\n\n`;
  } else {
    message += `*Endereço:* Retirada no Estabelecimento\n\n`;
  }

  message += `*ITENS DO PEDIDO:*\n${orderText}\n`;
  message += `*Acompanhamentos:* Arroz, Salada e Farofa\n\n`;
  message += `*Subtotal:* R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
  message += `*Taxa de Entrega:* R$ ${fee.toFixed(2).replace('.', ',')}\n`;
  message += `*TOTAL FINAL:* R$ ${totalFinal.toFixed(2).replace('.', ',')}\n\n`;
  message += `*Forma de Pagamento:* ${payment}\n`;
  
  if (payment === "Dinheiro" && troco) {
    message += `*Troco para:* ${troco}\n`;
  }
  
  if (notes) {
    message += `*Observações:* ${notes}\n`;
  }

  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// Inicializa a checagem ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  updateStoreStatus();
  togglePayment();
});