import { api, requireAuth, attachLogout } from './app.js';

const fullNameInput = document.getElementById('profileFullName');
const documentInput = document.getElementById('profileDocument');
const birthDateInput = document.getElementById('profileBirthDate');
const saveProfileButton = document.getElementById('saveProfileButton');
const profileStatus = document.getElementById('certificatesProfileStatus');
const certificatesStatus = document.getElementById('certificatesStatus');
const certificateGrid = document.getElementById('certificateTrackGrid');

let currentUser = null;

function setProfileStatus(message, type = 'notice') {
  profileStatus.textContent = message;
  profileStatus.className =
    type === 'error' ? 'notice error' : type === 'success' ? 'notice success' : 'notice';
}

function setCertificatesStatus(message, type = 'notice') {
  certificatesStatus.textContent = message;
  certificatesStatus.className =
    type === 'error' ? 'notice error' : type === 'success' ? 'notice success' : 'notice';
}

function formatCurrency(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function fillProfile(user) {
  fullNameInput.value = user.full_name || '';
  documentInput.value = user.document_id || '';
  birthDateInput.value = user.birth_date || '';
}

function openCertificate(trackId, mode) {
  window.open(`/certificate?trackId=${trackId}&mode=${mode}`, '_blank');
}

function renderTracks(tracks) {
  certificateGrid.innerHTML = '';
  if (!tracks.length) {
    certificateGrid.innerHTML = '<p class="notice">Nenhuma certificacao disponivel no momento.</p>';
    return;
  }

  tracks.forEach((track) => {
    const card = document.createElement('article');
    card.className = 'certificate-track-card';
    card.innerHTML = `
      <div class="certificate-track-card__header">
        <div>
          <h3>${track.title}</h3>
          <p class="notice">${track.description || 'Sem descricao cadastrada.'}</p>
        </div>
        <span class="tag">${track.total_hours}h</span>
      </div>
      <div class="certificate-track-card__meta">
        <span class="tag">${formatCurrency(track.price_cents)}</span>
        <span class="tag">${track.payment_status}</span>
      </div>
      <div class="notice">
        <strong>Atividade final:</strong> ${track.final_activity_title}
        <div style="margin-top: 6px;">${track.final_activity_instructions}</div>
      </div>
      <label class="label">Resposta / comprovacao da atividade final</label>
      <textarea class="code-input certificate-track-card__textarea" data-track-text="${track.id}">${track.submission_text || ''}</textarea>
      <div class="certificate-track-card__actions">
        <button class="button" data-action="submit" data-track="${track.id}">Salvar atividade</button>
        <button class="button secondary" data-action="preview" data-track="${track.id}" ${track.preview_ready ? '' : 'disabled'}>Abrir previa</button>
        <button class="button secondary" data-action="pix" data-track="${track.id}" ${track.preview_ready && track.payment_status !== 'paid' ? '' : 'disabled'}>Pagar via Pix</button>
        <button class="button secondary" data-action="card" data-track="${track.id}" ${track.preview_ready && track.payment_status !== 'paid' ? '' : 'disabled'}>Pagar via cartao</button>
        <button class="button secondary" data-action="final" data-track="${track.id}" ${track.certificate_ready ? '' : 'disabled'}>Certificado final</button>
      </div>
    `;

    card.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        const trackId = Number(button.dataset.track);
        const textarea = card.querySelector(`[data-track-text="${trackId}"]`);

        try {
          if (action === 'submit') {
            await api.certificateSubmitFinalActivity(trackId, textarea.value);
            setCertificatesStatus('Atividade final registrada. A previa ja esta liberada.', 'success');
            await loadTracks();
            return;
          }

          if (action === 'preview') {
            openCertificate(trackId, 'preview');
            return;
          }

          if (action === 'pix' || action === 'card') {
            await api.certificateRequestPayment(trackId, action === 'pix' ? 'pix' : 'card');
            setCertificatesStatus(
              `Pedido criado via ${action === 'pix' ? 'Pix' : 'cartao'}. Aguarde confirmacao do admin.`,
              'success'
            );
            await loadTracks();
            return;
          }

          if (action === 'final') {
            openCertificate(trackId, 'final');
          }
        } catch (err) {
          setCertificatesStatus(err.message, 'error');
        }
      });
    });

    certificateGrid.appendChild(card);
  });
}

async function loadTracks() {
  const data = await api.certificates();
  renderTracks(data.tracks || []);
  setCertificatesStatus(`${(data.tracks || []).length} certificacao(oes) disponivel(is).`, 'notice');
}

saveProfileButton.addEventListener('click', async () => {
  try {
    const data = await api.updateProfile({
      full_name: fullNameInput.value.trim(),
      document_id: documentInput.value.trim(),
      birth_date: birthDateInput.value
    });
    currentUser = data.user;
    fillProfile(currentUser);
    setProfileStatus('Dados salvos com sucesso.', 'success');
  } catch (err) {
    setProfileStatus(err.message, 'error');
  }
});

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;
  fillProfile(currentUser);
  await loadTracks();
}

attachLogout();
init();
