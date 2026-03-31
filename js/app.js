/* ═══════════════════════════════════════════════════════════
   CONTROLE DE CAIXA ÂNCORA — app.js v2
═══════════════════════════════════════════════════════════ */

// ─────────────── STATE ───────────────
let produtos = JSON.parse(localStorage.getItem('ancora_produtos')) || [];
let clientes = JSON.parse(localStorage.getItem('ancora_clientes')) || [];
let vendas   = JSON.parse(localStorage.getItem('ancora_vendas'))   || [];
let empresa  = JSON.parse(localStorage.getItem('ancora_empresa'))  || null;

// Venda em andamento
let vendaAtual = { itens: [], pagamentos: [] };

// Produto selecionado no dropdown
let produtoSelecionado = null;
// Produto pendente de peso
let produtoPesoTemp    = null;
// Campo que estava ativo antes de abrir dropdown/modal
let lastFocusId        = 'busca-produto';

// Relatórios
let chartVendas     = null;
let chartPagamentos = null;
let periodoAtivo    = 'dia';

// PIN
let pinCallback = null;

// Primeiro acesso e modal diagnóstico
let primeiroAcesso = false;

// ─────────────── INIT ───────────────
document.addEventListener('DOMContentLoaded', () => {
  atualizarDataTopbar();
  setInterval(atualizarDataTopbar, 60000);

  if (!empresa) {
    // Primeiro acesso: força abrir Admin sem botão fechar
    primeiroAcesso = true;
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('app').classList.remove('d-none');
    abrirAdminPrimeiroAcesso();
  }
  // PIN status label
  atualizarPinStatusLabel();
});

function atualizarDataTopbar() {
  const el = document.getElementById('topbar-date');
  if (el) el.textContent = new Date().toLocaleDateString('pt-BR',
    { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function atualizarTopbarEmpresa() {
  document.getElementById('topbar-company-name').textContent = empresa?.nome || 'Minha Empresa';
}

// ─────────────── SPLASH ───────────────
function closeSplash() {
  const splash = document.getElementById('splash-screen');
  splash.style.transition = 'opacity 0.6s ease';
  splash.style.opacity = '0';
  setTimeout(() => {
    splash.classList.add('d-none');
    document.getElementById('app').classList.remove('d-none');
    atualizarTopbarEmpresa();
    renderSelectClientes();
    iniciarApp();
  }, 600);
}

function iniciarApp() {
  // Modal diagnóstico uma vez por sessão (apenas se empresa já cadastrada)
  if (empresa && !sessionStorage.getItem('diag_shown')) {
    sessionStorage.setItem('diag_shown', '1');
    setTimeout(() => openModal('modal-diag-popup'), 1200);
  }
}

// ─────────────── TABS ───────────────
function switchTab(tab) {
  // Bloquear relatórios se PIN configurado
  if (tab === 'relatorios' && empresa?.bloquearRel && empresa?.pin) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-relatorios').classList.add('active');
    document.getElementById('tab-content-relatorios').classList.add('active');
    mostrarBloqueioRelatorio();
    return;
  }

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('tab-content-' + tab).classList.add('active');

  if (tab === 'relatorios') renderRelatorios();
  if (tab === 'produtos')   renderProdutos();
  if (tab === 'clientes')   renderClientes();
}

function mostrarBloqueioRelatorio() {
  document.getElementById('relatorio-bloqueado').classList.remove('d-none');
  document.getElementById('relatorio-conteudo').style.display = 'none';
  setTimeout(() => document.getElementById('pin-relatorio-input')?.focus(), 100);
}

function verificarPinRelatorio() {
  const val = document.getElementById('pin-relatorio-input').value;
  if (val === empresa.pin) {
    document.getElementById('relatorio-bloqueado').classList.add('d-none');
    document.getElementById('relatorio-conteudo').style.display = '';
    document.getElementById('pin-relatorio-input').value = '';
    renderRelatorios();
  } else {
    toast('PIN incorreto.', true);
    document.getElementById('pin-relatorio-input').value = '';
    document.getElementById('pin-relatorio-input').focus();
  }
}

// ─────────────── ADMIN ───────────────
let adminEhPrimeiroAcesso = false;

function abrirAdminPrimeiroAcesso() {
  adminEhPrimeiroAcesso = true;
  // Esconde botão fechar
  preencherAdmin();
  document.getElementById('pin-status-label').textContent = '(crie um PIN)';
  openModal('modal-admin');
}

function openAdmin() {
  adminEhPrimeiroAcesso = false;
  preencherAdmin();
  openModal('modal-admin');
}

function preencherAdmin() {
  document.getElementById('admin-nome').value      = empresa?.nome      || '';
  document.getElementById('admin-cnpj').value      = empresa?.cnpj      || '';
  document.getElementById('admin-telefone').value  = empresa?.telefone  || '';
  document.getElementById('admin-endereco').value  = empresa?.endereco  || '';
  document.getElementById('admin-cupom-msg').value = empresa?.cupomMsg  || 'Obrigado pela preferência!';
  document.getElementById('admin-pin-atual').value = '';
  document.getElementById('admin-pin-novo').value  = '';
  document.getElementById('admin-pin-conf').value  = '';
  document.getElementById('admin-bloquear-rel').checked = empresa?.bloquearRel || false;
  atualizarPinStatusLabel();
}

function atualizarPinStatusLabel() {
  const label = document.getElementById('pin-status-label');
  if (!label) return;
  label.textContent = empresa?.pin ? '(PIN ✓)' : '(Sem PIN)';
  label.style.color = empresa?.pin ? 'var(--green-light)' : 'var(--text-muted)';
}

function tentarFecharAdmin() {
  if (adminEhPrimeiroAcesso) {
    toast('Configure a empresa antes de continuar.', true);
    return;
  }
  closeModal('modal-admin');
}

function salvarAdmin() {
  const nome = document.getElementById('admin-nome').value.trim();
  if (!nome) { toast('Informe o nome da empresa.', true); return; }

  const pinAtual = document.getElementById('admin-pin-atual').value;
  const pinNovo  = document.getElementById('admin-pin-novo').value;
  const pinConf  = document.getElementById('admin-pin-conf').value;

  // Validação de PIN
  let novoPin = empresa?.pin || '';

  if (pinNovo || pinConf) {
    // Se já tem PIN, exige o atual
    if (empresa?.pin && pinAtual !== empresa.pin) {
      toast('PIN atual incorreto.', true); return;
    }
    if (pinNovo.length < 4) { toast('PIN deve ter ao menos 4 dígitos.', true); return; }
    if (pinNovo !== pinConf) { toast('Os PINs não conferem.', true); return; }
    novoPin = pinNovo;
  } else if (adminEhPrimeiroAcesso && !novoPin) {
    // No primeiro acesso, PIN é obrigatório
    toast('Crie um PIN de segurança para continuar.', true); return;
  }

  empresa = {
    nome,
    cnpj:       document.getElementById('admin-cnpj').value.trim(),
    telefone:   document.getElementById('admin-telefone').value.trim(),
    endereco:   document.getElementById('admin-endereco').value.trim(),
    cupomMsg:   document.getElementById('admin-cupom-msg').value.trim(),
    pin:        novoPin,
    bloquearRel: document.getElementById('admin-bloquear-rel').checked
  };

  saveData('ancora_empresa', empresa);
  atualizarTopbarEmpresa();
  renderSelectClientes();
  atualizarPinStatusLabel();
  closeModal('modal-admin');

  if (adminEhPrimeiroAcesso) {
    adminEhPrimeiroAcesso = false;
    toast('Empresa configurada! Bem-vindo ao Controle de Caixa Âncora!');
    iniciarApp();
  } else {
    toast('Configurações salvas!');
  }
}

// ─────────────── MODALS ───────────────
function openModal(id)  { document.getElementById(id).classList.remove('d-none'); }
function closeModal(id) { document.getElementById(id).classList.add('d-none'); }

// ─────────────── PIN GENÉRICO ───────────────
function solicitarPin(titulo, msg, cb) {
  if (!empresa?.pin) { cb(); return; } // sem PIN configurado, executa direto
  document.getElementById('pin-modal-title').innerHTML = `<i class="bi bi-shield-lock me-2"></i>${titulo}`;
  document.getElementById('pin-modal-msg').textContent = msg;
  document.getElementById('pin-input-modal').value = '';
  pinCallback = cb;
  openModal('modal-pin');
  setTimeout(() => document.getElementById('pin-input-modal')?.focus(), 100);
}

function confirmarPin() {
  const val = document.getElementById('pin-input-modal').value;
  if (val === empresa.pin) {
    closeModal('modal-pin');
    if (pinCallback) { pinCallback(); pinCallback = null; }
  } else {
    toast('PIN incorreto.', true);
    document.getElementById('pin-input-modal').value = '';
    document.getElementById('pin-input-modal').focus();
  }
}

function cancelarPin() {
  pinCallback = null;
  closeModal('modal-pin');
}

// ─────────────── TOAST ───────────────
function toast(msg, isError = false) {
  const el    = document.getElementById('toast-ancora');
  const icon  = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-msg');
  msgEl.textContent = msg;
  el.classList.remove('d-none', 'toast-error');
  icon.className = isError ? 'bi bi-x-circle-fill me-2' : 'bi bi-check-circle-fill me-2';
  if (isError) el.classList.add('toast-error');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('d-none'), 3200);
}

// ─────────────── STORAGE ───────────────
function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }

