# Controle de Caixa Âncora

Sistema de controle de vendas desenvolvido para PMEs.
Distribuição gratuita pela Âncora Consultoria Financeira.

---

## 📁 Estrutura de Pastas

```
/ (raiz do projeto)
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── img/
│   └── splash-bg.svg        ← imagem de fundo da tela inicial
│                               (substitua por uma .jpg se preferir)
└── lib/
    ├── bootstrap/
    │   ├── css/
    │   │   └── bootstrap.min.css
    │   └── js/
    │       └── bootstrap.bundle.min.js
    ├── bootstrap-icons/
    │   ├── bootstrap-icons.css
    │   └── fonts/
    │       ├── bootstrap-icons.woff
    │       └── bootstrap-icons.woff2
    └── chartjs/
        └── chart.min.js
```

---

## ✅ Funcionalidades

### 🛒 Vendas
- Buscar e adicionar produtos cadastrados
- Adicionar itens avulsos com descrição e valor livre
- Alterar quantidade dos itens
- Aplicar desconto em R$ ou %
- Informar cliente (opcional)
- Finalizar com método de pagamento
- Calcular troco automático para pagamento em dinheiro

### 📦 Produtos
- Cadastro com Nome, Código e Valor de Venda
- Listagem com busca
- Editar e excluir com confirmação

### 👥 Clientes
- Cadastro com Nome e Endereço
- Listagem com busca
- Editar e excluir com confirmação

### 📊 Relatórios
- Filtro por: Hoje, Semana, Mês, Trimestre, Ano
- KPIs: Nº de vendas, Receita Total, Ticket Médio, Descontos Dados
- Gráfico de barras: receita por dia
- Gráfico de rosca: métodos de pagamento
- Tabela com histórico completo

### 🏥 Diagnóstico Gratuito
- Convite para diagnóstico com a Âncora Consultoria
- Link direto: https://meetings.hubspot.com/ancora-consultoria

### ⚙️ Admin
- Nome da empresa, CNPJ/CPF, Telefone, Endereço
- Mensagem personalizada para cupom
- Atualiza o nome da empresa no topo do sistema

---

## 💾 Dados
Todos os dados são armazenados no **localStorage** do navegador/Electron.
Chaves utilizadas:
- `ancora_produtos`
- `ancora_clientes`
- `ancora_vendas`
- `ancora_empresa`

---

## 🖥️ Electron
Para empacotar com Electron, crie um `main.js` simples apontando para `index.html`.
Todos os arquivos já são locais (sem dependências de CDN).

---

## 🎨 Imagem de Splash
O arquivo `img/splash-bg.svg` é um fundo vetorial gerado automaticamente.
Você pode substituí-lo por qualquer imagem `.jpg` ou `.png` atualizando a linha no `css/style.css`:

```css
background: url('../img/splash-bg.jpg') center/cover no-repeat, var(--navy);
```

---

Desenvolvido com ❤️ pela **Âncora Consultoria Financeira**
