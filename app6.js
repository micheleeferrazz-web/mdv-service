// V2.4.1 - correção robusta do autocomplete de clientes e produtos
(function(){
  function showClientSuggestions(value){
    const box=document.getElementById('clientSugs');
    if(!box)return;
    const q=norm(value).trim();
    if(!q){box.innerHTML='';box.classList.remove('show');return;}
    const items=(db.clients||[]).filter(c=>norm([c.codigo,c.nome_fantasia,c.razao_social,c.cnpj_cpf,c.cidade].join(' ')).includes(q)).slice(0,12);
    box.innerHTML=items.map(c=>`<div class="sug" data-client-id="${c.id}"><b>${esc(c.nome_fantasia||c.razao_social||c.codigo)}</b><br><span class="muted">${esc(c.codigo)}${c.cnpj_cpf?' • '+esc(c.cnpj_cpf):''}${c.cidade?' • '+esc(c.cidade)+(c.uf?'/'+esc(c.uf):''):''}</span></div>`).join('');
    box.classList.toggle('show',items.length>0);
    box.querySelectorAll('[data-client-id]').forEach(el=>el.addEventListener('mousedown',e=>{e.preventDefault();selectClient(el.dataset.clientId);}));
  }

  function showProductSuggestions(value){
    const box=document.getElementById('productSugs');
    if(!box)return;
    const q=norm(value).trim();
    if(!q){box.innerHTML='';box.classList.remove('show');return;}
    const items=(db.products||[]).filter(p=>norm([p.codigo,p.identificacao,p.descricao,p.categoria,p.subcategoria].join(' ')).includes(q)).slice(0,15);
    box.innerHTML=items.map(p=>`<div class="sug" data-product-id="${p.id}"><b>${esc(p.descricao||p.identificacao||p.codigo)}</b><br><span class="muted">${esc(p.codigo)}${p.identificacao?' • '+esc(p.identificacao):''} • ${esc(p.unidade||'')} • Venda ${money(p.preco_venda)}</span></div>`).join('');
    box.classList.toggle('show',items.length>0);
    box.querySelectorAll('[data-product-id]').forEach(el=>el.addEventListener('mousedown',e=>{e.preventDefault();addProduct(el.dataset.productId);}));
  }

  function rebindAutocomplete(){
    const client=document.getElementById('clientSearch');
    const product=document.getElementById('productSearch');
    if(client){client.oninput=()=>showClientSuggestions(client.value);client.onfocus=()=>{if(client.value)showClientSuggestions(client.value);};}
    if(product){product.oninput=()=>showProductSuggestions(product.value);product.onfocus=()=>{if(product.value)showProductSuggestions(product.value);};}
  }

  rebindAutocomplete();
  window.addEventListener('pageshow',rebindAutocomplete);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)rebindAutocomplete();});
})();