// ─────────────── HELPERS ───────────────
function formatMoeda(v) {
  return 'R$ ' + (+v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function formatData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function labelPag(p) {
  return { dinheiro:'Dinheiro', credito:'Crédito', debito:'Débito', pix:'PIX', boleto:'Boleto', outro:'Outro' }[p] || p;
}
function mascaraTelefone(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 2)       el.value = v;
  else if (v.length <= 3)  el.value = v.slice(0,2) + ' ' + v.slice(2);
  else if (v.length <= 8)  el.value = v.slice(0,2) + ' ' + v.slice(2,3) + ' ' + v.slice(3);
  else                     el.value = v.slice(0,2) + ' ' + v.slice(2,3) + ' ' + v.slice(3,7) + '-' + v.slice(7);
}

// ─────────────── PRODUTOS CRUD ───────────────
function toggleHintUnidade() {
  const un = document.getElementById('prod-unidade').value;
  document.getElementById('prod-unidade-hint').classList.toggle('d-none', un !== 'kg');
}

function openModalProduto(id = null) {
  document.getElementById('prod-edit-id').value = id || '';
  document.getElementById('modal-produto-title').textContent = id ? 'Editar Produto' : 'Novo Produto';
  if (id) {
    const p = produtos.find(x => x.id === id);
    document.getElementById('prod-codigo').value   = p.codigo   || '';
    document.getElementById('prod-nome').value     = p.nome;
    document.getElementById('prod-valor').value    = p.valor;
    document.getElementById('prod-unidade').value  = p.unidade  || 'un';
    document.getElementById('prod-estoque').value  = p.estoque  != null ? p.estoque : '';
    document.getElementById('prod-alerta').value   = p.alertaQtd != null ? p.alertaQtd : '';
  } else {
    document.getElementById('prod-codigo').value   = '';
    document.getElementById('prod-nome').value     = '';
    document.getElementById('prod-valor').value    = '';
    document.getElementById('prod-unidade').value  = 'un';
    document.getElementById('prod-estoque').value  = '';
    document.getElementById('prod-alerta').value   = '';
  }
  document.getElementById('prod-unidade-hint').classList.add('d-none');
  openModal('modal-produto');
}

function salvarProduto() {
  const id        = document.getElementById('prod-edit-id').value;
  const nome      = document.getElementById('prod-nome').value.trim();
  const valor     = parseFloat(document.getElementById('prod-valor').value);
  const codigo    = document.getElementById('prod-codigo').value.trim();
  const unidade   = document.getElementById('prod-unidade').value;
  const estoqueRaw = document.getElementById('prod-estoque').value;
  const alertaRaw  = document.getElementById('prod-alerta').value;
  const estoque    = estoqueRaw !== '' ? parseFloat(estoqueRaw) : null;
  const alertaQtd  = alertaRaw  !== '' ? parseFloat(alertaRaw)  : null;

  if (!nome)              { toast('Informe o nome do produto.', true); return; }
  if (isNaN(valor)||valor<0) { toast('Informe um valor válido.', true); return; }

  if (id) {
    const idx = produtos.findIndex(x => x.id === id);
    // Preserve existing estoque if not changed (when editing, keep running stock unless a new value was entered)
    const estoqueAtual = estoqueRaw !== '' ? estoque : produtos[idx].estoque;
    produtos[idx] = { ...produtos[idx], nome, valor, codigo, unidade, estoque: estoqueAtual, alertaQtd };
  } else {
    produtos.push({ id: genId(), nome, valor, codigo, unidade, estoque, alertaQtd });
  }
  saveData('ancora_produtos', produtos);
  renderProdutos();
  closeModal('modal-produto');
  toast(id ? 'Produto atualizado!' : 'Produto cadastrado!');
}

function excluirProduto(id) {
  solicitarPin('Excluir Produto', 'Confirme o PIN para excluir este produto.', () => {
    produtos = produtos.filter(x => x.id !== id);
    saveData('ancora_produtos', produtos);
    renderProdutos();
    toast('Produto excluído.');
  });
}

function renderProdutos() {
  const busca = (document.getElementById('busca-prod-lista')?.value || '').toLowerCase();
  const tbody = document.getElementById('produtos-tbody');
  const lista = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca) || (p.codigo||'').toLowerCase().includes(busca)
  );
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">
      <i class="bi bi-box-seam fs-3 d-block mb-2"></i>Nenhum produto cadastrado</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(p => {
    const temEstoque   = p.estoque != null;
    const emAlerta     = temEstoque && p.alertaQtd != null && p.estoque <= p.alertaQtd;
    const alertaClass  = emAlerta ? 'produto-alerta' : '';
    const estoqueHtml  = temEstoque
      ? `<span class="badge-estoque ${emAlerta ? 'badge-estoque-alerta' : ''}" title="${emAlerta ? '⚠️ Estoque baixo!' : 'Estoque disponível'}">
           ${emAlerta ? '<i class="bi bi-exclamation-triangle-fill me-1"></i>' : ''}${p.estoque}
         </span>`
      : `<span style="color:var(--text-muted);font-size:0.75rem">—</span>`;
    return `<tr class="${alertaClass}">
      <td><span style="color:var(--text-muted);font-size:0.8rem">${p.codigo||'—'}</span></td>
      <td>
        ${emAlerta ? '<i class="bi bi-exclamation-triangle-fill me-1" style="color:#ff6b35" title="Estoque baixo!"></i>' : ''}
        ${p.nome}
        ${emAlerta ? `<span class="badge-alerta-label">Estoque baixo!</span>` : ''}
      </td>
      <td class="text-center">
        <span class="badge-unidade badge-${p.unidade||'un'}">${(p.unidade||'un').toUpperCase()}</span>
      </td>
      <td class="text-end">
        <strong style="color:var(--gold)">${formatMoeda(p.valor)}</strong>
        ${p.unidade==='kg'?'<span style="color:var(--text-muted);font-size:0.75rem">/kg</span>':''}
      </td>
      <td class="text-center">${estoqueHtml}</td>
      <td class="text-center">
        <button class="btn-table-edit" onclick="openModalProduto('${p.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-table-del"  onclick="excluirProduto('${p.id}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

// ─────────────── CLIENTES CRUD ───────────────
function openModalCliente(id = null) {
  document.getElementById('cli-edit-id').value = id || '';
  document.getElementById('modal-cliente-title').textContent = id ? 'Editar Cliente' : 'Novo Cliente';
  if (id) {
    const c = clientes.find(x => x.id === id);
    document.getElementById('cli-nome').value     = c.nome;
    document.getElementById('cli-telefone').value = c.telefone || '';
    document.getElementById('cli-endereco').value = c.endereco || '';
  } else {
    document.getElementById('cli-nome').value     = '';
    document.getElementById('cli-telefone').value = '';
    document.getElementById('cli-endereco').value = '';
  }
  openModal('modal-cliente');
}

function salvarCliente() {
  const id       = document.getElementById('cli-edit-id').value;
  const nome     = document.getElementById('cli-nome').value.trim();
  const telefone = document.getElementById('cli-telefone').value.trim();
  const endereco = document.getElementById('cli-endereco').value.trim();

  if (!nome) { toast('Informe o nome do cliente.', true); return; }

  if (id) {
    const idx = clientes.findIndex(x => x.id === id);
    clientes[idx] = { ...clientes[idx], nome, telefone, endereco };
  } else {
    clientes.push({ id: genId(), nome, telefone, endereco });
  }
  saveData('ancora_clientes', clientes);
  renderClientes();
  renderSelectClientes();
  closeModal('modal-cliente');
  toast(id ? 'Cliente atualizado!' : 'Cliente cadastrado!');
}

function excluirCliente(id) {
  solicitarPin('Excluir Cliente', 'Confirme o PIN para excluir este cliente.', () => {
    clientes = clientes.filter(x => x.id !== id);
    saveData('ancora_clientes', clientes);
    renderClientes();
    renderSelectClientes();
    toast('Cliente excluído.');
  });
}

function renderClientes() {
  const busca = (document.getElementById('busca-cliente-lista')?.value || '').toLowerCase();
  const tbody = document.getElementById('clientes-tbody');
  const lista = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca) ||
    (c.telefone||'').includes(busca) ||
    (c.endereco||'').toLowerCase().includes(busca)
  );
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">
      <i class="bi bi-people fs-3 d-block mb-2"></i>Nenhum cliente cadastrado</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><strong>${c.nome}</strong></td>
      <td>${c.telefone ? `<a href="tel:${c.telefone}" style="color:var(--gold);text-decoration:none">${c.telefone}</a>` : '—'}</td>
      <td style="color:var(--text-muted)">${c.endereco||'—'}</td>
      <td class="text-center">
        <button class="btn-table-edit" onclick="openModalCliente('${c.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-table-del"  onclick="excluirCliente('${c.id}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function renderSelectClientes() {
  const sel = document.getElementById('venda-cliente');
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">— Consumidor Final —</option>' +
    clientes.map(c => `<option value="${c.id}" ${c.id===atual?'selected':''}>${c.nome}</option>`).join('');
}

// ─────────────── VENDAS — TECLADO ───────────────
function onKeyBusca(e) {
  lastFocusId = 'busca-produto';
  if (e.key === 'Enter') {
    e.preventDefault();
    if (produtoSelecionado) adicionarProdutoVenda();
    else {
      // Tenta selecionar primeiro do dropdown
      const first = document.querySelector('.produto-dropdown-item');
      if (first) first.click();
    }
  }
  if (e.key === 'Escape') limparBuscaProduto();
}

function onKeyQtd(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (produtoSelecionado) adicionarProdutoVenda();
  }
}

function onKeyAvulso(e) {
  lastFocusId = e.target.id;
  if (e.key === 'Enter') {
    e.preventDefault();
    adicionarAvulso();
  }
}

// ─────────────── VENDAS — PRODUTOS ───────────────
function filtrarProdutos() {
  lastFocusId = 'busca-produto';
  const termo = document.getElementById('busca-produto').value.toLowerCase().trim();
  const drop  = document.getElementById('dropdown-produtos');
  produtoSelecionado = null;
  if (!termo) { drop.classList.add('d-none'); return; }

  const lista = produtos.filter(p =>
    p.nome.toLowerCase().includes(termo) || (p.codigo||'').toLowerCase().includes(termo)
  ).slice(0, 8);

  if (!lista.length) { drop.classList.add('d-none'); return; }

  drop.innerHTML = lista.map((p, i) => `
    <div class="produto-dropdown-item" data-idx="${i}" onclick="selecionarProdutoVenda('${p.id}')">
      <span>${p.nome} ${p.codigo?'<span class="cod">#'+p.codigo+'</span>':''} ${p.unidade==='kg'?'<span class="badge-unidade badge-kg" style="font-size:0.65rem">KG</span>':''}</span>
      <span class="preco">${formatMoeda(p.valor)}${p.unidade==='kg'?'/kg':''}</span>
    </div>
  `).join('');
  drop.classList.remove('d-none');
}

function selecionarProdutoVenda(id) {
  produtoSelecionado = produtos.find(p => p.id === id);
  document.getElementById('busca-produto').value = produtoSelecionado.nome;
  document.getElementById('dropdown-produtos').classList.add('d-none');
  
  const qtdInput = document.getElementById('venda-qtd');
  
  if (produtoSelecionado.unidade === 'kg') {
    qtdInput.value = '';
    qtdInput.disabled = true; // Trava o campo para evitar digitação inútil
  } else {
    qtdInput.disabled = false;
    qtdInput.value = 1;
    qtdInput.focus();
  }
}

function limparBuscaProduto() {
  document.getElementById('busca-produto').value = '';
  document.getElementById('dropdown-produtos').classList.add('d-none');
  produtoSelecionado = null;
  // Sempre destrava a quantidade ao resetar a busca
  document.getElementById('venda-qtd').disabled = false; 
}

function adicionarProdutoVenda() {
  if (!produtoSelecionado) { toast('Selecione um produto da lista.', true); return; }
  const qtd = parseFloat(document.getElementById('venda-qtd').value) || 1;

  if (produtoSelecionado.unidade === 'kg') {
    // Abre modal de peso
    produtoPesoTemp = { ...produtoSelecionado };
    document.getElementById('modal-peso-desc').textContent =
      `${produtoPesoTemp.nome} — ${formatMoeda(produtoPesoTemp.valor)}/kg`;
    document.getElementById('modal-peso-valor').value = '';
    document.getElementById('peso-preco-preview').classList.add('d-none');
    openModal('modal-peso');
    setTimeout(() => document.getElementById('modal-peso-valor')?.focus(), 100);
    return;
  }

  inserirItemVenda({
    id: genId(), prodId: produtoSelecionado.id,
    desc: produtoSelecionado.nome, valor: produtoSelecionado.valor,
    qtd, unidade: 'un'
  });
  limparBuscaProduto();
  document.getElementById('venda-qtd').value = 1;
  // Retorna foco
  setTimeout(() => document.getElementById('busca-produto')?.focus(), 50);
}

function previewPeso() {
  if (!produtoPesoTemp) return;
  const kg = parseFloat(document.getElementById('modal-peso-valor').value) || 0;
  const prev = document.getElementById('peso-preco-preview');
  if (kg > 0) {
    document.getElementById('peso-preco-val').textContent = formatMoeda(produtoPesoTemp.valor * kg);
    prev.classList.remove('d-none');
  } else {
    prev.classList.add('d-none');
  }
}

function confirmarPeso() {
  const kg = parseFloat(document.getElementById('modal-peso-valor').value);
  if (!kg || kg <= 0) { toast('Informe um peso válido.', true); return; }
  if (!produtoPesoTemp) return;

  inserirItemVenda({
    id: genId(), prodId: produtoPesoTemp.id,
    desc: `${produtoPesoTemp.nome} (${kg.toFixed(3)} kg)`,
    valor: produtoPesoTemp.valor * kg,
    qtd: 1, unidade: 'kg', peso: kg, valorKg: produtoPesoTemp.valor
  });

  closeModal('modal-peso');
  limparBuscaProduto();
  document.getElementById('venda-qtd').value = 1;
  produtoPesoTemp = null;
  setTimeout(() => document.getElementById('busca-produto')?.focus(), 50);
}

function adicionarAvulso() {
  const desc  = document.getElementById('avulso-desc').value.trim();
  const valor = parseFloat(document.getElementById('avulso-valor').value);

  if (isNaN(valor) || valor <= 0) { toast('Informe um valor válido.', true); return; }

  inserirItemVenda({
    id: genId(), prodId: null,
    desc: desc || 'Avulso', valor, qtd: 1, unidade: 'un'
  });

  document.getElementById('avulso-desc').value  = '';
  document.getElementById('avulso-valor').value = '';
  // Retorna foco ao campo que estava ativo
  setTimeout(() => document.getElementById(lastFocusId)?.focus(), 50);
}

function inserirItemVenda(item) {
  // Para itens por unidade, agrega se já existe o mesmo produto
  if (item.prodId && item.unidade !== 'kg') {
    const existente = vendaAtual.itens.find(i => i.prodId === item.prodId && i.unidade !== 'kg');
    if (existente) { existente.qtd += item.qtd; renderItensVenda(); calcularTotais(); return; }
  }
  vendaAtual.itens.push(item);
  renderItensVenda();
  calcularTotais();
}

function removerItem(id) {
  vendaAtual.itens = vendaAtual.itens.filter(i => i.id !== id);
  renderItensVenda();
  calcularTotais();
}

function alterarQtd(id, val) {
  const item = vendaAtual.itens.find(i => i.id === id);
  if (item) { item.qtd = Math.max(0.001, parseFloat(val) || 1); calcularTotais(); }
}

function renderItensVenda() {
  const tbody = document.getElementById('venda-itens-tbody');
  if (!vendaAtual.itens.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">
      <i class="bi bi-cart-x fs-3 d-block mb-2"></i>Nenhum item adicionado</td></tr>`;
    return;
  }
  tbody.innerHTML = vendaAtual.itens.map(item => {
    const isKg = item.unidade === 'kg';
    const qtdDisplay = isKg
      ? `<span style="font-size:0.8rem;color:var(--text-muted)">${item.peso?.toFixed(3)||'?'} kg</span>`
      : `<input type="number" value="${item.qtd}" min="1" step="1"
          style="width:58px;background:var(--input-bg);border:1px solid var(--border);color:var(--text);border-radius:5px;padding:3px 6px;text-align:center"
          onchange="alterarQtd('${item.id}',this.value)" />`;
    return `<tr>
      <td>${item.desc}</td>
      <td class="text-center">${qtdDisplay}</td>
      <td class="text-end">${isKg?'<span style="font-size:0.75rem;color:var(--text-muted)">'+formatMoeda(item.valorKg||0)+'/kg</span>':formatMoeda(item.valor)}</td>
      <td class="text-end"><strong>${formatMoeda(isKg ? item.valor : item.valor*item.qtd)}</strong></td>
      <td class="text-center"><button class="btn-item-del" onclick="removerItem('${item.id}')"><i class="bi bi-x-circle"></i></button></td>
    </tr>`;
  }).join('');
}

