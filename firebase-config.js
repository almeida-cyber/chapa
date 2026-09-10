// Configuração do Firebase do projeto "Comida na Chapa".
// A chave Web do Firebase pode aparecer no código do navegador.
// A segurança real fica nas Authentication + Realtime Database Security Rules.

const firebaseConfig = {
  apiKey: "AIzaSyD8gwCWqmadN58DwXH5fYh47iI5tZUoAqk",
  authDomain: "comida-na-chapa.firebaseapp.com",
  databaseURL: "https://comida-na-chapa-default-rtdb.firebaseio.com",
  projectId: "comida-na-chapa",
  storageBucket: "comida-na-chapa.firebasestorage.app",
  messagingSenderId: "18226994391",
  appId: "1:18226994391:web:238cf2225ebee38521e492"
};

const CONFIG = {
  loja: {
    nome: "Comida na Chapa",
    descricao: "Quentinha, saborosa e feita na hora"
  },
  whatsappNumber: "5596984352841",
  pixKey: "96984352841",
  produtos: [
    { id: "calabresa", nome: "Marmita de Calabresa", descricao: "Calabresa na chapa com acompanhamento.", preco: 25, imagem: "marmita de calabresa.png", disponivel: true },
    { id: "carne", nome: "Marmita de Carne", descricao: "Carne na chapa com acompanhamento.", preco: 25, imagem: "marmita de carne.png", disponivel: true },
    { id: "frango", nome: "Marmita de Frango", descricao: "Frango na chapa com acompanhamento.", preco: 25, imagem: "marmita de frango.png", disponivel: true }
  ],
  taxas: {
    "Água Fria": 3,
    "Pedra Branca": 8,
  }
};
