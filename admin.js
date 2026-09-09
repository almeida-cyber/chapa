let auth, db;
let ordersCache = {};
let ordersListener = null;
let storeListener = null;

const money = v =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.database();

    auth.onAuthStateChanged(user => {
      $("loginScreen").classList.toggle("hidden", !!user);
      $("dashboard").classList.toggle("hidden", !user);

      if (user) {
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
    $("loginError").textContent = "Erro ao iniciar Firebase.";
  }
});


// ===============================
// LOGIN
// ===============================

async function login(e) {
  e.preventDefault();

  $("loginError").textContent = "";

  try {
    await auth.signInWithEmailAndPassword(
      $("email").value.trim(),
      $("password").value
    );

  } catch (error) {
    console.error("Erro no login:", error);

    $("loginError").textContent =
      "E-mail ou senha inválidos.";
  }
}


// ===============================
// DASHBOARD EM TEMPO REAL
// ===============================

function startDashboard() {

  stopDashboard();

  $("connection").textContent = "● conectando...";


  // -------------------------------
  // STATUS DA LOJA
  // -------------------------------

  storeListener = db.ref("configuracoes/lojaAberta");

  storeListener.on(
    "value",

    snapshot => {

      const open = snapshot.exists()
        ? snapshot.val() === true
        : true;

      const button = $("storeToggle");

      button.textContent =
        open
          ? "● Aberta"
          : "● Fechada";

      button.className =
        open
          ? "open"
          : "";

      $("connection").textContent =
        "● conectado";
    },

    error => {

      console.error(
        "Erro ao acompanhar status da loja:",
        error
      );

      $("connection").textContent =
        "● erro";
    }
  );


  // -------------------------------
  // PEDIDOS EM TEMPO REAL
  // -------------------------------

  ordersListener = db
    .ref("pedidos")
    .orderByChild("criadoEm")
    .limitToLast(100);


  ordersListener.on(

    "value",

    snapshot => {

      ordersCache =
        snapshot.val() || {};

      $("connection").textContent =
        "● conectado";

      renderDashboard();
    },

    error => {

      console.error(
        "Erro ao acompanhar pedidos:",
        error
      );

      $("connection").textContent =
        "● erro";
    }
  );


  // -------------------------------
  // CONEXÃO COM FIREBASE
  // -------------------------------

  db.ref(".info/connected").on(
    "value",

    snapshot => {

      if (snapshot.val() === true) {

        $("connection").textContent =
          "● conectado";

      } else {

        $("connection").textContent =
          "● desconectado";
      }
    }
  );
}


// ===============================
// PARAR LISTENERS
// ===============================

function stopDashboard() {

  if (storeListener) {

    storeListener.off();

    storeListener = null;
  }


  if (ordersListener) {

    ordersListener.off();

    ordersListener = null;
  }


  if (db) {

    db.ref(".info/connected").off();
  }


  ordersCache = {};
}


// ===============================
// ABRIR / FECHAR LOJA
// ===============================

async function toggleStore() {

  const current =
    $("storeToggle").classList.contains("open");

  try {

    await db
      .ref("configuracoes/lojaAberta")
      .set(!current);

  } catch (error) {

    console.error(
      "Erro ao alterar status da loja:",
      error
    );

    alert(
      "Não foi possível alterar o status."
    );
  }
}


// ===============================
// DATA LOCAL - AMAPÁ / BRASIL
// ===============================

function localDateKey(date = new Date()) {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "America/Belem",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(date);


  const get = type =>
    parts.find(
      part => part.type === type
    )?.value;


  return `${get("year")}-${get("month")}-${get("day")}`;
}


// ===============================
// DATA DO PEDIDO
// ===============================

function orderDateKey(value) {

  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(value)
      .slice(0, 10);
  }


  return localDateKey(date);
}


// ===============================
// RENDER DASHBOARD
// ===============================

function renderDashboard() {

  const orders =
    Object.values(
      ordersCache
    ).sort(
      (a, b) =>
        new Date(b.criadoEm).getTime() -
        new Date(a.criadoEm).getTime()
    );


  const today =
    localDateKey();


  const todayOrders =
    orders.filter(
      order =>
        orderDateKey(
          order.criadoEm
        ) === today
    );


  const valid =
    todayOrders.filter(
      order =>
        order.status !== "Cancelado"
    );


  const meals =
    valid.reduce(

      (sum, order) =>

        sum +

        (order.itens || []).reduce(

          (total, item) =>

            total +
            Number(
              item.quantidade || 0
            ),

          0
        ),

      0
    );


  const sales =
    valid.reduce(

      (sum, order) =>

        sum +
        Number(
          order.total || 0
        ),

      0
    );


  $("statOrders").textContent =
    todayOrders.length;


  $("statMeals").textContent =
    meals;


  $("statSales").textContent =
    money(sales);


  $("statTicket").textContent =
    money(
      valid.length
        ? sales / valid.length
        : 0
    );


  renderOrders(
    orders.slice(0, 30)
  );


  renderPayments(valid);


  renderProducts(valid);
}


