/*
 * ============================================================
 * COMIDA NA CHAPA
 * SISTEMA DO CLIENTE
 * ============================================================
 */

let database = null;

let lojaAberta = true;


/* ============================================================
   CARRINHO
   ============================================================ */

const carrinho = {};

Object.keys(CONFIG.produtos).forEach(key => {

  carrinho[key] = 0;

});


/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    inicializarFirebase();

    renderizarCardapio();

    carregarBairros();

    configurarEventos();

    atualizarPagamento();

    atualizarTipoPedido();

    atualizarTotais();

  }
);


/* ============================================================
   FIREBASE
   ============================================================ */

function inicializarFirebase() {

  try {

    if (
      !firebaseConfig.apiKey ||
      firebaseConfig.apiKey.startsWith("COLOQUE_")
    ) {

      console.warn(
        "Firebase ainda não configurado."
      );

      atualizarStatusLoja(true);

      return;

    }


    firebase.initializeApp(
      firebaseConfig
    );


    database =
      firebase.database();


    const statusRef =
      database.ref(
        "configuracoes/lojaAberta"
      );


    statusRef.on(
      "value",
      snapshot => {

        if (snapshot.exists()) {

          lojaAberta =
            snapshot.val() === true;

        } else {

          statusRef.set(true);

          lojaAberta = true;

        }


        atualizarStatusLoja(
          lojaAberta
        );

      }
    );


  } catch (error) {

    console.error(
      "Firebase:",
      error
    );

    atualizarStatusLoja(true);

  }

}


/* ============================================================
   CARDÁPIO
   ============================================================ */

function renderizarCardapio() {

  const container =
    document.getElementById(
      "menu-list"
    );


  container.innerHTML = "";


  Object.entries(
    CONFIG.produtos
  ).forEach(
    ([key, produto]) => {

      const card =
        document.createElement(
          "article"
        );


      card.className =
        "card";


      card.innerHTML = `

        <img
          src="${produto.imagem}"
          alt="${produto.nome}"
          class="card-img"
          onerror="this.src='https://placehold.co/600x400?text=Marmita'"
        >

        <div class="card-info">

          <span class="product-tag">

            ${
              produto.disponivel
                ? "Disponível"
                : "Indisponível"
            }

          </span>

          <h3>
            ${produto.nome}
          </h3>

          <p>
            ${produto.descricao}
          </p>

          <strong class="price">
            ${formatarMoeda(produto.preco)}
          </strong>

        </div>


        <div class="qty-controls">

          <button
            type="button"
            aria-label="Diminuir ${produto.nome}"
            onclick="alterarQuantidade('${key}', -1)"
          >
            −
          </button>


          <span id="qty-${key}">
            0
          </span>


          <button
            type="button"
            aria-label="Aumentar ${produto.nome}"
            onclick="alterarQuantidade('${key}', 1)"
            ${
              !produto.disponivel
                ? "disabled"
                : ""
            }
          >
            +
          </button>

        </div>

      `;


      container.appendChild(card);

    }
  );

}


/* ============================================================
   BAIRROS
   ============================================================ */

function carregarBairros() {

  const select =
    document.getElementById(
      "bairro"
    );


  select.innerHTML =
    Object.entries(
      CONFIG.taxasEntrega
    )
    .map(
      ([bairro, taxa]) => `

        <option value="${bairro}">

          ${bairro}
          (${formatarMoeda(taxa)})

        </option>

      `
    )
    .join("");

}


/* ============================================================
   EVENTOS
   ============================================================ */

function configurarEventos() {

  document
    .getElementById("order-type")
    .addEventListener(
      "change",
      () => {

        atualizarTipoPedido();

        atualizarTotais();

      }
    );


  document
    .getElementById("bairro")
    .addEventListener(
      "change",
      atualizarTotais
    );


  document
    .getElementById("payment")
    .addEventListener(
      "change",
      atualizarPagamento
    );


  document
    .getElementById("btn-order")
    .addEventListener(
      "click",
      enviarPedido
    );


  document
    .getElementById("copy-pix")
    .addEventListener(
      "click",
      copiarPix
    );


  document
    .getElementById("go-checkout")
    .addEventListener(
      "click",
      () => {

        document
          .querySelector(".checkout-form")
          .scrollIntoView({
            behavior: "smooth"
          });

      }
    );


  document
    .getElementById("store-name")
    .textContent =
      CONFIG.loja.nome;

}


/* ============================================================
   ALTERAR QUANTIDADE
   ============================================================ */

function alterarQuantidade(
  key,
  delta
) {

  if (!lojaAberta) {

    mostrarFeedback(
      "A loja está fechada no momento.",
      "erro"
    );

    return;

  }


  const produto =
    CONFIG.produtos[key];


  if (
    !produto ||
    !produto.disponivel
  ) {

    return;

  }


  carrinho[key] =
    Math.max(
      0,
      carrinho[key] + delta
    );


  const quantidade =
    document.getElementById(
      `qty-${key}`
    );


  if (quantidade) {

    quantidade.textContent =
      carrinho[key];

  }


  atualizarTotais();

}


/* ============================================================
   TIPO DE PEDIDO
   ============================================================ */

