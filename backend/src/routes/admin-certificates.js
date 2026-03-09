const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { generateVerificationCode, parseJson, sanitizeTrack, slugify } = require('../services/certificates');

const router = express.Router();

function normalizeInt(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeTrackPayload(payload = {}) {
  const title = String(payload.title || '').trim();
  const slug = String(payload.slug || slugify(title)).trim();
  const totalHours = normalizeInt(payload.total_hours);
  const priceCents = normalizeInt(payload.price_cents, 0);

  if (!title) throw new Error('Titulo obrigatorio');
  if (!slug) throw new Error('Slug obrigatorio');
  if (!totalHours || totalHours < 1) throw new Error('Carga horaria invalida');
  if (priceCents === null || priceCents < 0) throw new Error('Preco invalido');
  if (!String(payload.final_activity_title || '').trim()) throw new Error('Titulo da atividade final obrigatorio');
  if (!String(payload.final_activity_instructions || '').trim()) throw new Error('Instrucao da atividade final obrigatoria');

  const program = Array.isArray(payload.program)
    ? payload.program
    : parseJson(payload.program_json, []);
  const signers = Array.isArray(payload.signers)
    ? payload.signers
    : parseJson(payload.signers_json, []);

  return {
    slug,
    title,
    description: String(payload.description || '').trim(),
    total_hours: totalHours,
    price_cents: priceCents,
    location_text: String(payload.location_text || 'Cruz das Almas').trim(),
    final_activity_title: String(payload.final_activity_title || '').trim(),
    final_activity_instructions: String(payload.final_activity_instructions || '').trim(),
    preview_watermark: String(payload.preview_watermark || 'PREVIA NAO VALIDA').trim(),
    active: payload.active === undefined ? 1 : payload.active ? 1 : 0,
    program_json: JSON.stringify(program),
    signers_json: JSON.stringify(signers)
  };
}

router.get('/', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT t.*,
            (
              SELECT COUNT(*)
              FROM certificate_submissions s
              WHERE s.certificate_id = t.id
            ) AS submissions_count,
            (
              SELECT COUNT(*)
              FROM certificate_orders o
              WHERE o.certificate_id = t.id AND o.status = 'pending'
            ) AS pending_payments,
            (
              SELECT COUNT(*)
              FROM certificate_orders o
              WHERE o.certificate_id = t.id AND o.status = 'paid'
            ) AS paid_certificates
     FROM certificate_tracks t
     ORDER BY t.created_at DESC, t.id DESC`
  ).all();

  res.json({
    tracks: rows.map((row) => ({
      ...sanitizeTrack(row),
      submissions_count: Number(row.submissions_count || 0),
      pending_payments: Number(row.pending_payments || 0),
      paid_certificates: Number(row.paid_certificates || 0)
    }))
  });
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  let payload;
  try {
    payload = normalizeTrackPayload(req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const existing = db.prepare('SELECT id FROM certificate_tracks WHERE slug = ?').get(payload.slug);
  if (existing) {
    return res.status(409).json({ error: 'Slug ja cadastrado' });
  }

  const info = db.prepare(
    `INSERT INTO certificate_tracks
      (slug, title, description, total_hours, price_cents, location_text, final_activity_title,
       final_activity_instructions, program_json, signers_json, preview_watermark, active, created_by_user_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    payload.slug,
    payload.title,
    payload.description,
    payload.total_hours,
    payload.price_cents,
    payload.location_text,
    payload.final_activity_title,
    payload.final_activity_instructions,
    payload.program_json,
    payload.signers_json,
    payload.preview_watermark,
    payload.active,
    req.user.id
  );

  const row = db.prepare('SELECT * FROM certificate_tracks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ track: sanitizeTrack(row) });
});

router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const trackId = Number(req.params.id);
  if (!trackId) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  const existing = db.prepare('SELECT * FROM certificate_tracks WHERE id = ?').get(trackId);
  if (!existing) {
    return res.status(404).json({ error: 'Certificado nao encontrado' });
  }

  let payload;
  try {
    payload = normalizeTrackPayload({ ...existing, ...req.body });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const conflict = db
    .prepare('SELECT id FROM certificate_tracks WHERE slug = ? AND id <> ?')
    .get(payload.slug, trackId);
  if (conflict) {
    return res.status(409).json({ error: 'Slug ja cadastrado' });
  }

  db.prepare(
    `UPDATE certificate_tracks
     SET slug = ?, title = ?, description = ?, total_hours = ?, price_cents = ?, location_text = ?,
         final_activity_title = ?, final_activity_instructions = ?, program_json = ?, signers_json = ?,
         preview_watermark = ?, active = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    payload.slug,
    payload.title,
    payload.description,
    payload.total_hours,
    payload.price_cents,
    payload.location_text,
    payload.final_activity_title,
    payload.final_activity_instructions,
    payload.program_json,
    payload.signers_json,
    payload.preview_watermark,
    payload.active,
    trackId
  );

  const row = db.prepare('SELECT * FROM certificate_tracks WHERE id = ?').get(trackId);
  res.json({ track: sanitizeTrack(row) });
});

router.get('/orders/list', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT o.id, o.certificate_id, o.user_id, o.payment_method, o.status, o.amount_cents,
            o.verification_code, o.created_at, o.paid_at, o.issued_at,
            t.title AS certificate_title, t.total_hours,
            u.username, u.email, u.full_name,
            s.submission_text, s.created_at AS submission_created_at
     FROM certificate_orders o
     JOIN certificate_tracks t ON t.id = o.certificate_id
     JOIN users u ON u.id = o.user_id
     LEFT JOIN certificate_submissions s ON s.certificate_id = o.certificate_id AND s.user_id = o.user_id
     ORDER BY CASE o.status WHEN 'pending' THEN 0 WHEN 'paid' THEN 1 ELSE 2 END, o.created_at DESC`
  ).all();

  res.json({
    orders: rows.map((row) => ({
      ...row,
      amount_cents: Number(row.amount_cents || 0)
    }))
  });
});

router.post('/orders/:orderId/mark-paid', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const orderId = Number(req.params.orderId);
  if (!orderId) {
    return res.status(400).json({ error: 'orderId invalido' });
  }

  const order = db.prepare('SELECT * FROM certificate_orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Pedido nao encontrado' });
  }

  const verificationCode = order.verification_code || generateVerificationCode(order.certificate_id, order.user_id);

  db.prepare(
    `UPDATE certificate_orders
     SET status = 'paid', verification_code = ?, paid_at = datetime('now'), issued_at = COALESCE(issued_at, datetime('now')), updated_at = datetime('now')
     WHERE id = ?`
  ).run(verificationCode, orderId);

  const updated = db.prepare('SELECT * FROM certificate_orders WHERE id = ?').get(orderId);
  res.json({ order: updated });
});

module.exports = router;
