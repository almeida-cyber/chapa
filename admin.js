/*
 * ============================================================
 * COMIDA NA CHAPA
 * PAINEL ADMINISTRATIVO
 * ============================================================
 *
 * Requer:
 *
 * Firebase Authentication
 * Firebase Realtime Database
 *
 */


let auth = null;

let database = null;

let pedidosCache = {};


/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    inicializar();

  }
);


/* ============================================================
   FIREBASE
   ============================================================ */

function inicializar() {

  try {

    if (
      !firebaseConfig.apiKey ||
      firebaseConfig.apiKey.startsWith(
        "COLOQUE_"
      )
    ) {

      mostrarLoginMensagem(
        "Configure o firebase-config.js primeiro."
      );

      return;

    }


    firebase.initializeApp(
      firebaseConfig
    );


    auth =
      firebase.auth();


    database =
      firebase.database();


    /* OBSERVAR LOGIN */

    auth.onAuthStateChanged(
      user => {

        if (user) {

          document
            .getElementById(
              "login-section"
            )
            .classList
            .add("hidden");


          document
            .getElementById(
              "dashboard"
            )
            .classList
            .remove("hidden");


          iniciarPainel();

        } else {

          document
            .getElementById(
              "login-section"
            )
            .classList
            .remove("hidden");


          document
            .getElementById(
              "dashboard"
            )
            .classList
            .add("hidden");

        }

      }
    );


    /* EVENTOS */

    document
      .getElementById("login")
      .addEventListener(
        "click",
        login
      );


    document
      .getElementById("logout")
      .addEventListener(
        "click",
        () =>
          auth.signOut()
      );


    document
      .getElementById("refresh")
      .addEventListener(
        "click",
        carregarPedidos
      );


    document
      .getElementById("toggle-store")
      .addEventListener(
        "click",
        alternarLoja
      );


    /* DATA */

    document
      .getElementById(
        "today-label"
      )
      .textContent =
        new Date()
          .toLocaleDateString(
            "pt-BR",
            {
              dateStyle:
                "full"
            }
          );


  } catch (error) {

    mostrarLoginMensagem(
      "Erro ao iniciar o Firebase."
    );

    console.error(error);

  }

}


/* ============================================================
   LOGIN
   ============================================================ */

async function login() {

  const email =
    document
      .getElementById("email")
      .value
      .trim();


  const password =
    document
      .getElementById("password")
      .value;


  if (!email || !password) {

    mostrarLoginMensagem(
      "Informe e-mail e senha."
    );

    return;

  }


  try {

    await auth
      .signInWithEmailAndPassword(
        email,
        password
      );


    mostrarLoginMensagem("");


  } catch (error) {

    console.error(error);

    mostrarLoginMensagem(
      "E-mail ou senha inválidos."
    );

  }

}


/* ============================================================
   INICIAR PAINEL
   ============================================================ */

function iniciarPainel() {

  observarStatusLoja();

  carregarPedidos();

}


/* ============================================================
   STATUS DA LOJA
   ============================================================ */

function observarStatusLoja() {

  database
    .ref(
      "configuracoes/lojaAberta"
    )
    .on(
      "value",
      snapshot => {

        const aberta =
          snapshot.exists()
            ? snapshot.val() === true
            : true;


        atualizarBotaoLoja(
          aberta
        );

      }
    );

}


/* ============================================================
   ABRIR / FECHAR LOJA
   ============================================================ */

async function alternarLoja() {

  const ref =
    database.ref(
      "configuracoes/lojaAberta"
    );


  const snapshot =
    await ref.once("value");


  const atual =
    snapshot.exists()
      ? snapshot.val() === true
      : true;


  await ref.set(
    !atual
  );

}


/* ============================================================
   ATUALIZAR BOTÃO
   ============================================================ */

function atualizarBotaoLoja(
  aberta
) {

  const btn =
    document.getElementById(
      "toggle-store"
    );


  const stat =
    document.getElementById(
      "stat-store"
    );


  btn.textContent =
    aberta
      ? "🟢 Loja aberta — Fechar"
      : "🔴 Loja fechada — Abrir";


  btn.classList.toggle(
    "closed",
    !aberta
  );


  stat.textContent =
    aberta
      ? "Aberta"
      : "Fechada";

}


/* ============================================================
   CARREGAR PEDIDOS
   ============================================================ */

function carregarPedidos() {

  if (!database) {

    return;

  }


  database
    .ref("pedidos")
    .limitToLast(100)
    .on(
      "value",
      snapshot => {

        pedidosCache =
          snapshot.val() || {};


        renderizarDashboard();

      }
    );

}


/* ============================================================
   DASHBOARD
   ============================================================ */

