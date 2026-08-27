// V2.4 - preço de compra interno + snapshot no orçamento
(function(){
  const style=document.createElement('style');
  style.textContent='@media print{.purchase-internal{display:none!important}}';
  document.head.appendChild(style);

  const head=document.querySelector('.quote-table thead tr');
  if(head){
    head.innerHTML='<th>Cód.</th><th>Descrição</th><th>UN</th><th>Qtd</th><th class="purchase-internal">Preço compra</th><th>Preço venda</th><th>Desc. %</th><th>Total</th><th class="quote-actions"></th>';
  }

  // Reforça o autocomplete na V2.4 e evita perda dos handlers após atualização.
  window.clientSuggestions=function(q){
    q=norm(q);
    const a=q?db.clients.filter(c=>norm([c.codigo,c.nome_fantasia,c.razao_social,c.cnpj_cpf].join(' ')).includes(q)).slice(0,10):[];
    $('clientSugs').innerHTML=a.map(c=>`<div class="sug" data-client-id="${c.id}"><b>${esc(c.nome_fantasia)}</b><br><span class="muted">${esc(c.codigo)} • ${esc(c.cnpj_cpf)}</span></div>`).join('');
    $('clientSugs').classList.toggle('show',a.length>0);
    $('clientSugs').querySelectorAll('[data-client-id]').forEach(el=>el.onclick=()=>selectClient(el.dataset.clientId));
  };

  window.productSuggestions=function(q){
    q=norm(q);
    const a=q?db.products.filter(p=>norm([p.codigo,p.identificacao,p.descricao,p.categoria].join(' ')).includes(q)).slice(0,12):[];
    $('productSugs').innerHTML=a.map(p=>`<div class="sug" data-product-id="${p.id}"><b>${esc(p.descricao)}</b><br><span class="muted">${esc(p.codigo)} • ${esc(p.unidade)} • ${money(p.preco_venda)}</span></div>`).join('');
    $('productSugs').classList.toggle('show',a.length>0);
    $('productSugs').querySelectorAll('[data-product-id]').forEach(el=>el.onclick=()=>addProduct(el.dataset.productId));
  };

  function bindQuoteSearches(){
    const client=$('clientSearch'), product=$('productSearch');
    if(client) client.oninput=()=>window.clientSuggestions(client.value);
    if(product) product.oninput=()=>window.productSuggestions(product.value);
  }
  bindQuoteSearches();
  window.addEventListener('load',bindQuoteSearches);

  window.openProduct=function(id=''){
    const p=db.products.find(x=>x.id===id)||{};
    const opts='<option value="">Sem fornecedor</option>'+db.suppliers.map(s=>`<option value="${s.id}" ${p.fornecedor_padrao_id===s.id?'selected':''}>${esc(s.codigo)} - ${esc(s.nome_fantasia)}</option>`).join('');
    openModal(id?'Editar produto':'Novo produto',`<form id="fProduct" class="form-grid">
      <div><label>Código</label><input name="codigo" class="input" value="${esc(p.codigo||nextCode('PRD',db.products))}" readonly></div>
      <div><label>Identificação</label><input name="identificacao" class="input" value="${esc(p.identificacao||'')}"></div>
      <div class="span2"><label>Descrição *</label><input name="descricao" class="input" value="${esc(p.descricao||'')}" required></div>
      <div><label>Categoria</label><input name="categoria" class="input" value="${esc(p.categoria||'')}"></div>
      <div><label>Subcategoria</label><input name="subcategoria" class="input" value="${esc(p.subcategoria||'')}"></div>
      <div><label>UN</label><input name="unidade" class="input" value="${esc(p.unidade||'pc')}"></div>
      <div><label>NCM</label><input name="ncm" class="input" value="${esc(p.ncm||'')}"></div>
      <div class="span2"><label>Fornecedor padrão</label><select name="fornecedor_padrao_id" class="select">${opts}</select></div>
      <div><label>Preço de compra</label><input name="preco_compra" class="input" type="number" min="0" step="0.01" value="${p.preco_compra??''}" placeholder="Valor pago na aquisição"></div>
      <div><label>Custo ref.</label><input name="custo_ref" class="input" type="number" step="0.0001" value="${p.custo_ref??''}"></div>
      <div><label>Markup %</label><input name="markup_percentual" class="input" type="number" step="0.0001" value="${p.markup_percentual??''}"></div>
      <div><label>Preço de venda *</label><input name="preco_venda" class="input" type="number" min="0" step="0.01" value="${p.preco_venda??0}" required></div>
      <div><label>Status</label><select name="status" class="select"><option ${p.status!=='INATIVO'?'selected':''}>ATIVO</option><option ${p.status==='INATIVO'?'selected':''}>INATIVO</option></select></div>
      <div class="span4" style="text-align:right"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button> <button class="btn primary">Salvar</button></div>
    </form>`);
    $('fProduct').onsubmit=async e=>{
      e.preventDefault();
      const v=Object.fromEntries(new FormData(e.target));
      if(!v.fornecedor_padrao_id)v.fornecedor_padrao_id=null;
      ['preco_compra','custo_ref','markup_percentual','preco_venda'].forEach(k=>v[k]=v[k]===''?null:n(v[k]));
      const r=id?await sb.from('produtos').update(v).eq('id',id):await sb.from('produtos').insert(v);
      if(r.error)return alert(r.error.message);
      closeModal();await loadAll();toast('Produto salvo.');
    };
  };

  window.addProduct=function(id){
    const p=db.products.find(x=>x.id===id);if(!p)return;
    quote.items.push({produto_id:p.id,codigo_produto:p.codigo,descricao:p.descricao,unidade:p.unidade,quantidade:1,preco_compra_unitario:p.preco_compra==null?null:n(p.preco_compra),preco_unitario:n(p.preco_venda),desconto_percentual:0});
    $('productSearch').value='';$('productSugs').classList.remove('show');renderQuoteItems();
  };

  window.renderQuoteItems=function(){
    $('quoteItems').innerHTML=quote.items.map((i,k)=>`<tr>
      <td><b>${esc(i.codigo_produto)}</b></td><td class="desc">${esc(i.descricao)}</td><td>${esc(i.unidade)}</td>
      <td><input type="number" min="0.01" step="0.01" value="${i.quantidade}" onchange="updItem(${k},'quantidade',this.value)"></td>
      <td class="purchase-internal"><input type="number" min="0" step="0.01" value="${i.preco_compra_unitario??''}" placeholder="Compra" onchange="updItem(${k},'preco_compra_unitario',this.value)"></td>
      <td><input type="number" min="0" step="0.01" value="${i.preco_unitario}" onchange="updItem(${k},'preco_unitario',this.value)"></td>
      <td><input type="number" min="0" max="100" step="0.01" value="${i.desconto_percentual}" onchange="updItem(${k},'desconto_percentual',this.value)"></td>
      <td><b>${money(itemTotal(i))}</b></td><td class="quote-actions"><button class="icon" onclick="removeItem(${k})">×</button></td>
    </tr>`).join('')||'<tr><td colspan="9" class="empty">Pesquise um produto para adicionar.</td></tr>';
    calcQuote();
  };

  window.updItem=function(k,f,v){
    if(f==='preco_compra_unitario' && String(v).trim()==='')quote.items[k][f]=null;
    else quote.items[k][f]=n(v);
    renderQuoteItems();
  };

  window.openQuote=async function(id,neg=false){
    const o=db.quotes.find(x=>x.id===id);if(!o)return;
    const rr=await sb.from('orcamento_revisoes').select('*, orcamento_itens(*)').eq('orcamento_id',id).order('numero_revisao',{ascending:false});
    if(rr.error)return alert(rr.error.message);
    const latest=rr.data[0];
    quote={id:o.id,client:db.clients.find(c=>c.id===o.cliente_id)||null,items:(latest?.orcamento_itens||[]).map(i=>({produto_id:i.produto_id,codigo_produto:i.codigo_produto,descricao:i.descricao,unidade:i.unidade,quantidade:n(i.quantidade),preco_compra_unitario:i.preco_compra_unitario==null?null:n(i.preco_compra_unitario),preco_unitario:n(i.preco_unitario),desconto_percentual:n(i.desconto_percentual)})),revision:o.revisao_atual,status:o.status,latestRevisionId:latest?.id,revisions:rr.data};
    $('quoteTitle').textContent=`${o.numero} • Revisão ${o.revisao_atual}`;$('qNumber').value=o.numero;$('qDate').value=o.data_orcamento;$('qValidity').value=o.validade_dias;$('qReason').value=neg?'Negociação / ajuste':'';$('qNotes').value=latest?.observacoes||o.observacoes||'';$('qDiscount').value=n(latest?.desconto_geral_percentual);$('qFreight').value=n(latest?.frete_outros);$('clientSearch').value=quote.client?`${quote.client.codigo} - ${quote.client.nome_fantasia}`:'';
    renderClientBox();renderQuoteItems();$('revisionPanel').classList.remove('hidden');renderRevisionHistory();
    const locked=['CANCELADO','CONVERTIDO_EM_VENDA','REPROVADO'].includes(o.status);$('saveQuoteBtn').textContent='Salvar nova revisão';$('saveQuoteBtn').classList.toggle('hidden',locked);$('cancelQuoteBtn').classList.toggle('hidden',locked);$('approveBtn').classList.toggle('hidden',locked);
    if(o.status==='APROVADO'){$('approveBtn').textContent='Converter em venda';$('approveBtn').onclick=convertCurrentQuote}else{$('approveBtn').textContent='Aprovar orçamento';$('approveBtn').onclick=approveCurrentQuote}
    if(o.status==='CANCELADO')toast('Orçamento cancelado: somente consulta.');if(o.status==='CONVERTIDO_EM_VENDA')toast('Orçamento finalizado: venda já gerada.');go('quote');
  };

  window.loadRevision=async function(id){
    const r=(quote.revisions||[]).find(x=>x.id===id);if(!r)return;
    quote.items=(r.orcamento_itens||[]).map(i=>({produto_id:i.produto_id,codigo_produto:i.codigo_produto,descricao:i.descricao,unidade:i.unidade,quantidade:n(i.quantidade),preco_compra_unitario:i.preco_compra_unitario==null?null:n(i.preco_compra_unitario),preco_unitario:n(i.preco_unitario),desconto_percentual:n(i.desconto_percentual)}));
    $('qDiscount').value=n(r.desconto_geral_percentual);$('qFreight').value=n(r.frete_outros);$('qNotes').value=r.observacoes||'';$('qReason').value='Nova negociação baseada na revisão '+r.numero_revisao;renderQuoteItems();toast('Revisão carregada como base para uma nova negociação.');
  };
})();