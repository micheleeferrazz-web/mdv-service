// V2.5 - aprovação manual de novos usuários
async function loadUsers(){
  if(currentProfile?.role!=='admin')return;
  const {data,error}=await sb.from('user_profiles').select('id,email,role,status,created_at').order('created_at',{ascending:false});
  if(error)return alert('Não foi possível carregar os usuários.\n\n'+error.message);
  $('userTable').innerHTML=(data||[]).map(user=>{
    const own=user.id===currentProfile.id;
    const statusLabel={pending:'Pendente',approved:'Aprovado',blocked:'Bloqueado'}[user.status]||user.status;
    const actions=own?'<span class="muted">Conta administradora</span>':`<button class="btn ok" onclick="setUserStatus('${user.id}','approved')">Aprovar</button> <button class="btn danger" onclick="setUserStatus('${user.id}','blocked')">Recusar / Bloquear</button>`;
    return `<tr><td><b>${esc(user.email)}</b></td><td>${new Date(user.created_at).toLocaleString('pt-BR')}</td><td>${user.role==='admin'?'Administrador':'Usuário'}</td><td><span class="pill">${statusLabel}</span></td><td class="actions">${actions}</td></tr>`;
  }).join('')||'<tr><td colspan="5" class="empty">Nenhum usuário cadastrado.</td></tr>';
}

async function setUserStatus(id,status){
  if(currentProfile?.role!=='admin')return;
  const action=status==='approved'?'aprovar':'recusar ou bloquear';
  if(!confirm(`Deseja ${action} este usuário?`))return;
  const {error}=await sb.from('user_profiles').update({status,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return alert(error.message);
  toast(status==='approved'?'Usuário aprovado.':'Usuário bloqueado.');
  await loadUsers();
}
