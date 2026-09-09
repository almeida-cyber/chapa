# Comida na Chapa — v2.0

Site completo com:
- cardápio responsivo;
- carrinho/quantidades;
- entrega e retirada;
- taxas por bairro;
- PIX, cartão e dinheiro;
- troco;
- registro dos pedidos no Firebase Realtime Database;
- envio do pedido para WhatsApp;
- status da loja em tempo real;
- painel administrativo;
- login do administrador com Firebase Authentication;
- atualização de status dos pedidos;
- indicadores de vendas.

## Arquivos

- `index.html` — loja
- `style.css` — visual da loja
- `script.js` — carrinho, checkout, Firebase e WhatsApp
- `firebase-config.js` — configuração e dados do negócio
- `admin.html` — painel
- `admin.css` — visual do painel
- `admin.js` — login e dashboard
- `database.rules.json` — regras do Realtime Database
- `firebase.json` — configuração para Firebase CLI
- `img/` — imagens locais das marmitas

## 1. Firebase Authentication

No Firebase Console:
1. Abra Authentication.
2. Ative o provedor `E-mail/senha`.
3. Crie uma conta para o administrador.
4. Use essa conta em `admin.html`.

Não coloque senha do administrador dentro do JavaScript.

## 2. Realtime Database

Crie/abra o Realtime Database e aplique o conteúdo de `database.rules.json`.

As regras permitem:
- público: consultar somente `configuracoes/lojaAberta`;
- público: criar um pedido novo em `pedidos`;
- usuário autenticado: ler e atualizar pedidos;
- usuário autenticado: alterar o status da loja.

Para produção, mantenha a conta administrativa protegida e revise as regras conforme a equipe crescer.

## 3. Testar localmente

Como os arquivos usam Firebase e recursos web, prefira o Live Server do VS Code.

Abra `index.html` pelo Live Server.

Depois abra:
`admin.html`

## 4. GitHub Pages

Envie os arquivos para o repositório e ative:
Settings → Pages → Deploy from branch → main → /root.

O site público será o `index.html`.
O painel ficará em `/admin.html`.

## 5. Editar cardápio

Edite `firebase-config.js`:
- nome;
- WhatsApp;
- PIX;
- produtos;
- preços;
- taxas dos bairros.

## 6. Imagens

As imagens atuais são SVG locais. Você pode substituir os arquivos da pasta `img/` ou alterar os nomes em `firebase-config.js`.

## Observação importante

A configuração Web do Firebase não é, por si só, uma senha. A proteção dos dados depende das regras do Realtime Database e do Firebase Authentication. O Firebase recomenda restringir leituras/escritas por regras e autenticação em produção.
