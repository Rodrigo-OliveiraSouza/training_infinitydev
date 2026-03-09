import { api, requireAuth, attachLogout } from './app.js';

const trackList = document.getElementById('certificateTrackList');
const editorTitle = document.getElementById('certificateEditorTitle');
const adminStatus = document.getElementById('certificateAdminStatus');
const ordersStatus = document.getElementById('certificateOrdersStatus');
const ordersList = document.getElementById('certificateOrdersList');

const titleInput = document.getElementById('certificateTitleInput');
const slugInput = document.getElementById('certificateSlugInput');
const hoursInput = document.getElementById('certificateHoursInput');
const priceInput = document.getElementById('certificatePriceInput');
const locationInput = document.getElementById('certificateLocationInput');
const watermarkInput = document.getElementById('certificateWatermarkInput');
const activeInput = document.getElementById('certificateActiveInput');
const descriptionInput = document.getElementById('certificateDescriptionInput');
const finalTitleInput = document.getElementById('certificateFinalTitleInput');
const finalInstructionsInput = document.getElementById('certificateFinalInstructionsInput');
const programInput = document.getElementById('certificateProgramInput');
const signersInput = document.getElementById('certificateSignersInput');
const saveButton = document.getElementById('saveCertificateButton');
const newButton = document.getElementById('newCertificateButton');

let tracksCache = [];
let currentTrack = null;

function setAdminStatus(message, type = 'notice') {
  adminStatus.textContent = message;
  adminStatus.className =
    type === 'error' ? 'notice error' : type === 'success' ? 'notice success' : 'notice';
}

function setOrdersStatus(message, type = 'notice') {
  ordersStatus.textContent = message;
  ordersStatus.className =
    type === 'error' ? 'notice error' : type === 'success' ? 'notice success' : 'notice';
}

function formatCurrency(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function resetForm() {
  currentTrack = null;
  editorTitle.textContent = 'Novo certificado';
  titleInput.value = '';
  slugInput.value = '';
  hoursInput.value = '20';
  priceInput.value = '0';
  locationInput.value = 'Cruz das Almas';
  watermarkInput.value = 'PREVIA NAO VALIDA';
  activeInput.value = '1';
  descriptionInput.value = '';
  finalTitleInput.value = '';
  finalInstructionsInput.value = '';
  programInput.value = '[]';
  signersInput.value = '[]';
  setAdminStatus('Preencha os dados e salve.', 'notice');
  renderTrackList();
}

function fillForm(track) {
  currentTrack = track;
  editorTitle.textContent = `Editar certificado #${track.id}`;
  titleInput.value = track.title || '';
  slugInput.value = track.slug || '';
  hoursInput.value = String(track.total_hours || 20);
  priceInput.value = String(track.price_cents || 0);
  locationInput.value = track.location_text || '';
  watermarkInput.value = track.preview_watermark || 'PREVIA NAO VALIDA';
  activeInput.value = track.active ? '1' : '0';
  descriptionInput.value = track.description || '';
  finalTitleInput.value = track.final_activity_title || '';
  finalInstructionsInput.value = track.final_activity_instructions || '';
  programInput.value = JSON.stringify(track.program || [], null, 2);
  signersInput.value = JSON.stringify(track.signers || [], null, 2);
  setAdminStatus('Certificado carregado.', 'notice');
  renderTrackList();
}

function renderTrackList() {
  trackList.innerHTML = '';
  if (!tracksCache.length) {
    trackList.innerHTML = '<p class="notice">Nenhum certificado cadastrado.</p>';
    return;
  }

  tracksCache.forEach((track) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-level ${currentTrack?.id === track.id ? 'active' : ''}`;
    button.innerHTML = `
      <strong>${track.title}</strong>
      <span>${track.total_hours}h | ${formatCurrency(track.price_cents)} | ${track.active ? 'ativo' : 'inativo'}</span>
      <span>${track.pending_payments} pendente(s) | ${track.paid_certificates} pago(s)</span>
    `;
    button.addEventListener('click', () => fillForm(track));
    trackList.appendChild(button);
  });
}

function buildPayload() {
  return {
    title: titleInput.value.trim(),
    slug: slugInput.value.trim(),
    total_hours: Number(hoursInput.value),
    price_cents: Number(priceInput.value),
    location_text: locationInput.value.trim(),
    preview_watermark: watermarkInput.value.trim(),
    active: activeInput.value === '1',
    description: descriptionInput.value,
    final_activity_title: finalTitleInput.value.trim(),
    final_activity_instructions: finalInstructionsInput.value,
    program: JSON.parse(programInput.value || '[]'),
    signers: JSON.parse(signersInput.value || '[]')
  };
}

function renderOrders(orders) {
  ordersList.innerHTML = '';
  if (!orders.length) {
    ordersList.innerHTML = '<p class="notice">Nenhum pedido de certificado ainda.</p>';
    return;
  }

  orders.forEach((order) => {
    const card = document.createElement('div');
    card.className = 'certificate-order-card';
    card.innerHTML = `
      <div class="certificate-order-card__head">
        <div>
          <strong>${order.certificate_title}</strong>
          <p class="notice">${order.full_name || order.username} | ${order.email}</p>
        </div>
        <span class="tag">${order.status}</span>
      </div>
      <p class="notice">Metodo: ${order.payment_method || '--'} | Valor: ${formatCurrency(order.amount_cents)}</p>
      <p class="notice">Atividade final: ${order.submission_text || 'Nao enviada'}</p>
    `;

    if (order.status !== 'paid') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.textContent = 'Marcar como pago';
      button.addEventListener('click', async () => {
        try {
          await api.adminCertificateMarkPaid(order.id);
          await loadOrders();
          await loadTracks();
          setOrdersStatus('Pagamento confirmado e certificado liberado.', 'success');
        } catch (err) {
          setOrdersStatus(err.message, 'error');
        }
      });
      card.appendChild(button);
    } else {
      const meta = document.createElement('p');
      meta.className = 'notice success';
      meta.textContent = `Pago em ${order.paid_at || '--'} | Codigo ${order.verification_code || '--'}`;
      card.appendChild(meta);
    }

    ordersList.appendChild(card);
  });
}

async function loadTracks() {
  const data = await api.adminCertificateTracks();
  tracksCache = data.tracks || [];
  if (currentTrack) {
    currentTrack = tracksCache.find((track) => track.id === currentTrack.id) || null;
  }
  renderTrackList();
}

async function loadOrders() {
  const data = await api.adminCertificateOrders();
  renderOrders(data.orders || []);
  setOrdersStatus(`${(data.orders || []).length} pedido(s) encontrado(s).`, 'notice');
}

saveButton.addEventListener('click', async () => {
  let payload;
  try {
    payload = buildPayload();
  } catch (err) {
    setAdminStatus('JSON invalido em conteudo ou assinaturas.', 'error');
    return;
  }

  try {
    if (currentTrack?.id) {
      const data = await api.adminCertificateUpdate(currentTrack.id, payload);
      currentTrack = data.track;
      setAdminStatus('Certificado atualizado.', 'success');
    } else {
      const data = await api.adminCertificateCreate(payload);
      currentTrack = data.track;
      setAdminStatus('Certificado criado.', 'success');
    }
    await loadTracks();
  } catch (err) {
    setAdminStatus(err.message, 'error');
  }
});

newButton.addEventListener('click', resetForm);

async function init() {
  const user = await requireAuth();
  if (!user || user.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  resetForm();
  await loadTracks();
  await loadOrders();
}

attachLogout();
init();