// ─────────────── VENDAS — TOTAIS ───────────────
function calcularTotais() {
  const subtotal = vendaAtual.itens.reduce((s, i) => {
    return s + (i.unidade === 'kg' ? i.valor : i.valor * i.qtd);
  }, 0);

  const desVal  = parseFloat(document.getElementById('venda-desconto-valor').value) || 0;
  const desTipo = document.getElementById('venda-desconto-tipo').value;
  const desconto = desTipo === '%' ? subtotal * (desVal/100) : Math.min(desVal, subtotal);
  const total = Math.max(0, subtotal - desconto);

  document.getElementById('resumo-subtotal').textContent = formatMoeda(subtotal);
  document.getElementById('resumo-desconto').textContent = '- ' + formatMoeda(desconto);
  document.getElementById('resumo-total').textContent    = formatMoeda(total);

  vendaAtual._subtotal = subtotal;
  vendaAtual._desconto = desconto;
  vendaAtual._total    = total;

  atualizarResumoPagamentos();
}

// ─────────────── VENDAS — PAGAMENTOS MÚLTIPLOS ───────────────
function inicializarPagamentos() {
  vendaAtual.pagamentos = [{ id: genId(), metodo: 'dinheiro', valor: '' }];
  renderPagamentos();
}

function adicionarFormaPagamento() {
  const total = vendaAtual._total || 0;
  const totalPago = vendaAtual.pagamentos.reduce((s, p) => s + (parseFloat(p.valor)||0), 0);
  let restante = total - totalPago;

  // Sugere automaticamente o valor que falta, economizando digitação
  let valorSugerido = restante > 0 ? restante.toFixed(2) : '';

  vendaAtual.pagamentos.push({ id: genId(), metodo: 'pix', valor: valorSugerido });
  renderPagamentos();
}