// ===============================
// PEDIDOS
// ===============================

function renderOrders(orders) {

  const element =
    $("orders");


  if (!orders.length) {

    element.innerHTML =
      "<p>Nenhum pedido registrado.</p>";

    return;
  }


  element.innerHTML =
    orders
      .map(
        order => `

          <article class="order">

            <div class="order-head">

              <div>

                <div class="order-id">
                  ${esc(order.id)}
                </div>

                <div class="order-meta">

                  ${formatDate(
                    order.criadoEm
                  )}

                  •

                  ${esc(
                    order.cliente?.nome || ""
                  )}

                </div>

              </div>


              <strong>
                ${money(order.total)}
              </strong>

            </div>


            <div class="order-items">

              ${(order.itens || [])
                .map(
                  item =>

                    `${Number(
                      item.quantidade
                    )}x ${esc(
                      item.nome
                    )} — ${money(
                      Number(
                        item.preco || 0
                      ) *
                      Number(
                        item.quantidade || 0
                      )
                    )}`
                )
                .join("<br>")}

            </div>


            <div class="order-meta">

              ${esc(
                order.cliente?.recebimento || ""
              )}

              •

              ${esc(
                order.cliente?.bairro || ""
              )}

              •

              ${esc(
                order.pagamento || ""
              )}

            </div>


            <div class="order-footer">

              <span class="order-total">

                ${
                  order.cliente?.endereco

                    ? esc(
                        order.cliente.endereco
                      )

                    : "Retirada"
                }

              </span>


              <select
                onchange="updateStatus(
                  '${escAttr(order.id)}',
                  this.value
                )"
              >

                ${
                  [
                    "Novo",
                    "Em preparo",
                    "Saiu para entrega",
                    "Concluído",
                    "Cancelado"
                  ]

                  .map(
                    status =>

                      `<option ${
                        status === order.status
                          ? "selected"
                          : ""
                      }>
                        ${status}
                      </option>`
                  )

                  .join("")
                }

              </select>

            </div>

          </article>

        `
      )
      .join("");
}


// ===============================
// ATUALIZAR STATUS
// ===============================

window.updateStatus =
  async function (
    id,
    status
  ) {

    try {

      await db
        .ref(
          `pedidos/${id}/status`
        )
        .set(status);

    } catch (error) {

      console.error(
        "Erro ao atualizar status:",
        error
      );

      alert(
        "Erro ao atualizar o pedido."
      );
    }
  };


// ===============================
// PAGAMENTOS
// ===============================

function renderPayments(
  orders
) {

  const totals = {};


  orders.forEach(
    order => {

      const payment =
        order.pagamento ||
        "Não informado";


      totals[payment] =
        (totals[payment] || 0) +
        Number(
          order.total || 0
        );
    }
  );


  $("payments").innerHTML =
    Object.keys(totals).length

      ? Object.entries(totals)

          .map(
            ([key, value]) => `

              <div class="metric-line">

                <span>
                  ${esc(key)}
                </span>

                <strong>
                  ${money(value)}
                </strong>

              </div>

            `
          )

          .join("")

      : "<p>Nenhuma venda hoje.</p>";
}


// ===============================
// PRODUTOS
// ===============================

function renderProducts(
  orders
) {

  const totals = {};


  orders.forEach(
    order =>

      (order.itens || [])
        .forEach(
          item => {

            const name =
              item.nome ||
              "Produto";


            totals[name] =
              (totals[name] || 0) +
              Number(
                item.quantidade || 0
              );
          }
        )
  );


  $("products").innerHTML =
    Object.keys(totals).length

      ? Object.entries(totals)

          .sort(
            (a, b) =>
              b[1] - a[1]
          )

          .map(
            ([key, value]) => `

              <div class="metric-line">

                <span>
                  ${esc(key)}
                </span>

                <strong>
                  ${value} un.
                </strong>

              </div>

            `
          )

          .join("")

      : "<p>Nenhuma venda hoje.</p>";
}


// ===============================
// FORMATAÇÃO DE DATA
// ===============================

function formatDate(
  value
) {

  try {

    const date =
      new Date(value);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return String(
        value || ""
      );
    }


    return date.toLocaleString(
      "pt-BR",
      {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Belem"
      }
    );

  } catch {

    return String(
      value || ""
    );
  }
}


// ===============================
// SEGURANÇA HTML
// ===============================

function esc(s) {

  return String(
    s ?? ""
  ).replace(
    /[&<>"']/g,

    char =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
  );
}


function escAttr(s) {

  return esc(s)
    .replace(
      /'/g,
      "&#039;"
    );
}