function atualizarTipoPedido() {

  const entrega =
    document.getElementById(
      "order-type"
    ).value === "Entrega";


  document
    .getElementById(
      "address-group"
    )
    .classList
    .toggle(
      "hidden",
      !entrega
    );


  document
    .getElementById(
      "bairro"
    )
    .disabled =
      !entrega;

}


/* ============================================================
   PAGAMENTO
   ============================================================ */

function atualizarPagamento() {

  const pagamento =
    document.getElementById(
      "payment"
    ).value;


  document
    .getElementById(
      "troco-group"
    )
    .classList
    .toggle(
      "hidden",
      pagamento !== "Dinheiro"
    );


  document
    .getElementById(
      "pix-info-group"
    )
    .classList
    .toggle(
      "hidden",
      pagamento !== "PIX"
    );


  document
    .getElementById(
      "pix-key"
    )
    .textContent =
      CONFIG.contato.pix ||
      "Não configurada";

}


/* ============================================================
   SUBTOTAL
   ============================================================ */

function calcularSubtotal() {

  return Object.entries(
    carrinho
  ).reduce(
    (total, [key, quantidade]) => {

      return (
        total +
        (
          CONFIG.produtos[key].preco *
          quantidade
        )
      );

    },
    0
  );

}


/* ============================================================
   QUANTIDADE TOTAL
   ============================================================ */

function quantidadeTotal() {

  return Object
    .values(carrinho)
    .reduce(
      (total, qtd) =>
        total + qtd,
      0
    );

}


/* ============================================================
   TAXA
   ============================================================ */

function obterTaxaEntrega() {

  if (
    document.getElementById(
      "order-type"
    ).value !== "Entrega"
  ) {

    return 0;

  }


  const bairro =
    document.getElementById(
      "bairro"
    ).value;


  return (
    CONFIG.taxasEntrega[bairro] ||
    0
  );

}


/* ============================================================
   ATUALIZAR TOTAIS
   ============================================================ */

function atualizarTotais() {

  const subtotal =
    calcularSubtotal();


  const quantidade =
    quantidadeTotal();


  const taxa =
    quantidade > 0
      ? obterTaxaEntrega()
      : 0;


  const total =
    subtotal + taxa;


  document.getElementById(
    "items-count"
  ).textContent =
    quantidade;


  document.getElementById(
    "subtotal-price"
  ).textContent =
    formatarMoeda(subtotal);


  document.getElementById(
    "delivery-fee"
  ).textContent =
    formatarMoeda(taxa);


  document.getElementById(
    "total-price"
  ).textContent =
    formatarMoeda(total);


  document.getElementById(
    "cart-total"
  ).textContent =
    formatarMoeda(total);


  document
    .getElementById("cart-bar")
    .classList
    .toggle(
      "visible",
      quantidade > 0
    );

}


/* ============================================================
   ENVIAR PEDIDO
   ============================================================ */

async function enviarPedido() {

  if (!lojaAberta) {

    mostrarFeedback(
      "A loja está fechada no momento.",
      "erro"
    );

    return;

  }


  const quantidade =
    quantidadeTotal();


  if (quantidade === 0) {

    mostrarFeedback(
      "Adicione pelo menos uma marmita ao pedido.",
      "erro"
    );

    return;

  }


  const nome =
    document
      .getElementById("name")
      .value
      .trim();


  const tipo =
    document
      .getElementById("order-type")
      .value;


  const endereco =
    document
      .getElementById("address")
      .value
      .trim();


  const bairro =
    document
      .getElementById("bairro")
      .value;


  const pagamento =
    document
      .getElementById("payment")
      .value;


  const troco =
    document
      .getElementById("troco")
      .value
      .trim();


  const observacoes =
    document
      .getElementById("notes")
      .value
      .trim();


  /* VALIDAÇÃO */

  if (!nome) {

    mostrarFeedback(
      "Informe seu nome.",
      "erro"
    );

    document
      .getElementById("name")
      .focus();

    return;

  }


  if (
    tipo === "Entrega" &&
    !endereco
  ) {

    mostrarFeedback(
      "Informe o endereço de entrega.",
      "erro"
    );

    document
      .getElementById("address")
      .focus();

    return;

  }


  if (
    pagamento === "Dinheiro" &&
    !troco
  ) {

    mostrarFeedback(
      "Informe para quanto precisa de troco.",
      "erro"
    );

    document
      .getElementById("troco")
      .focus();

    return;

  }


  const subtotal =
    calcularSubtotal();


  const taxa =
    obterTaxaEntrega();


  const total =
    subtotal + taxa;


  const pedidoId =
    gerarIdPedido();


  /* ITENS */

  const itens = {};


  Object.entries(
    carrinho
  ).forEach(
    ([key, qtd]) => {

      if (qtd > 0) {

        itens[key] = {

          nome:
            CONFIG.produtos[key].nome,

          quantidade:
            qtd,

          precoUnitario:
            CONFIG.produtos[key].preco,

          total:
            CONFIG.produtos[key].preco *
            qtd

        };

      }

    }
  );


  /* OBJETO DO PEDIDO */

  const pedido = {

    id:
      pedidoId,

    criadoEm:
      new Date().toISOString(),

    status:
      "Novo",

    cliente: {

      nome,

      tipo,

      bairro:
        tipo === "Entrega"
          ? bairro
          : "",

      endereco:
        tipo === "Entrega"
          ? endereco
          : "Retirada no estabelecimento"

    },

    itens,

    subtotal,

    taxaEntrega:
      taxa,

    total,

    pagamento,

    troco:
      pagamento === "Dinheiro"
        ? troco
        : "",

    observacoes

  };


  const mensagem =
    montarMensagemWhatsApp(
      pedido
    );


  try {

    if (database) {

      await database
        .ref(
          `pedidos/${pedidoId}`
        )
        .set(pedido);

    }


    window.open(
      `https://wa.me/${CONFIG.contato.whatsapp}?text=${encodeURIComponent(mensagem)}`,
      "_blank"
    );


    mostrarFeedback(
      `Pedido ${pedidoId} enviado com sucesso!`,
      "sucesso"
    );


    limparCarrinho();


  } catch (error) {

    console.error(error);


    mostrarFeedback(
      "Não foi possível registrar o pedido. Tente novamente.",
      "erro"
    );

  }

}