function removerPagamento(id) {
  if (vendaAtual.pagamentos.length <= 1) return;
  vendaAtual.pagamentos = vendaAtual.pagamentos.filter(p => p.id !== id);
  renderPagamentos();
}

function renderPagamentos() {
  const lista = document.getElementById('pagamentos-lista');
  lista.innerHTML = vendaAtual.pagamentos.map((p, idx) => `
    <div class="pagamento-row" id="prow-${p.id}">
      <select class="form-control-ancora" style="flex:1.4" onchange="mudarMetodoPag('${p.id}', this.value)">
        ${['dinheiro','credito','debito','pix','boleto','outro'].map(m =>
          `<option value="${m}" ${p.metodo===m?'selected':''}>${labelPag(m)}</option>`
        ).join('')}
      </select>
      <input type="number" class="form-control-ancora" style="flex:1" placeholder="Valor Recebido R$"
        value="${p.valor}" min="0" step="0.01"
        onchange="mudarValorPag('${p.id}', this.value)"
        oninput="mudarValorPag('${p.id}', this.value)" />
      ${vendaAtual.pagamentos.length > 1
        ? `<button class="btn-item-del" onclick="removerPagamento('${p.id}')"><i class="bi bi-x-circle"></i></button>`
        : '<div style="width:28px"></div>'}
    </div>
  `).join('');
  atualizarResumoPagamentos();
}

