const mongoose = require('mongoose');

const SkillProgressSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Merujuk ke koleksi User LibreChat
    required: true,
    index: true,
  },
  conversationId: {
    type: String,
    required: true,
    index: true,
  },
  skillTreeData: {
    type: Array,
    default: [],
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('SkillProgress', SkillProgressSchema);