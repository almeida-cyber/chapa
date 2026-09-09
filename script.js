// LÓGICA DO CARDÁPIO DIGITAL & PAINEL ADMINISTRATIVO COM FIREBASE

const CONFIG = {
  whatsappNumber: "5596984352841", // WhatsApp da Vendedora
  taxasEntrega: {
    "Água Fria": 3.00,
    "Pedra Branca": 8.00
  },
  senhaAdmin: "17082005"              // Senha da proprietária
};

const items = {
  calabresa: { name: "Marmita de Calabresa", price: 25, qty: 0 },
  carne: { name: "Marmita de Carne", price: 25, qty: 0 },
  frango: { name: "Marmita de Frango", price: 25, qty: 0 }
};

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyD8gwCWqmadN58DwXH5fYh47iI5tZUoAqk",
  authDomain: "comida-na-chapa.firebaseapp.com",
  databaseURL: "https://comida-na-chapa-default-rtdb.firebaseio.com",
  projectId: "comida-na-chapa",
  storageBucket: "comida-na-chapa.firebasestorage.app",
  messagingSenderId: "18226994391",
  appId: "1:18226994391:web:238cf2225ebee38521e492"
};

// Inicializa a conexão com a nuvem
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storeStatusRef = database.ref('loja_aberta');

let lojaAbertaGlobal = true;

// Escuta alterações na nuvem em TEMPO REAL para todos os clientes
storeStatusRef.on('value', (snapshot) => {
  const status = snapshot.val();
  if (status !== null) {
    lojaAbertaGlobal = status;
  } else {
    storeStatusRef.set(true);
    lojaAbertaGlobal = true;
  }
  updateStoreStatus();
});

// --- GERENCIAMENTO DE STATUS DA LOJA ---

function isStoreOpen() {
  return lojaAbertaGlobal;
}

function updateStoreStatus() {
  const badge = document.getElementById("status-badge");
  const btnOrder = document.getElementById("btn-order");
  const storeOpen = isStoreOpen();

  if (storeOpen) {
    if (badge) {
      badge.innerText = "🟢 Aberto para Pedidos";
      badge.className = "status-badge open";
    }
    if (btnOrder) {
      btnOrder.disabled = false;
      btnOrder.innerText = "Enviar Pedido pelo WhatsApp";
    }
  } else {
    if (badge) {
      badge.innerText = "🔴 Fechado no Momento";
      badge.className = "status-badge closed";
    }
    if (btnOrder) {
      btnOrder.disabled = true;
      btnOrder.innerText = "Loja Fechada (Fora do Horário)";
    }
  }
}

// --- CÁLCULO DA TAXA DE ENTREGA POR BAIRRO ---

function getDeliveryFee() {
  const orderTypeSelect = document.getElementById("order-type");
  const orderType = orderTypeSelect ? orderTypeSelect.value : "Entrega";
  
  if (orderType !== "Entrega") return 0;

  const bairroSelect = document.getElementById("bairro");
  const bairro = bairroSelect ? bairroSelect.value : "Água Fria";
  
  return CONFIG.taxasEntrega[bairro] || 3.00;
}

// --- PAINEL ADMINISTRATIVO SECRETO (3 CLIQUES NO TÍTULO) ---

let clickCount = 0;
let clickTimer = null;

function secretClick() {
  clickCount++;
  if (clickTimer) clearTimeout(clickTimer);

  if (clickCount >= 3) {
    clickCount = 0;
    abrirPainelAdmin();
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

function abrirPainelAdmin() {
  if (!autenticarDona()) return;

  const statusAtual = isStoreOpen() ? "🟢 ABERTA" : "🔴 FECHADA";

  const opcao = prompt(
    `⚙️ PAINEL DA PROPRIETÁRIA\n` +
    `Status atual da loja: ${statusAtual}\n\n` +
    `Escolha uma opção:\n` +
    `1 - Ver Fechamento do Caixa\n` +
    `2 - ${isStoreOpen() ? "FECHAR a Loja" : "ABRIR a Loja"}`
  );

  if (opcao === "1") {
    verFechamentoCaixa();
  } else if (opcao === "2") {
    alternarStatusLoja();
  }
}

function alternarStatusLoja() {
  const novoStatus = !isStoreOpen();

  storeStatusRef.set(novoStatus).then(() => {
    if (novoStatus) {
      alert("🟢 Loja ABERTA com sucesso para TODOS os clientes!");
    } else {
      alert("🔴 Loja FECHADA com sucesso para TODOS os clientes!");
    }
  }).catch((error) => {
    alert("Erro ao conectar com o Firebase: " + error.message);
  });
}

function verFechamentoCaixa() {
  const historico = JSON.parse(localStorage.getItem('vendas_hoje')) || [];

  if (historico.length === 0) {
    alert("Nenhuma venda registrada neste aparelho no expediente atual.");
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

  if (confirm("⚠️ Deseja zerar o caixa para o próximo expediente?")) {
    localStorage.removeItem('vendas_hoje');
    alert("Caixa zerado com sucesso!");
  }
}

// --- CONTROLE DE PEDIDOS E INTERFACE ---

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

function toggleOrderType() {
  const orderType = document.getElementById("order-type").value;
  const addressGroup = document.getElementById("address-group");
  
  if (addressGroup) {
    addressGroup.style.display = (orderType === "Retirada") ? "none" : "block";
  }

  updateTotal();
}

function togglePayment() {
  const payment = document.getElementById("payment").value;
  const trocoGroup = document.getElementById("troco-group");
  const pixGroup = document.getElementById("pix-info-group");

  if (trocoGroup) trocoGroup.style.display = payment === "Dinheiro" ? "block" : "none";
  if (pixGroup) pixGroup.style.display = payment === "PIX" ? "block" : "none";
}

function updateTotal() {
  let subtotal = 0;
  let totalQty = 0;

  for (const key in items) {
    subtotal += items[key].qty * items[key].price;
    totalQty += items[key].qty;
  }

  const fee = totalQty > 0 ? getDeliveryFee() : 0;
  const total = subtotal + fee;

  document.getElementById("subtotal-price").innerText = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
  document.getElementById("delivery-fee").innerText = `R$ ${fee.toFixed(2).replace('.', ',')}`;
  document.getElementById("total-price").innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

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
  const bairroSelect = document.getElementById("bairro");
  const bairro = bairroSelect ? bairroSelect.value : "Água Fria";
  const payment = document.getElementById("payment").value;
  const troco = document.getElementById("troco").value.trim();
  const notes = document.getElementById("notes").value.trim();

  if (!name || (orderType === "Entrega" && !address)) {
    alert("Por favor, preencha seu nome e o endereço de entrega.");
    return;
  }

  const fee = orderType === "Entrega" ? getDeliveryFee() : 0;
  const totalFinal = subtotal + fee;

  registrarVenda(subtotal, fee, totalFinal, payment, items);

  let message = `*NOVO PEDIDO - COMIDA NA CHAPA*\n\n`;
  message += `*Tipo de Pedido:* ${orderType === "Entrega" ? "🛵 Entrega" : "🛍️ Retirada no Local"}\n`;
  message += `*Cliente:* ${name}\n`;
  
  if (orderType === "Entrega") {
    message += `*Bairro:* ${bairro}\n`;
    message += `*Endereço:* ${address}\n\n`;
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

document.addEventListener("DOMContentLoaded", () => {
  togglePayment();
});