function mudarMetodoPag(id, metodo) {
  const p = vendaAtual.pagamentos.find(x => x.id === id);
  if (p) { p.metodo = metodo; renderPagamentos(); }
}

function mudarValorPag(id, val) {
  const p = vendaAtual.pagamentos.find(x => x.id === id);
  if (p) { p.valor = parseFloat(val) || 0; atualizarResumoPagamentos(); }
}



function atualizarResumoPagamentos() {
  const totalPago = vendaAtual.pagamentos.reduce((s, p) => s + (parseFloat(p.valor)||0), 0);
  const total     = vendaAtual._total || 0;
  const restante  = total - totalPago;

  const wrap = document.getElementById('resumo-pagamentos');
  if (totalPago > 0 || vendaAtual.pagamentos.length > 1) {
    wrap.classList.remove('d-none');
    
    // Reescrevemos o bloco dinamicamente para focar no que importa
    let html = `<div class="resumo-linha"><span>Total Recebido</span><span style="color:var(--green-light)">${formatMoeda(totalPago)}</span></div>`;

    if (restante > 0) {
      html += `<div class="resumo-linha"><span>Falta Pagar</span><span style="color:var(--red)">${formatMoeda(restante)}</span></div>`;
    } else if (restante < 0) {
      html += `<div class="resumo-linha"><span>Troco</span><span style="color:var(--gold)">${formatMoeda(Math.abs(restante))}</span></div>`;
    }

    wrap.innerHTML = html;
  } else {
    wrap.classList.add('d-none');
  }
}