/* ============================================================
   WHATSAPP
   ============================================================ */

function montarMensagemWhatsApp(
  pedido
) {

  let itensTexto = "";


  Object.values(
    pedido.itens
  ).forEach(
    item => {

      itensTexto +=
        `• ${item.quantidade}x ${item.nome} — ${formatarMoeda(item.total)}\n`;

    }
  );


  return `*NOVO PEDIDO - ${CONFIG.loja.nome.toUpperCase()}*

*Pedido:* ${pedido.id}
*Cliente:* ${pedido.cliente.nome}
*Tipo:* ${
  pedido.cliente.tipo === "Entrega"
    ? "🛵 Entrega"
    : "🛍️ Retirada"
}

${
  pedido.cliente.tipo === "Entrega"
    ? `*Bairro:* ${pedido.cliente.bairro}
*Endereço:* ${pedido.cliente.endereco}
`
    : ""
}

*ITENS:*
${itensTexto}
*Acompanhamentos:* Arroz, Salada e Farofa

*Subtotal:* ${formatarMoeda(pedido.subtotal)}
*Taxa de entrega:* ${formatarMoeda(pedido.taxaEntrega)}
*TOTAL:* ${formatarMoeda(pedido.total)}

*Pagamento:* ${pedido.pagamento}
${
  pedido.troco
    ? `*Troco para:* ${pedido.troco}
`
    : ""
}
${
  pedido.observacoes
    ? `*Observações:* ${pedido.observacoes}`
    : ""
}`;

}


/* ============================================================
   LIMPAR CARRINHO
   ============================================================ */

function limparCarrinho() {

  Object.keys(
    carrinho
  ).forEach(
    key => {

      carrinho[key] = 0;


      const el =
        document.getElementById(
          `qty-${key}`
        );


      if (el) {

        el.textContent = "0";

      }

    }
  );


  atualizarTotais();

}


/* ============================================================
   STATUS DA LOJA
   ============================================================ */

function atualizarStatusLoja(
  aberta
) {

  lojaAberta =
    aberta;


  const badge =
    document.getElementById(
      "status-badge"
    );


  const button =
    document.getElementById(
      "btn-order"
    );


  if (aberta) {

    badge.textContent =
      "🟢 Aberto para pedidos";

    badge.className =
      "status-badge open";


    button.disabled =
      false;


    button.textContent =
      "📲 Enviar pedido pelo WhatsApp";

  } else {

    badge.textContent =
      "🔴 Fechado no momento";

    badge.className =
      "status-badge closed";


    button.disabled =
      true;


    button.textContent =
      "🔒 Loja fechada";

  }

}


/* ============================================================
   COPIAR PIX
   ============================================================ */

async function copiarPix() {

  try {

    await navigator
      .clipboard
      .writeText(
        CONFIG.contato.pix
      );


    mostrarFeedback(
      "Chave PIX copiada!",
      "sucesso"
    );


  } catch {

    mostrarFeedback(
      "Não foi possível copiar automaticamente.",
      "erro"
    );

  }

}


/* ============================================================
   ID DO PEDIDO
   ============================================================ */

function gerarIdPedido() {

  const data =
    new Date();


  const parteData =
    data
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");


  const aleatorio =
    Math.floor(
      1000 +
      Math.random() * 9000
    );


  return `PED-${parteData}-${aleatorio}`;

}


/* ============================================================
   MOEDA
   ============================================================ */

function formatarMoeda(
  valor
) {

  return Number(
    valor || 0
  ).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );

}


/* ============================================================
   FEEDBACK
   ============================================================ */

function mostrarFeedback(
  texto,
  tipo
) {

  const el =
    document.getElementById(
      "order-feedback"
    );


  el.textContent =
    texto;


  el.className =
    `feedback ${tipo}`;


  setTimeout(
    () => {

      el.textContent =
        "";

      el.className =
        "feedback";

    },
    5000
  );

}
