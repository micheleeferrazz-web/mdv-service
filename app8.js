// Ciclo 1 - Cadastros, filtros e Dados MDV
(async()=>{
  for(const src of ['app8a.js','app8b.js','app8c.js','app8d.js']){
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src+'?v=20260904subcat';s.onload=resolve;s.onerror=reject;document.body.appendChild(s)});
  }
})().catch(err=>console.error('Falha ao carregar melhorias do ciclo 1:',err));