function renderizarDashboard() {

  const hoje =
    new Date()
      .toISOString()
      .slice(0, 10);


  const pedidos =
    Object.values(
      pedidosCache
    )
    .filter(
      p =>
        p &&
        p.criadoEm &&
        p.criadoEm.slice(
          0,
          10
        ) === hoje
    )
    .sort(
      (a, b) =>
        new Date(b.criadoEm) -
        new Date(a.criadoEm)
    );


  let totalVendas = 0;

  let totalItens = 0;


  const pagamentos = {

    PIX: 0,

    Cartão: 0,

    Dinheiro: 0

  };


  const produtos = {};


  pedidos.forEach(
    pedido => {

      if (
        pedido.status !==
        "Cancelado"
      ) {

        totalVendas +=
          Number(
            pedido.total || 0
          );


        pagamentos[
          pedido.pagamento
        ] =
          (
            pagamentos[
              pedido.pagamento
            ] || 0
          ) +
          Number(
            pedido.total || 0
          );


        Object.values(
          pedido.itens || {}
        )
        .forEach(
          item => {

            totalItens +=
              Number(
                item.quantidade || 0
              );


            produtos[item.nome] =
              (
                produtos[item.nome] ||
                0
              ) +
              Number(
                item.quantidade || 0
              );

          }
        );

      }

    }
  );


  /* ESTATÍSTICAS */

  document.getElementById(
    "stat-orders"
  ).textContent =
    pedidos.length;


  document.getElementById(
    "stat-items"
  ).textContent =
    totalItens;


  document.getElementById(
    "stat-sales"
  ).textContent =
    formatarMoeda(
      totalVendas
    );


  document.getElementById(
    "sales-pix"
  ).textContent =
    formatarMoeda(
      pagamentos.PIX || 0
    );


  document.getElementById(
    "sales-card"
  ).textContent =
    formatarMoeda(
      pagamentos.Cartão || 0
    );


  document.getElementById(
    "sales-cash"
  ).textContent =
    formatarMoeda(
      pagamentos.Dinheiro || 0
    );


  /* PRODUTOS */

  const productSales =
    document.getElementById(
      "product-sales"
    );


  productSales.innerHTML =
    Object.entries(produtos)
      .sort(
        (a, b) =>
          b[1] - a[1]
      )
      .map(
        ([nome, qtd]) =>
          `
          <div>

            <span>
              ${escapeHtml(nome)}
            </span>

            <strong>
              ${qtd}
            </strong>

          </div>
          `
      )
      .join("")
      ||
      `
        <div>

          <span>
            Nenhuma venda
          </span>

          <strong>
            0
          </strong>

        </div>
      `;


  document.getElementById(
    "orders-count"
  ).textContent =
    `${pedidos.length} hoje`;


  renderizarPedidos(
    pedidos
  );

}


/* ============================================================
   RENDERIZAR PEDIDOS
   ============================================================ */

function renderizarPedidos(
  pedidos
) {

  const container =
    document.getElementById(
      "orders-list"
    );


  container.innerHTML = "";


  if (!pedidos.length) {

    container.innerHTML =
      `
      <div class="empty">

        Nenhum pedido encontrado hoje.

      </div>
      `;

    return;

  }


  pedidos.forEach(
    pedido => {

      const template =
        document.getElementById(
          "order-template"
        );


      const card =
        template
          .content
          .cloneNode(true);


      const root =
        card.querySelector(
          ".order-card"
        );


      card.querySelector(
        ".order-id"
      ).textContent =
        pedido.id;


      card.querySelector(
        ".order-time"
      ).textContent =
        new Date(
          pedido.criadoEm
        )
        .toLocaleTimeString(
          "pt-BR",
          {
            hour:
              "2-digit",

            minute:
              "2-digit"
          }
        );


      card.querySelector(
        ".order-status"
      ).textContent =
        pedido.status ||
        "Novo";


      card.querySelector(
        ".order-client"
      ).textContent =
        pedido
          .cliente
          ?.nome ||
        "Cliente";


      card.querySelector(
        ".order-address"
      ).textContent =

        pedido.cliente?.tipo ===
        "Entrega"

          ? `${
              pedido.cliente?.bairro ||
              ""
            } • ${
              pedido.cliente?.endereco ||
              ""
            }`

          : "Retirada no estabelecimento";


      const itemsEl =
        card.querySelector(
          ".order-items"
        );


      itemsEl.innerHTML =
        Object.values(
          pedido.itens || {}
        )
        .map(
          item =>
            `
            ${item.quantidade}x
            ${escapeHtml(item.nome)}
            —
            ${formatarMoeda(
              Number(
                item.total || 0
              )
            )}
            `
        )
        .join("<br>");


      card.querySelector(
        ".order-total"
      ).textContent =
        `Total: ${
          formatarMoeda(
            Number(
              pedido.total || 0
            )
          )
        }`;


      card.querySelector(
        ".order-payment"
      ).textContent =
        `Pagamento: ${
          pedido.pagamento || "-"
        }`;


      card.querySelector(
        ".order-notes"
      ).textContent =
        pedido.observacoes
          ? `Obs.: ${pedido.observacoes}`
          : "";


      const select =
        card.querySelector(
          ".status-select"
        );


      select.value =
        pedido.status ||
        "Novo";


      card.querySelector(
        ".save-status"
      ).addEventListener(
        "click",
        async () => {

          try {

            await database
              .ref(
                `pedidos/${pedido.id}/status`
              )
              .set(
                select.value
              );


            alert(
              "Status atualizado!"
            );


          } catch (error) {

            alert(
              "Não foi possível atualizar o status."
            );


            console.error(
              error
            );

          }

        }
      );


      container.appendChild(
        card
      );

    }
  );

}


/* ============================================================
   MENSAGEM LOGIN
   ============================================================ */

function mostrarLoginMensagem(
  texto
) {

  document.getElementById(
    "login-message"
  ).textContent =
    texto;

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
   SEGURANÇA HTML
   ============================================================ */

function escapeHtml(
  texto
) {

  return String(
    texto || ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}
