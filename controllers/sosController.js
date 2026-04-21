const SOS = require('../models/sos');
const { Op } = require('sequelize');

class SOSController {
  async panic(req, res) {
    try {
      const { siswaId, latitude, longitude, message } = req.body;

      const sos = await SOS.create({
        siswaId: parseInt(siswaId),
        latitude,
        longitude,
        message,
        status: 'active',
      });

      return res.json({ success: true, data: sos, message: 'SOS sent' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async checkStatus(req, res) {
    try {
      const { siswaId } = req.params;

      const sos = await SOS.findOne({
        where: {
          siswaId: parseInt(siswaId),
          status: 'active',
        },
        order: [['createdAt', 'DESC']],
      });

      return res.json({ success: true, data: { isActive: !!sos, lastSos: sos } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  async getHistory(req, res) {
    try {
      const { siswaId } = req.params;
      const { limit = 20 } = req.query;

      const history = await SOS.findAll({
        where: { siswaId: parseInt(siswaId) },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
      });

      return res.json({ success: true, data: history });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new SOSController();