function resetVenda() {
  vendaAtual = { itens: [], pagamentos: [] };
  document.getElementById('busca-produto').value        = '';
  document.getElementById('venda-qtd').value            = 1;
  document.getElementById('venda-qtd').disabled         = false; // Garante destravamento
  document.getElementById('avulso-desc').value          = '';
  document.getElementById('avulso-valor').value         = '';
  document.getElementById('venda-desconto-valor').value = '';
  document.getElementById('venda-desconto-tipo').value  = 'R$';
  document.getElementById('venda-cliente').value        = '';
  produtoSelecionado = null;
  renderItensVenda();
  calcularTotais();
  inicializarPagamentos();
  setTimeout(() => document.getElementById('busca-produto')?.focus(), 100);
}

// ─────────────── FINALIZAR VENDA ───────────────
function finalizarVenda() {
  if (!vendaAtual.itens.length) { toast('Adicione ao menos um item.', true); return; }

  const total     = vendaAtual._total || 0;
  const totalPago = vendaAtual.pagamentos.reduce((s, p) => s + (parseFloat(p.valor)||0), 0);

  if (totalPago < total - 0.005) {
    toast(`Pagamento insuficiente! Faltam ${formatMoeda(total - totalPago)}.`, true); return;
  }

  const clienteId   = document.getElementById('venda-cliente').value;
  const clienteNome = clienteId
    ? (clientes.find(c => c.id === clienteId)?.nome || 'Consumidor Final')
    : 'Consumidor Final';

  let trocoRestante = totalPago - total;
  
  const pagamentosFinais = vendaAtual.pagamentos.map(p => {
    const valorInformado = parseFloat(p.valor)||0;
    let troco = 0;
    // Tenta alocar o troco fisicamente contra um pagamento em dinheiro, se houver
    if (trocoRestante > 0 && p.metodo === 'dinheiro') {
      troco = Math.min(valorInformado, trocoRestante);
      trocoRestante -= troco;
    }
    return { metodo: p.metodo, valor: valorInformado, troco };
  });

  // Se por acaso houve troco usando só cartão/pix (excepcional), joga no primeiro
  if (trocoRestante > 0 && pagamentosFinais.length > 0) {
    pagamentosFinais[0].troco += trocoRestante;
  }

  const venda = {
    id: genId(),
    data: new Date().toISOString(),
    itens: [...vendaAtual.itens],
    subtotal:  vendaAtual._subtotal,
    desconto:  vendaAtual._desconto,
    total,
    pagamentos: pagamentosFinais,
    pagamento: pagamentosFinais.length === 1 ? pagamentosFinais[0].metodo : 'multiplo',
    clienteId,
    clienteNome
  };

  vendas.push(venda);
  saveData('ancora_vendas', vendas);

  // Subtrai estoque dos produtos vendidos
  let estoqueAtualizado = false;
  venda.itens.forEach(item => {
    if (!item.prodId) return;
    const prod = produtos.find(p => p.id === item.prodId);
    if (prod && prod.estoque != null) {
      const qtdSubtrair = item.unidade === 'kg' ? (item.peso || 1) : item.qtd;
      prod.estoque = Math.max(0, prod.estoque - qtdSubtrair);
      estoqueAtualizado = true;
    }
  });
  if (estoqueAtualizado) {
    saveData('ancora_produtos', produtos);
    // Se a aba de produtos estiver visível, re-renderiza
    if (document.getElementById('tab-content-produtos').classList.contains('active')) {
      renderProdutos();
    }
  }

  toast(`✅ Venda de ${formatMoeda(total)} finalizada!`);
  resetVenda();
}

// ─────────────── RELATÓRIOS ───────────────
function setPeriodo(periodo) {
  periodoAtivo = periodo;
  document.querySelectorAll('.btn-periodo').forEach(b => b.classList.remove('active'));
  document.getElementById('periodo-' + periodo).classList.add('active');
  renderRelatorios();
}

function getDataInicio(periodo) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  if (periodo === 'dia')       return hoje;
  if (periodo === 'semana')    { const d = new Date(hoje); d.setDate(d.getDate()-d.getDay()); return d; }
  if (periodo === 'mes')       return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  if (periodo === 'trimestre') return new Date(hoje.getFullYear(), Math.floor(hoje.getMonth()/3)*3, 1);
  if (periodo === 'ano')       return new Date(hoje.getFullYear(), 0, 1);
  return hoje;
}

function renderRelatorios() {
  const inicio    = getDataInicio(periodoAtivo);
  const filtradas = vendas.filter(v => new Date(v.data) >= inicio);

  const totalReceita  = filtradas.reduce((s, v) => s + v.total, 0);
  const totalDesconto = filtradas.reduce((s, v) => s + (v.desconto||0), 0);
  const ticket        = filtradas.length ? totalReceita / filtradas.length : 0;

  document.getElementById('kpi-vendas').textContent   = filtradas.length;
  document.getElementById('kpi-receita').textContent  = formatMoeda(totalReceita);
  document.getElementById('kpi-ticket').textContent   = formatMoeda(ticket);
  document.getElementById('kpi-desconto').textContent = formatMoeda(totalDesconto);

  renderRanking(filtradas);
  renderTabelaHistorico(filtradas);
  renderCharts(filtradas);
}

