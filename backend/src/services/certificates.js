const crypto = require('crypto');

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function generateVerificationCode(trackId, userId) {
  const seed = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `INF-${String(trackId).padStart(3, '0')}-${String(userId).padStart(4, '0')}-${seed}`;
}

function maskDocument(value) {
  if (!value) return 'documento liberado apos pagamento';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 4) return 'documento liberado apos pagamento';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
}

function maskDate(value) {
  if (!value) return 'data liberada apos pagamento';
  const pieces = String(value).split('-');
  if (pieces.length === 3) {
    return `**/**/${pieces[0]}`;
  }
  return 'data liberada apos pagamento';
}

function displayBirthDate(value) {
  if (!value) return 'nao informado';
  const pieces = String(value).split('-');
  if (pieces.length !== 3) return value;
  return `${pieces[2]}/${pieces[1]}/${pieces[0]}`;
}

function sanitizeTrack(row) {
  if (!row) return null;
  return {
    ...row,
    total_hours: Number(row.total_hours || 0),
    price_cents: Number(row.price_cents || 0),
    active: Number(row.active || 0),
    program: parseJson(row.program_json, []),
    signers: parseJson(row.signers_json, [])
  };
}

function getTrackById(db, trackId) {
  const row = db.prepare(
    `SELECT id, slug, title, description, total_hours, price_cents, location_text,
            final_activity_title, final_activity_instructions, program_json, signers_json,
            preview_watermark, active, created_by_user_id, created_at, updated_at
     FROM certificate_tracks
     WHERE id = ?`
  ).get(trackId);
  return sanitizeTrack(row);
}

function getTracksForUser(db, userId) {
  const rows = db.prepare(
    `SELECT t.id, t.slug, t.title, t.description, t.total_hours, t.price_cents, t.location_text,
            t.final_activity_title, t.final_activity_instructions, t.program_json, t.signers_json,
            t.preview_watermark, t.active, t.created_by_user_id, t.created_at, t.updated_at,
            s.id AS submission_id, s.submission_text, s.created_at AS submission_created_at,
            o.id AS order_id, o.payment_method, o.status AS payment_status, o.paid_at, o.issued_at
     FROM certificate_tracks t
     LEFT JOIN certificate_submissions s ON s.certificate_id = t.id AND s.user_id = ?
     LEFT JOIN certificate_orders o ON o.certificate_id = t.id AND o.user_id = ?
     WHERE t.active = 1
     ORDER BY t.title ASC`
  ).all(userId, userId);

  return rows.map((row) => {
    const track = sanitizeTrack(row);
    const hasSubmission = Boolean(row.submission_id);
    const paymentStatus = row.payment_status || 'not_requested';
    return {
      ...track,
      has_submission: hasSubmission,
      payment_status: paymentStatus,
      payment_method: row.payment_method || null,
      preview_ready: hasSubmission,
      certificate_ready: paymentStatus === 'paid',
      submission_text: row.submission_text || '',
      order_id: row.order_id || null,
      submission_created_at: row.submission_created_at || null,
      paid_at: row.paid_at || null,
      issued_at: row.issued_at || null
    };
  });
}

function getUserCertificateState(db, trackId, userId) {
  const track = getTrackById(db, trackId);
  if (!track) return null;

  const submission = db.prepare(
    `SELECT id, submission_text, created_at, updated_at
     FROM certificate_submissions
     WHERE certificate_id = ? AND user_id = ?`
  ).get(trackId, userId);

  const order = db.prepare(
    `SELECT id, payment_method, status, amount_cents, verification_code, paid_at, issued_at, created_at, updated_at
     FROM certificate_orders
     WHERE certificate_id = ? AND user_id = ?`
  ).get(trackId, userId);

  return {
    track,
    submission: submission || null,
    order: order
      ? {
          ...order,
          amount_cents: Number(order.amount_cents || 0)
        }
      : null,
    preview_ready: Boolean(submission),
    certificate_ready: Boolean(order && order.status === 'paid')
  };
}

function buildCertificatePayload(track, user, options = {}) {
  const previewMode = Boolean(options.previewMode);
  const verificationCode = options.verificationCode || 'PAGAMENTO-PENDENTE';
  const issueDate = options.issueDate || new Date().toISOString().slice(0, 10);
  const participantName = user.full_name || user.username;
  const signers = Array.isArray(track.signers) && track.signers.length
    ? track.signers
    : [
        { signedBy: 'Infinity Dev', printedName: 'Infinity Dev', role: 'Direcao Academica' },
        { signedBy: 'Equipe Tecnica', printedName: 'Equipe Tecnica', role: 'Validacao Tecnica' }
      ];

  return {
    participantName,
    document: previewMode ? maskDocument(user.document_id) : user.document_id || 'nao informado',
    birthDate: previewMode ? maskDate(user.birth_date) : displayBirthDate(user.birth_date),
    courseTitle: track.title,
    totalHours: track.total_hours,
    trackLabel: `certificacao de ${track.total_hours} horas`,
    city: track.location_text || 'Cruz das Almas',
    issueDate: displayBirthDate(issueDate),
    certificateId: verificationCode,
    verificationUrl: previewMode
      ? 'liberado-apos-pagamento'
      : `https://training.infinity.dev.br/certificate?trackId=${track.id}&mode=final`,
    summaryLead: previewMode ? 'previa reservada para' : 'certifica que',
    validationCopy: previewMode
      ? `${track.preview_watermark}. Esta previa possui campos mascarados e nao substitui o certificado final.`
      : 'Certificado emitido pela Infinity Dev com codigo unico de verificacao e atividade final concluida.',
    previewMode,
    watermarkText: track.preview_watermark || 'PREVIA NAO VALIDA',
    signatures: signers,
    modules: Array.isArray(track.program) ? track.program : []
  };
}

module.exports = {
  buildCertificatePayload,
  displayBirthDate,
  generateVerificationCode,
  getTrackById,
  getTracksForUser,
  getUserCertificateState,
  parseJson,
  sanitizeTrack,
  slugify
};
