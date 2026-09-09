const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let jobs = [], filter = "queued";
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) { $("#dashboard").hidden = true; $("#login").hidden = false; }
    throw Object.assign(new Error(data.message || (response.status === 401 ? "E-mail ou senha inválidos, ou sessão expirada." : "Não foi possível concluir a operação.")), { status: response.status });
  }
  return data;
}
function render() {
  document.querySelectorAll("[data-filter]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));
  const visible = jobs.filter(job => job.status === filter);
  $("#jobs").innerHTML = visible.length ? visible.map(job => `<article>
    <span class="badge">${({queued:"Aguardando advogado",claimed:"Em atendimento",filed:"Protocolo registrado pelo advogado"})[job.status]}</span>
    <h2>${escape(job.client_name || "Solicitação " + job.id.slice(0, 8))}</h2>
    <p>${escape(job.city)} · ${escape(job.uf)}<br><small>Recebida em ${escape(new Date(job.created_at).toLocaleString("pt-BR"))}</small></p>
    ${job.status === "queued" ? `<button data-claim="${escape(job.id)}">Assumir solicitação</button>` : `<div class="actions">${Object.entries({report:"Relatório e anexos",powerOfAttorney:"Procuração",agreement:"Contrato"}).map(([name,label])=>`<a class="download" href="/api/advogados/jobs/${escape(job.id)}/documents/${name}">${label}</a>`).join("")}${(job.sources || []).map((name, i) => `<a class="download" href="/api/advogados/jobs/${escape(job.id)}/documents/source-${i}">${escape(name)}</a>`).join("")}</div>
    ${job.status === "claimed" ? `<p>Revise os documentos e confirme a unidade competente antes de protocolar no portal do tribunal.</p><form class="protocol" data-complete="${escape(job.id)}"><label>Número do protocolo ou processo<input name="protocol" required minlength="5" maxlength="100"></label><button>Registrar protocolo concluído</button></form>` : `<p>Protocolo: <strong>${escape(job.protocol_number)}</strong></p>`}`}
  </article>`).join("") : "<section><p>Nenhuma solicitação nesta lista.</p></section>";
}
async function load() {
  const data = await api("/api/advogados/jobs");
  jobs = data.jobs;
  $("#welcome").textContent = `Olá, ${data.user.name}`;
  $("#login").hidden = true; $("#dashboard").hidden = false; $("#logout").hidden = false;
  render();
}
async function run(action, button) {
  $("#message").textContent = "";
  if (button) button.disabled = true;
  try { await action(); } catch (error) { $("#message").textContent = error.message; }
  finally { if (button) button.disabled = false; }
}
$("#loginForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  void run(async () => { await api("/api/auth/login", Object.fromEntries(new FormData(form))); form.reset(); $("#logout").hidden = false; await load(); }, form.querySelector("button"));
});
$("#logout").addEventListener("click", () => void run(async () => { await api("/api/auth/logout", {}); location.reload(); }));
$("#refresh").addEventListener("click", event => void run(load, event.currentTarget));
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => { filter = button.dataset.filter; render(); }));
$("#jobs").addEventListener("click", event => {
  const button = event.target.closest("[data-claim]");
  if (button) void run(async () => { await api(`/api/advogados/jobs/${button.dataset.claim}/claim`, {}); filter = "claimed"; await load(); }, button);
});
$("#jobs").addEventListener("submit", event => {
  const form = event.target.closest("[data-complete]");
  if (!form) return;
  event.preventDefault();
  void run(async () => { await api(`/api/advogados/jobs/${form.dataset.complete}/complete`, { protocolNumber: new FormData(form).get("protocol") }); filter = "filed"; await load(); }, form.querySelector("button"));
});
void load().catch(error => { if (error.status !== 401) $("#message").textContent = error.message; });
