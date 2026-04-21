const { Catatan, CatatanGuru } = require('../models/catatan');
const { BkAssessments } = require('../models/bk_assessments');
const { Op } = require('sequelize');

class CatatanController {
  // Get catatan siswa
  async getCatatanSiswa(req, res) {
    try {
      const { siswaId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows } = await Catatan.findAndCountAll({
        where: { siswaId: parseInt(siswaId) },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset,
      });

      return res.json({
        success: true,
        data: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Create catatan siswa
  async createCatatanSiswa(req, res) {
    try {
      const { siswaId, guruId, kelasId, catatan, kategori } = req.body;

      const data = await Catatan.create({
        siswaId: parseInt(siswaId),
        guruId: parseInt(guruId),
        kelasId: parseInt(kelasId),
        catatan,
        kategori,
      });

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get catatan guru (catatan from guru about students)
  async getCatatanGuru(req, res) {
    try {
      const { guruId } = req.params;
      const { kelasId, date } = req.query;

      const where = { guruId: parseInt(guruId) };
      if (kelasId) where.kelasId = parseInt(kelasId);
      if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt = { [Op.gte]: startDate, [Op.lt]: endDate };
      }

      const catatans = await CatatanGuru.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: 100,
      });

      return res.json({ success: true, data: catatans });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Create catatan guru
  async createCatatanGuru(req, res) {
    try {
      const { siswaId, guruId, kelasId, catatan, kategori } = req.body;

      const data = await CatatanGuru.create({
        siswaId: parseInt(siswaId),
        guruId: parseInt(guruId),
        kelasId: parseInt(kelasId),
        catatan,
        kategori,
      });

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get BK assessments for siswa
  async getBkAssessments(req, res) {
    try {
      const { siswaId } = req.params;
      const { tipo } = req.query;

      const where = { siswaId: parseInt(siswaId) };
      if (tipo) where.tipo = tipo;

      const assessments = await BkAssessments.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: 100,
      });

      return res.json({ success: true, data: assessments });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Create BK assessment
  async createBkAssessment(req, res) {
    try {
      const { siswaId, guruId, tipo, descripcion, fecha, estado } = req.body;

      const data = await BkAssessments.create({
        siswaId: parseInt(siswaId),
        guruId: parseInt(guruId),
        tipo,
        descripcion,
        fecha,
        estado,
      });

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new CatatanController();