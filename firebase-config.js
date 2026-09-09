/*
 * ============================================================
 * COMIDA NA CHAPA
 * CONFIGURAÇÃO DO FIREBASE + CONFIGURAÇÃO DA LOJA
 * ============================================================
 *
 * Este arquivo é usado pelo:
 *
 * index.html
 * admin.html
 *
 * ------------------------------------------------------------
 * FIREBASE
 * ------------------------------------------------------------
 *
 * 1. Entre no Firebase Console.
 * 2. Abra seu projeto.
 * 3. Vá em Configurações do projeto.
 * 4. Adicione/abra seu aplicativo Web.
 * 5. Copie a configuração do Firebase.
 *
 * IMPORTANTE:
 *
 * A configuração Web do Firebase pode aparecer no código
 * público do site.
 *
 * A segurança deve ser feita pelas REGRAS do Firebase.
 *
 */


/* ============================================================
   CONFIGURAÇÃO FIREBASE
   ============================================================ */

const firebaseConfig = {

  apiKey: "COLOQUE_SUA_API_KEY",

  authDomain:
    "SEU-PROJETO.firebaseapp.com",

  databaseURL:
    "https://SEU-PROJETO-default-rtdb.firebaseio.com",

  projectId:
    "SEU-PROJETO",

  storageBucket:
    "SEU-PROJETO.firebasestorage.app",

  messagingSenderId:
    "SEU_MESSAGING_SENDER_ID",

  appId:
    "SEU_APP_ID"

};


/* ============================================================
   CONFIGURAÇÃO DA LOJA
   ============================================================ */

const CONFIG = {

  loja: {

    nome:
      "Comida na Chapa",

    descricao:
      "Comida caseira feita na chapa"

  },


  /* ==========================================================
     CONTATO
     ========================================================== */

  contato: {

    /*
     * Número do WhatsApp:
     *
     * Brasil:
     * 55 + DDD + número
     *
     * Exemplo:
     * 5596984352841
     */

    whatsapp:
      "5596984352841",


    /*
     * Chave PIX
     */

    pix:
      "96984352841"

  },


  /* ==========================================================
     PRODUTOS
     ========================================================== */

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


  /* ==========================================================
     TAXAS DE ENTREGA
     ========================================================== */

  taxasEntrega: {

    "Água Fria":
      3.00,

    "Pedra Branca":
      8.00

  }

};