function renderRanking(filtradas) {
  const tbody = document.getElementById('ranking-tbody');
  const mapa  = {};
  filtradas.forEach(v => {
    const key  = v.clienteId || '__cf__';
    const nome = v.clienteNome || 'Consumidor Final';
    if (!mapa[key]) mapa[key] = { nome, total: 0, qtd: 0 };
    mapa[key].total += v.total;
    mapa[key].qtd++;
  });

  const ranking = Object.values(mapa)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (!ranking.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Nenhuma venda no período</td></tr>`;
    return;
  }

  const medalhas = ['🥇','🥈','🥉'];
  tbody.innerHTML = ranking.map((r, i) => `
    <tr>
      <td>
        <span style="font-size:1.1rem">${medalhas[i] || (i+1)}</span>
      </td>
      <td><strong>${r.nome}</strong></td>
      <td class="text-center"><span class="badge-pag badge-pix">${r.qtd} compra${r.qtd!==1?'s':''}</span></td>
      <td class="text-end"><strong style="color:var(--gold)">${formatMoeda(r.total)}</strong></td>
      <td class="text-end" style="color:var(--text-muted)">${formatMoeda(r.total/r.qtd)}</td>
    </tr>
  `).join('');
}

function renderTabelaHistorico(filtradas) {
  const tbody = document.getElementById('relatorio-tbody');
  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">
      <i class="bi bi-inbox fs-3 d-block mb-2"></i>Nenhuma venda no período</td></tr>`;
    return;
  }

  tbody.innerHTML = [...filtradas].reverse().map(v => {
    const pags = v.pagamentos
      ? v.pagamentos.map(p => `<span class="badge-pag badge-${p.metodo}">${labelPag(p.metodo)}</span>`).join(' ')
      : `<span class="badge-pag badge-${v.pagamento}">${labelPag(v.pagamento)}</span>`;
    return `<tr>
      <td style="white-space:nowrap;font-size:0.82rem">${formatData(v.data)}</td>
      <td>${v.clienteNome}</td>
      <td style="color:var(--text-muted);font-size:0.78rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${v.itens.map(i=>i.desc).join(', ')}</td>
      <td>${pags}</td>
      <td class="text-end" style="color:var(--red)">${v.desconto>0?'- '+formatMoeda(v.desconto):'—'}</td>
      <td class="text-end"><strong style="color:var(--gold)">${formatMoeda(v.total)}</strong></td>
      <td class="text-center">
        <button class="btn-table-del" title="Excluir venda" onclick="excluirVenda('${v.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function excluirVenda(id) {
  solicitarPin('Excluir Venda', 'Confirme o PIN para excluir esta transação do histórico.', () => {
    vendas = vendas.filter(v => v.id !== id);
    saveData('ancora_vendas', vendas);
    renderRelatorios();
    toast('Venda excluída do histórico.');
  });
}

function renderCharts(filtradas) {
  const ctx1 = document.getElementById('chart-vendas')?.getContext('2d');
  const ctx2 = document.getElementById('chart-pagamentos')?.getContext('2d');
  if (!ctx1 || !ctx2) return;

  const porDia = {};
  filtradas.forEach(v => {
    const dia = new Date(v.data).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
    porDia[dia] = (porDia[dia]||0) + v.total;
  });

  if (chartVendas) chartVendas.destroy();
  chartVendas = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: Object.keys(porDia).length ? Object.keys(porDia) : ['Sem dados'],
      datasets: [{ label: 'Receita (R$)', data: Object.values(porDia).length ? Object.values(porDia) : [0],
        backgroundColor: 'rgba(201,168,76,0.65)', borderColor: '#c9a84c', borderWidth:1, borderRadius:5 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8fa3bb' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#8fa3bb', callback: v => 'R$'+v.toFixed(0) }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  // Métodos: soma de todos os pagamentos (múltiplos)
  const pagCount = {};
  filtradas.forEach(v => {
    if (v.pagamentos) {
      v.pagamentos.forEach(p => { pagCount[p.metodo] = (pagCount[p.metodo]||0) + 1; });
    } else {
      pagCount[v.pagamento] = (pagCount[v.pagamento]||0) + 1;
    }
  });

  if (chartPagamentos) chartPagamentos.destroy();
  chartPagamentos = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: Object.keys(pagCount).length ? Object.keys(pagCount).map(labelPag) : ['Sem dados'],
      datasets: [{
        data: Object.values(pagCount).length ? Object.values(pagCount) : [1],
        backgroundColor: ['#c9a84c','#1a7be0','#5ba4f5','#2dd4bf','#fd7e14','#6c757d'],
        borderColor: '#162336', borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#8fa3bb', font: { size: 11 } } } }
    }
  });
}

function realizarBackup() {
  const dados = {};
  
  // Varre o LocalStorage em busca de todas as chaves do sistema
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('ancora_')) {
      try {
        dados[key] = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        console.error(`Erro ao ler chave ${key} para backup.`, e);
      }
    }
  }

  if (Object.keys(dados).length === 0) {
    alert("Não há dados no sistema para fazer backup.");
    return;
  }

  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dataAtual = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
  
  a.href = url;
  a.download = `backup_sistema_${dataAtual}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function restaurarBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const confirmacao = confirm(
    "ALERTA CRÍTICO: Esta ação APAGARÁ todos os dados atuais do sistema e os substituirá pelo histórico deste arquivo. Você tem certeza absoluta?"
  );

  if (!confirmacao) {
    event.target.value = ''; // Reseta o input caso o usuário cancele
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);
      
      // Validação de segurança para não injetar lixo no LocalStorage
      const keys = Object.keys(dados);
      const hasSystemKeys = keys.some(key => key.startsWith('ancora_'));
      
      if (!hasSystemKeys) {
        throw new Error("Arquivo de backup inválido ou incompatível.");
      }

      // Limpa os dados antigos do sistema antes de injetar os novos para evitar conflitos
      for (let i = localStorage.length - 1; i >= 0; i--) {
         const key = localStorage.key(i);
         if (key.startsWith('ancora_')) localStorage.removeItem(key);
      }

      // Injeta os dados do arquivo
      for (const key of keys) {
        if (key.startsWith('ancora_')) {
          localStorage.setItem(key, JSON.stringify(dados[key]));
        }
      }

      alert("Sistema restaurado com sucesso! A página será recarregada para aplicar as mudanças.");
      location.reload();

    } catch (err) {
      alert("Falha ao restaurar: O arquivo selecionado está corrompido ou não pertence a este sistema.");
      console.error("Erro de restauração:", err);
      event.target.value = '';
    }
  };
  
  reader.readAsText(file);
}

