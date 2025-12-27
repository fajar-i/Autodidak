const SkillProgress = require('../../models/SkillProgress');
const { logger } = require('@librechat/data-schemas');

// --- 1. MODIFIKASI: Ubah nama root sedikit untuk bukti visual ---
const skillTreeData = [
    { 
      id: 'orientasi', 
      name: 'Orientasi Awal [BE]', // <--- TANDA BUKTI VISUAL 
      unlocked: true, 
      children: ['algoritma_dasar', 'pemrograman_dasar'], 
      icon: 'flag-checkered' 
    },
    // ... sisanya sama ...
    { id: 'algoritma_dasar', name: 'Algoritma & Logika', unlocked: false, children: ['representasi_algoritma', 'struktur_dasar_algoritma'], icon: 'brain' },
    { id: 'representasi_algoritma', name: 'Flowchart', unlocked: false, children: [], icon: 'file-tree' },
    { id: 'struktur_dasar_algoritma', name: 'Sekuensial', unlocked: false, children: ['struktur_data_fungsi'], icon: 'format-list-numbered' },
    { id: 'struktur_data_fungsi', name: 'Struktur Data', unlocked: false, children: ['list_array', 'dictionary_map', 'kompleksitas'], icon: 'database' },
    { id: 'list_array', name: 'List / Array', unlocked: false, children: [], icon: 'code-brackets' },
    { id: 'dictionary_map', name: 'Dictionary', unlocked: false, children: [], icon: 'book-open-page-variant' },
    { id: 'kompleksitas', name: 'Kompleksitas', unlocked: false, children: [], icon: 'chart-line' },
    { id: 'pemrograman_dasar', name: 'Sintaks Python', unlocked: false, children: ['variabel_tipe_data'], icon: 'zap' },
    { id: 'variabel_tipe_data', name: 'Variabel', unlocked: false, children: ['operator'], icon: 'code-brackets' },
    { id: 'operator', name: 'Operator', unlocked: false, children: ['percabangan'], icon: 'calculator' },
    { id: 'percabangan', name: 'Percabangan', unlocked: false, children: ['perulangan'], icon: 'call-split' },
    { id: 'perulangan', name: 'Perulangan', unlocked: false, children: ['fungsi'], icon: 'refresh' },
    { id: 'fungsi', name: 'Fungsi', unlocked: false, children: ['penerapan_algoritma'], icon: 'function' },
    { id: 'penerapan_algoritma', name: 'Studi Kasus', unlocked: false, children: ['searching', 'sorting'], icon: 'search' },
    { id: 'searching', name: 'Searching', unlocked: false, children: [], icon: 'search-circle' },
    { id: 'sorting', name: 'Sorting', unlocked: false, children: ['proyek_mini'], icon: 'sort-variant' },
    { id: 'proyek_mini', name: 'FINAL PROJECT', unlocked: false, children: [], icon: 'trophy-award' },
];

const getSkillProgress = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized access attempt to skill progress - no user found');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = req.user.id; 
    const { conversationId } = req.query;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    logger.debug(`Fetching skill progress for user ${userId}, conversation ${conversationId}`);

    const progress = await SkillProgress.findOne({ 
      user: userId, 
      conversationId 
    });

    // --- 2. MODIFIKASI: Logika return yang lebih tegas ---
    
    // Cek apakah progress ada DAN array skillTreeData-nya tidak kosong
    if (progress && progress.skillTreeData && progress.skillTreeData.length > 0) {
      logger.debug('Found existing progress in DB');
      
      // Kembalikan data dari DB
      res.status(200).json({
        ...progress.toObject(), // Convert mongoose doc ke object biasa
        source: 'database_record' // Flag untuk debug di frontend
      });
      
    } else {
      logger.debug('No progress found (or empty), returning DEFAULT BACKEND TREE');
      
      // Kembalikan Default Tree yang didefinisikan di atas
      res.status(200).json({
        conversationId,
        user: userId,
        skillTreeData: skillTreeData, // <--- INI DATA PENTINGNYA
        source: 'backend_default_template', // Flag bukti ini dari fallback backend
        lastUpdated: new Date()
      });
    }

  } catch (error) {
    logger.error('Error getting skill progress:', error);
    res.status(500).json({ message: 'Error retrieving skill progress' });
  }
};

const updateSkillProgress = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { conversationId, skillTreeData } = req.body;

    if (!conversationId) return res.status(400).json({ message: 'conversationId is required' });
    if (!skillTreeData) return res.status(400).json({ message: 'skillTreeData is required' });

    const updated = await SkillProgress.findOneAndUpdate(
      { user: userId, conversationId },
      { skillTreeData, lastUpdated: new Date() },
      { upsert: true, new: true }
    );

    res.status(200).json(updated);
  } catch (error) {
    logger.error('Error updating skill progress:', error);
    res.status(500).json({ message: 'Error updating skill progress' });
  }
};

module.exports = { getSkillProgress, updateSkillProgress };