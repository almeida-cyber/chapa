/*
 * ============================================================
 * COMIDA NA CHAPA
 * CONFIGURAÇÃO DO FIREBASE
 * ============================================================
 */

const firebaseConfig = {
  apiKey: "AIzaSyD8gwCWqmadN58DwXH5fYh47iI5tZUoAqk",

  authDomain:
    "comida-na-chapa.firebaseapp.com",

  databaseURL:
    "https://comida-na-chapa-default-rtdb.firebaseio.com",

  projectId:
    "comida-na-chapa",

  storageBucket:
    "comida-na-chapa.firebasestorage.app",

  messagingSenderId:
    "18226994391",

  appId:
    "1:18226994391:web:238cf2225ebee38521e492"
};


/*
 * ============================================================
 * CONFIGURAÇÕES DA LOJA
 * ============================================================
 */

const CONFIG = {

  loja: {

    nome: "Comida na Chapa",

    descricao:
      "Comida caseira feita na chapa"

  },


  contato: {

    whatsapp:
      "5596984352841",

    pix:
      "5596984352841"

  },


  produtos: {

    calabresa: {

      nome:
        "Marmita de Calabresa",

      descricao:
        "Acompanha arroz, salada e farofa.",

      preco:
        25.00,

      imagem:
        "img/marmita-calabresa.png",

      disponivel:
        true

    },


    carne: {

      nome:
        "Marmita de Carne",

      descricao:
        "Acompanha arroz, salada e farofa.",

      preco:
        25.00,

      imagem:
        "img/carne.jpg",

      disponivel:
        true

    },


    frango: {

      nome:
        "Marmita de Frango",

      descricao:
        "Acompanha arroz, salada e farofa.",

      preco:
        25.00,

      imagem:
        "img/frango.jpg",

      disponivel:
        true

    }

  },


  taxasEntrega: {

    "Água Fria":
      3.00,

    "Pedra Branca":
      8.00

  }

};
