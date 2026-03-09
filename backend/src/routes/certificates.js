const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../auth');
const { buildCertificatePayload, getUserCertificateState, getTracksForUser } = require('../services/certificates');

const router = express.Router();

function normalizePaymentMethod(value) {
  const method = String(value || '').trim().toLowerCase();
  return method === 'pix' || method === 'card' ? method : null;
}

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const tracks = getTracksForUser(db, req.user.id);
  res.json({ tracks });
});

router.post('/:id/submit-final-activity', requireAuth, (req, res) => {
  const db = getDb();
  const trackId = Number(req.params.id);
  const submissionText = String(req.body?.submissionText || '').trim();
  if (!trackId) {
    return res.status(400).json({ error: 'Certificado invalido' });
  }
  if (submissionText.length < 20) {
    return res.status(400).json({ error: 'Descreva a atividade final com mais detalhes' });
  }

  const state = getUserCertificateState(db, trackId, req.user.id);
  if (!state || !state.track || !state.track.active) {
    return res.status(404).json({ error: 'Certificado nao encontrado' });
  }

  if (state.submission) {
    db.prepare(
      `UPDATE certificate_submissions
       SET submission_text = ?, updated_at = datetime('now')
       WHERE certificate_id = ? AND user_id = ?`
    ).run(submissionText, trackId, req.user.id);
  } else {
    db.prepare(
      `INSERT INTO certificate_submissions (certificate_id, user_id, submission_text, updated_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run(trackId, req.user.id, submissionText);
  }

  res.json({ ok: true });
});

router.post('/:id/payment', requireAuth, (req, res) => {
  const db = getDb();
  const trackId = Number(req.params.id);
  const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
  if (!trackId) {
    return res.status(400).json({ error: 'Certificado invalido' });
  }
  if (!paymentMethod) {
    return res.status(400).json({ error: 'Metodo de pagamento invalido' });
  }

  const state = getUserCertificateState(db, trackId, req.user.id);
  if (!state || !state.track || !state.track.active) {
    return res.status(404).json({ error: 'Certificado nao encontrado' });
  }
  if (!state.submission) {
    return res.status(400).json({ error: 'Conclua a atividade final antes de solicitar o pagamento' });
  }

  if (state.order) {
    db.prepare(
      `UPDATE certificate_orders
       SET payment_method = ?, status = CASE WHEN status = 'paid' THEN 'paid' ELSE 'pending' END,
           amount_cents = ?, updated_at = datetime('now')
       WHERE certificate_id = ? AND user_id = ?`
    ).run(paymentMethod, state.track.price_cents, trackId, req.user.id);
  } else {
    db.prepare(
      `INSERT INTO certificate_orders (certificate_id, user_id, payment_method, status, amount_cents, updated_at)
       VALUES (?, ?, ?, 'pending', ?, datetime('now'))`
    ).run(trackId, req.user.id, paymentMethod, state.track.price_cents);
  }

  const order = db
    .prepare('SELECT id, payment_method, status, amount_cents, paid_at, issued_at FROM certificate_orders WHERE certificate_id = ? AND user_id = ?')
    .get(trackId, req.user.id);

  res.json({
    order: {
      ...order,
      amount_cents: Number(order.amount_cents || 0)
    }
  });
});

router.get('/:id/render', requireAuth, (req, res) => {
  const db = getDb();
  const trackId = Number(req.params.id);
  const mode = req.query.mode === 'final' ? 'final' : 'preview';
  if (!trackId) {
    return res.status(400).json({ error: 'Certificado invalido' });
  }

  const state = getUserCertificateState(db, trackId, req.user.id);
  if (!state || !state.track || !state.track.active) {
    return res.status(404).json({ error: 'Certificado nao encontrado' });
  }
  if (!state.submission) {
    return res.status(403).json({ error: 'Conclua a atividade final para liberar a previa' });
  }
  if (mode === 'final' && !state.certificate_ready) {
    return res.status(403).json({ error: 'Pagamento pendente para liberar o certificado final' });
  }

  const user = db
    .prepare('SELECT id, username, email, full_name, document_id, birth_date FROM users WHERE id = ?')
    .get(req.user.id);

  const certificate = buildCertificatePayload(state.track, user, {
    previewMode: mode !== 'final',
    verificationCode: state.order?.verification_code || null,
    issueDate: (state.order?.issued_at || state.order?.paid_at || new Date().toISOString()).slice(0, 10)
  });

  res.json({
    certificate,
    state: {
      preview_ready: state.preview_ready,
      certificate_ready: state.certificate_ready,
      payment_status: state.order?.status || 'not_requested'
    }
  });
});

module.exports = router;
