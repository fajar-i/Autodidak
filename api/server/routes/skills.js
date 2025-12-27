const express = require('express');
const router = express.Router();
const { getSkillProgress, updateSkillProgress } = require('../controllers/SkillController');
// Gunakan path yang sama dengan yang ada di share.js Anda
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');

// Pola session yang sama dengan rute /api/share
router.get('/', requireJwtAuth, getSkillProgress);
router.post('/', requireJwtAuth, updateSkillProgress);

module.exports = router;