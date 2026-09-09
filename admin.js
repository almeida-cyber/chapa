let auth, db, ordersCache = {};
const money = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  try{
    if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.database();

    auth.onAuthStateChanged(user => {
      $("loginScreen").classList.toggle("hidden", !!user);
      $("dashboard").classList.toggle("hidden", !user);
      if(user) startDashboard();
    });

    $("loginForm").addEventListener("submit", login);
    $("logout").addEventListener("click", () => auth.signOut());
    $("storeToggle").addEventListener("click", toggleStore);
  }catch(error){
    console.error(error);
    $("loginError").textContent = "Erro ao iniciar Firebase.";
  }
});

async function login(e){
  e.preventDefault();
  $("loginError").textContent = "";
  try{
    await auth.signInWithEmailAndPassword($("email").value.trim(), $("password").value);
  }catch(error){
    console.error(error);
    $("loginError").textContent = "E-mail ou senha inválidos.";
  }
}

function startDashboard() {

  // Status da loja
  db.ref("configuracoes/lojaAberta").on("value", snap => {
    const open = snap.exists() ? snap.val() === true : true;

    const btn = $("storeToggle");

    btn.textContent = open ? "● Aberta" : "● Fechada";
    btn.className = open ? "open" : "";
  });

  // Monitorar conexão com Firebase
  db.ref(".info/connected").on("value", snap => {
    const conectado = snap.val() === true;

    $("connection").textContent =
      conectado ? "● conectado" : "● desconectado";

    $("connection").className =
      conectado ? "connected" : "disconnected";
  });

  // PEDIDOS EM TEMPO REAL
  db.ref("pedidos")
    .orderByChild("criadoEm")
    .limitToLast(100)
    .on("value", snap => {

      console.log("🔥 Firebase atualizou os pedidos");

      ordersCache = snap.val() || {};

      renderDashboard();

    }, error => {

      console.error("Erro Firebase:", error);

      $("connection").textContent = "● erro Firebase";
    });
}
async function toggleStore(){
  const current = $("storeToggle").classList.contains("open");
  try{ await db.ref("configuracoes/lojaAberta").set(!current); }
  catch(e){ alert("Não foi possível alterar o status."); }
}

function renderDashboard(){
  const orders = Object.values(ordersCache).sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm)));
  const today = new Date().toISOString().slice(0,10);
  const todayOrders = orders.filter(o => String(o.criadoEm||"").slice(0,10) === today);
  const valid = todayOrders.filter(o => o.status !== "Cancelado");

  const meals = valid.reduce((sum,o)=>sum+(o.itens||[]).reduce((s,i)=>s+Number(i.quantidade||0),0),0);
  const sales = valid.reduce((sum,o)=>sum+Number(o.total||0),0);
  $("statOrders").textContent = todayOrders.length;
  $("statMeals").textContent = meals;
  $("statSales").textContent = money(sales);
  $("statTicket").textContent = money(valid.length ? sales/valid.length : 0);

  renderOrders(orders.slice(0,30));
  renderPayments(valid);
  renderProducts(valid);
}

function renderOrders(orders){
  const el = $("orders");
  if(!orders.length){el.innerHTML="<p>Nenhum pedido registrado.</p>";return}
  el.innerHTML = orders.map(o => `
    <article class="order">
      <div class="order-head">
        <div><div class="order-id">${esc(o.id)}</div><div class="order-meta">${formatDate(o.criadoEm)} • ${esc(o.cliente?.nome || "")}</div></div>
        <strong>${money(o.total)}</strong>
      </div>
      <div class="order-items">${(o.itens||[]).map(i=>`${Number(i.quantidade)}x ${esc(i.nome)} — ${money(i.preco*i.quantidade)}`).join("<br>")}</div>
      <div class="order-meta">${esc(o.cliente?.recebimento||"")} • ${esc(o.cliente?.bairro||"")} • ${esc(o.pagamento||"")}</div>
      <div class="order-footer">
        <span class="order-total">${o.cliente?.endereco ? esc(o.cliente.endereco) : "Retirada"}</span>
        <select onchange="updateStatus('${escAttr(o.id)}',this.value)">
          ${["Novo","Em preparo","Saiu para entrega","Concluído","Cancelado"].map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
    </article>
  `).join("");
}

window.updateStatus = async function(id,status){
  try{ await db.ref("pedidos/"+id+"/status").set(status); }
  catch(e){ alert("Erro ao atualizar o pedido."); }
};

function renderPayments(orders){
  const totals = {};
  orders.forEach(o=>totals[o.pagamento]=(totals[o.pagamento]||0)+Number(o.total||0));
  $("payments").innerHTML = Object.keys(totals).length ? Object.entries(totals).map(([k,v])=>`<div class="metric-line"><span>${esc(k)}</span><strong>${money(v)}</strong></div>`).join("") : "<p>Nenhuma venda hoje.</p>";
}
function renderProducts(orders){
  const totals = {};
  orders.forEach(o=>(o.itens||[]).forEach(i=>totals[i.nome]=(totals[i.nome]||0)+Number(i.quantidade||0)));
  $("products").innerHTML = Object.keys(totals).length ? Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="metric-line"><span>${esc(k)}</span><strong>${v} un.</strong></div>`).join("") : "<p>Nenhuma venda hoje.</p>";
}
function formatDate(value){try{return new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}catch{return value}}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function escAttr(s){return esc(s).replace(/'/g,"&#039;")}