// ─────────────── INFORMAÇÕES DA VENDA — COLLAPSIBLE ───────────────
function toggleInfoVenda() {
  const body    = document.getElementById('info-venda-body');
  const chevron = document.getElementById('info-venda-chevron');
  const isOpen  = body.style.display !== 'none';
  body.style.display    = isOpen ? 'none' : '';
  chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ─────────────── MODAL DE AJUDA ───────────────
const helpContent = {
  itens: {
    titulo: '🛒 Como usar — Itens da Venda',
    html: `
      <p style="color:var(--text-muted);margin-bottom:16px">Esta seção é onde você monta o carrinho da venda. Veja como funciona:</p>
      <div class="help-item"><i class="bi bi-search"></i><div><strong>Buscar Produto</strong><p>Digite o nome ou código do produto. Ele aparecerá numa lista — clique nele ou pressione <kbd>↵ Enter</kbd> para selecionar.</p></div></div>
      <div class="help-item"><i class="bi bi-123"></i><div><strong>Qtd / Peso</strong><p>Informe a quantidade. Para produtos por <strong>Kg</strong>, um modal de peso será aberto automaticamente.</p></div></div>
      <div class="help-item"><i class="bi bi-plus-circle"></i><div><strong>Adicionar</strong><p>Clique em "Adicionar" ou pressione <kbd>↵ Enter</kbd> no campo de quantidade para inserir o item.</p></div></div>
      <div class="help-item"><i class="bi bi-tag"></i><div><strong>Avulso</strong><p>Para itens sem cadastro (ex: serviços), use os campos "Descrição Avulsa" e "Valor R$" e clique em "+ Avulso".</p></div></div>
      <div class="help-item"><i class="bi bi-pencil-square"></i><div><strong>Editar quantidade</strong><p>Na tabela de itens, você pode editar a quantidade diretamente clicando no número na coluna "Qtd".</p></div></div>
    `
  },
  info: {
    titulo: '👤 Como usar — Informações da Venda',
    html: `
      <p style="color:var(--text-muted);margin-bottom:16px">Nesta seção você pode associar a venda a um cliente e aplicar descontos.</p>
      <div class="help-item"><i class="bi bi-person"></i><div><strong>Cliente</strong><p>Selecione um cliente cadastrado para vincular a venda. Deixe em "Consumidor Final" para vendas avulsas sem vínculo.</p></div></div>
      <div class="help-item"><i class="bi bi-percent"></i><div><strong>Desconto</strong><p>Informe um valor de desconto em R$ ou em %. O sistema calculará automaticamente o desconto sobre o subtotal.</p></div></div>
      <div class="help-item"><i class="bi bi-chevron-down"></i><div><strong>Ocultar / Exibir</strong><p>Clique no cabeçalho "Informações da Venda" para ocultar ou expandir esta seção, mantendo a tela mais limpa.</p></div></div>
    `
  },
  resumo: {
    titulo: '📋 Como usar — Resumo',
    html: `
      <p style="color:var(--text-muted);margin-bottom:16px">O Resumo exibe os valores calculados da venda em tempo real.</p>
      <div class="help-item"><i class="bi bi-receipt"></i><div><strong>Subtotal</strong><p>Soma de todos os itens adicionados antes do desconto.</p></div></div>
      <div class="help-item"><i class="bi bi-dash-circle"></i><div><strong>Desconto</strong><p>Valor deduzido conforme configurado em "Informações da Venda". Mostrado em vermelho.</p></div></div>
      <div class="help-item"><i class="bi bi-cash-stack"></i><div><strong>TOTAL</strong><p>Valor final a cobrar do cliente: Subtotal − Desconto. Este é o valor que deve ser pago.</p></div></div>
    `
  },
  pagamento: {
    titulo: '💳 Como usar — Pagamento',
    html: `
      <p style="color:var(--text-muted);margin-bottom:16px">Configure as formas de pagamento aceitas nesta venda.</p>
      <div class="help-item"><i class="bi bi-credit-card"></i><div><strong>Forma de Pagamento</strong><p>Selecione o método: Dinheiro, Crédito, Débito, PIX, Boleto ou Outro. Informe o valor recebido.</p></div></div>
      <div class="help-item"><i class="bi bi-plus-circle"></i><div><strong>+ Forma</strong><p>Para pagamentos mistos (ex: parte em dinheiro, parte no PIX), clique em "+ Forma" para adicionar outra linha.</p></div></div>
      <div class="help-item"><i class="bi bi-arrow-repeat"></i><div><strong>Troco</strong><p>Se o valor recebido em dinheiro for maior que o total, o troco será calculado e exibido automaticamente.</p></div></div>
      <div class="help-item"><i class="bi bi-check-circle"></i><div><strong>Finalizar Venda</strong><p>Clique em "Finalizar Venda" apenas quando todos os pagamentos estiverem registrados. O estoque será atualizado automaticamente.</p></div></div>
    `
  }
};

function openHelpModal(secao) {
  const content = helpContent[secao];
  if (!content) return;
  document.getElementById('modal-ajuda-title').innerHTML =
    `<i class="bi bi-question-circle-fill me-2" style="color:var(--gold)"></i>${content.titulo}`;
  document.getElementById('modal-ajuda-body').innerHTML = content.html;
  openModal('modal-ajuda');
}

// ─────────────── BOOT FINAL ───────────────
// Inicializar pagamentos quando a venda está pronta
document.addEventListener('DOMContentLoaded', () => {
  if (empresa) {
    atualizarTopbarEmpresa();
    renderSelectClientes();
    inicializarPagamentos();
  }
});
