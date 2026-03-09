import { api, requireAuth } from './app.js';

const defaultCertificate = {
  participantName: 'Rodrigo Oliveira Souza',
  document: '08828098570',
  birthDate: '27/09/2001',
  courseTitle: 'Banco de Dados',
  totalHours: 40,
  trackLabel: 'certificacao de 40 horas',
  city: 'Cruz das Almas',
  issueDate: '2026-03-09',
  certificateId: 'INF-DB-2026-000184',
  verificationUrl: 'https://training.infinity.dev.br/certificate',
  summaryLead: 'certifica que',
  validationCopy:
    'Este certificado integra a trilha premium da Infinity Dev. A validacao publica usa o codigo unico de emissao.',
  previewMode: false,
  watermarkText: 'PREVIA NAO VALIDA',
  signatures: [
    { signedBy: 'Rodrigo Silva', printedName: 'Rodrigo Silva', role: 'Fundador e CEO' },
    { signedBy: 'Equipe Infinity', printedName: 'Equipe Infinity Dev', role: 'Validacao Tecnica' }
  ],
  modules: []
};

function readOverrides() {
  const params = new URLSearchParams(window.location.search);
  const overrides = {};
  ['participantName', 'document', 'birthDate', 'courseTitle', 'city', 'issueDate', 'certificateId'].forEach(
    (field) => {
      const value = params.get(field);
      if (value) overrides[field] = value;
    }
  );
  const totalHours = Number(params.get('totalHours'));
  if (!Number.isNaN(totalHours) && totalHours > 0) {
    overrides.totalHours = totalHours;
  }
  return overrides;
}

function renderFieldBindings(data) {
  document.querySelectorAll('[data-field]').forEach((node) => {
    const field = node.dataset.field;
    node.textContent = data[field] || '';
  });
}

function renderSummary(data) {
  const summary = document.getElementById('certificateSummary');
  if (!summary) return;
  summary.innerHTML = `
    <span>${data.summaryLead}</span>
    <strong> ${data.participantName}</strong>,
    documento <strong>${data.document}</strong>,
    nascido(a) em <strong>${data.birthDate}</strong>,
    concluiu a jornada <strong>${data.courseTitle}</strong> com carga horaria de
    <strong>${data.totalHours} horas</strong>, cumprindo os requisitos da
    <strong>${data.trackLabel}</strong>.
  `;
}

function renderLocation(data) {
  const location = document.getElementById('certificateLocation');
  if (!location) return;
  location.textContent = `${data.city}, ${data.issueDate}.`;
}

function renderSignatures(signatures) {
  const container = document.getElementById('certificateSignatures');
  if (!container) return;
  container.innerHTML = signatures
    .map(
      (signature) => `
        <article class="certificate-signature">
          <div class="certificate-signature__scribble">${signature.signedBy}</div>
          <div class="certificate-signature__line"></div>
          <div class="certificate-signature__name">${signature.printedName}</div>
          <div class="certificate-signature__role">${signature.role}</div>
        </article>
      `
    )
    .join('');
}

function renderParticipantGrid(data) {
  const fields = [
    ['Nome', data.participantName],
    ['Documento', data.document],
    ['Data de nascimento', data.birthDate],
    ['Curso', data.courseTitle],
    ['Carga horaria', `${data.totalHours} horas`],
    ['Data de emissao', data.issueDate]
  ];

  const grid = document.getElementById('participantGrid');
  if (!grid) return;

  grid.innerHTML = fields
    .map(
      ([label, value]) => `
        <div class="certificate-field">
          <span class="certificate-field__label">${label}</span>
          <strong class="certificate-field__value">${value}</strong>
        </div>
      `
    )
    .join('');
}

function renderModules(modules) {
  const grid = document.getElementById('programGrid');
  if (!grid) return;
  grid.innerHTML = modules
    .map(
      (module) => `
        <article class="certificate-module">
          <div class="certificate-module__title">${module.title}</div>
          <div class="certificate-module__subtitle">${module.subtitle}</div>
          <ol class="certificate-module__list">
            ${(module.items || []).map((item) => `<li>${item}</li>`).join('')}
          </ol>
        </article>
      `
    )
    .join('');
}

function renderValidationCopy(data) {
  const note = document.getElementById('certificateValidationCopy');
  if (!note) return;
  note.textContent = `${data.validationCopy} URL de verificacao: ${data.verificationUrl}`;
}

function renderPreviewMode(data) {
  const sheets = document.querySelectorAll('.certificate-sheet');
  sheets.forEach((sheet) => {
    sheet.classList.toggle('is-preview', Boolean(data.previewMode));
    sheet.dataset.watermark = data.watermarkText || 'PREVIA NAO VALIDA';
  });
}

function bindPrint() {
  const button = document.getElementById('printCertificate');
  if (!button) return;
  button.addEventListener('click', () => window.print());
}

async function loadCertificate() {
  const params = new URLSearchParams(window.location.search);
  const trackId = Number(params.get('trackId'));
  const mode = params.get('mode') === 'final' ? 'final' : 'preview';

  if (!trackId) {
    return { ...defaultCertificate, ...readOverrides() };
  }

  await requireAuth();
  const data = await api.certificateRender(trackId, mode);
  return data.certificate;
}

async function init() {
  try {
    const data = await loadCertificate();
    document.title = `Certificado - ${data.participantName}`;
    renderFieldBindings(data);
    renderSummary(data);
    renderLocation(data);
    renderSignatures(data.signatures || []);
    renderParticipantGrid(data);
    renderModules(data.modules || []);
    renderValidationCopy(data);
    renderPreviewMode(data);
    bindPrint();
  } catch (err) {
    document.body.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:32px;background:#edf0f4;font-family:Manrope,sans-serif;">
        <section style="max-width:720px;padding:28px;border-radius:18px;background:#fff;border:1px solid #dfe3e8;box-shadow:0 20px 50px rgba(26,35,29,.08);">
          <h1 style="margin:0 0 12px;font-size:28px;">Nao foi possivel carregar o certificado</h1>
          <p style="margin:0;color:#4f5a53;">${err.message}</p>
        </section>
      </main>
    `;
  }
}

init();
