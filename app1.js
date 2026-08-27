window.addEventListener('error',e=>{console.error(e.error||e.message)});

const SUPABASE_URL="https://bdbdrlhumuocxfonylls.supabase.co";
const SUPABASE_KEY="sb_publishable_zqQrSsYf7_qwfnKt9ddFYA_w93ihruY";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let authMode='login';
let currentProfile=null;
let appStarted=false;
let db={clients:[],products:[],suppliers:[],quotes:[],sales:[]};
let quote={id:null,client:null,items:[],revision:0,status:null,latestRevisionId:null};
const $=id=>document.getElementById(id);
const titles={dashboard:['Painel comercial','Dados sincronizados online.'],quote:['Orçamento','Crie ou negocie uma proposta.'],clients:['Clientes','Cadastro de clientes.'],products:['Produtos','Cadastro e preços.'],suppliers:['Fornecedores','Parceiros comerciais.'],quotes:['Orçamentos','Histórico e negociações.'],sales:['Vendas','Pedidos gerados a partir de orçamento aprovado.'],users:['Usuários','Aprovação e bloqueio de acessos.']};
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function norm(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function n(v){return Number(String(v??0).replace(',','.'))||0}
function money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n(v))}
function today(){return new Date().toISOString().slice(0,10)}
function toast(m){$('toast').textContent=m;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2300)}
function setAuthMode(m){authMode=m;$('tLogin').className='btn '+(m==='login'?'primary':'ghost');$('tSignup').className='btn '+(m==='signup'?'primary':'ghost');$('authBtn').textContent=m==='login'?'Entrar':'Criar acesso';$('authHelp').textContent=m==='login'?'Entre com seu usuário do sistema.':'Crie seu usuário e confirme o e-mail. Depois, aguarde a aprovação do administrador.'}
async function submitAuth(){const email=$('email').value.trim(),password=$('password').value;if(!email||password.length<6)return toast('Informe e-mail e senha com pelo menos 6 caracteres.');let r;if(authMode==='login')r=await sb.auth.signInWithPassword({email,password});else r=await sb.auth.signUp({email,password});if(r.error)return alert(r.error.message);if(authMode==='signup'&&!r.data.session)toast('Conta criada. Verifique seu e-mail para confirmar.');}
async function logout(){await sb.auth.signOut()}
sb.auth.onAuthStateChange((e,s)=>{setTimeout(()=>s?startApp(s.user):showLogin(),0)})
async function boot(){const {data}=await sb.auth.getSession();if(data.session)await startApp(data.session.user);else showLogin()}
function clearSessionData(){db={clients:[],products:[],suppliers:[],quotes:[],sales:[]};quote={id:null,client:null,items:[],revision:0,status:null,latestRevisionId:null};['clientTable','productTable','supplierTable','quoteTable','saleTable','userTable'].forEach(id=>{if($(id))$(id).innerHTML=''});$('adminNav').classList.add('hidden');$('adminTopBtn').classList.add('hidden');document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='dashboard'))}
function showLogin(){clearSessionData();$('login').classList.remove('hidden');$('app').classList.add('hidden');$('authForm').classList.remove('hidden');$('accessMessage').classList.add('hidden');currentProfile=null;appStarted=false}
function showAccessMessage(status){$('login').classList.remove('hidden');$('app').classList.add('hidden');$('authForm').classList.add('hidden');$('accessMessage').classList.remove('hidden');$('accessNotice').textContent=status==='blocked'?'Seu acesso foi recusado ou bloqueado. Entre em contato com o administrador.':'Seu e-mail foi confirmado e o cadastro está aguardando aprovação do administrador.'}
async function startApp(user){const {data:profile,error}=await sb.from('user_profiles').select('id,email,role,status').eq('id',user.id).maybeSingle();if(error){console.error(error);showAccessMessage('pending');return}currentProfile=profile;if(!profile||profile.status!=='approved'){showAccessMessage(profile?.status||'pending');return}$('login').classList.add('hidden');$('app').classList.remove('hidden');$('userMini').textContent=user.email||'';const isAdmin=profile.role==='admin';$('adminNav').classList.toggle('hidden',!isAdmin);$('adminTopBtn').classList.toggle('hidden',!isAdmin);bind();if(!appStarted){appStarted=true;await loadAll();newQuote()}if(isAdmin&&typeof loadUsers==='function')await loadUsers()}
let bound=false;
function bind(){if(bound)return;bound=true;document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.page));document.querySelectorAll('.mobile-bottom-nav button').forEach(b=>b.onclick=()=>go(b.dataset.page));$('clientFilter').oninput=renderClients;$('productFilter').oninput=renderProducts;$('quoteFilter').oninput=renderQuotes;$('quoteStatusFilter').onchange=renderQuotes;$('saleFilter').oninput=renderSales;$('clientSearch').oninput=()=>clientSuggestions($('clientSearch').value);$('productSearch').oninput=()=>productSuggestions($('productSearch').value);$('qDiscount').oninput=calcQuote;$('qFreight').oninput=calcQuote;document.addEventListener('click',e=>{if(!e.target.closest('.searchbox'))document.querySelectorAll('.sugs').forEach(x=>x.classList.remove('show'))})}
function go(id){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));document.querySelectorAll('.mobile-bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));$('pageTitle').textContent=titles[id][0];$('pageSub').textContent=titles[id][1];}
async function loadAll(){toast('Sincronizando...');const [c,p,f,q,s]=await Promise.all([
 sb.from('clientes').select('*').order('nome_fantasia'),
 sb.from('produtos').select('*').order('descricao'),
 sb.from('fornecedores').select('*').order('nome_fantasia'),
 sb.from('orcamentos').select('*, clientes(nome_fantasia,codigo), orcamento_revisoes(id,numero_revisao,total,motivo_revisao,created_at)').order('created_at',{ascending:false}),
 sb.from('vendas').select('*, clientes(nome_fantasia,codigo), orcamentos(numero)').order('created_at',{ascending:false})
]);const consultas=[['Clientes',c],['Produtos',p],['Fornecedores',f],['Orçamentos',q],['Vendas',s]];
 const falhas=consultas.filter(([nome,r])=>r.error);
 if(falhas.length){
   console.error('Falha de sincronização:',falhas);
   const detalhe=falhas.map(([nome,r])=>nome+': '+r.error.message).join('\n');
   alert('Não foi possível sincronizar todos os dados do Supabase.\n\n'+detalhe);
 }
 db.clients=c.error?db.clients:(c.data||[]);
 db.products=p.error?db.products:(p.data||[]);
 db.suppliers=f.error?db.suppliers:(f.data||[]);
 db.quotes=q.error?db.quotes:(q.data||[]);
 db.sales=s.error?db.sales:(s.data||[]);
 renderAll();
 if(!falhas.length)toast('Dados atualizados.');
}
