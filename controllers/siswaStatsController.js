const Kehadiran = require('../models/kehadiran');
const Siswa = require('../models/siswa');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

class SiswaStatsController {
  // Helper: verify siswa belongs to school
  async _verifySiswaSchool(siswaId, schoolId) {
    const siswa = await Siswa.findByPk(siswaId, { attributes: ['id', 'schoolId'] });
    return siswa && siswa.schoolId === parseInt(schoolId);
  }

  // Get student streak (consecutive days present)
  async getStreak(req, res) {
    try {
      const { siswaId, schoolId } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!siswaId) return res.status(400).json({ success: false, message: 'siswaId required' });

      // Security: verify siswa belongs to school
      if (enforcedSchoolId) {
        const isValid = await this._verifySiswaSchool(siswaId, enforcedSchoolId);
        if (!isValid) return res.status(403).json({ success: false, message: 'Akses ditolak' });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const attendances = await Kehadiran.findAll({
        where: {
          siswaId: parseInt(siswaId),
          tanggal: { [Op.gte]: thirtyDaysAgo },
        },
        order: [['tanggal', 'DESC']],
      });

      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < attendances.length; i++) {
        const attDate = new Date(attendances[i].tanggal);
        attDate.setHours(0, 0, 0, 0);
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        if (attDate.getTime() === expectedDate.getTime() && attendances[i].status === 'hadir') {
          streak++;
        } else {
          break;
        }
      }

      return res.json({ success: true, data: { streak } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get on-time statistics
  async getTepatWaktu(req, res) {
    try {
      const { siswaId, schoolId } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!siswaId) return res.status(400).json({ success: false, message: 'siswaId required' });

      if (enforcedSchoolId) {
        const isValid = await this._verifySiswaSchool(siswaId, enforcedSchoolId);
        if (!isValid) return res.status(403).json({ success: false, message: 'Akses ditolak' });
      }

      const attendances = await Kehadiran.findAll({
        where: { siswaId: parseInt(siswaId) },
        limit: 30,
        order: [['tanggal', 'DESC']],
      });

      const total = attendances.length;
      const tepatWaktu = attendances.filter(a => a.status === 'hadir' && !a.terlambat).length;
      const persentase = total > 0 ? Math.round((tepatWaktu / total) * 100) : 0;

      return res.json({ success: true, data: { tepatWaktu, total, persentase } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get exemplary student data - MUST provide schoolId
  async getTeladan(req, res) {
    try {
      const { siswaId, limit = 10, schoolId } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId wajib diisi' });
      }

      // Get all siswa from this school
      const siswas = await Siswa.findAll({
        where: { schoolId: parseInt(enforcedSchoolId) },
        attributes: ['id']
      });
      const siswaIds = siswas.map(s => s.id);

      const students = await Kehadiran.findAll({
        attributes: ['siswaId'],
        where: { siswaId: { [Op.in]: siswaIds }, status: 'hadir' },
        group: ['siswaId'],
        order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']],
        limit: parseInt(limit),
      });

      const siswaIdsResult = students.map(s => s.siswaId);

      const studentStats = await Promise.all(
        siswaIdsResult.map(async (id) => {
          const total = await Kehadiran.count({ where: { siswaId: id, status: 'hadir' } });
          return { siswaId: id, totalHadir: total };
        })
      );

      studentStats.sort((a, b) => b.totalHadir - a.totalHadir);

      return res.json({ success: true, data: studentStats.slice(0, parseInt(limit)) });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get today's statistics
  async getTodayStats(req, res) {
    try {
      const { siswaId, schoolId } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!siswaId) return res.status(400).json({ success: false, message: 'siswaId required' });

      if (enforcedSchoolId) {
        const isValid = await this._verifySiswaSchool(siswaId, enforcedSchoolId);
        if (!isValid) return res.status(403).json({ success: false, message: 'Akses ditolak' });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayAttendance = await Kehadiran.findOne({
        where: {
          siswaId: parseInt(siswaId),
          tanggal: { [Op.gte]: today, [Op.lt]: tomorrow },
        },
      });

      return res.json({
        success: true,
        data: {
          tanggal: today,
          status: todayAttendance?.status || 'alpha',
          jamMasuk: todayAttendance?.jamMasuk || null,
          jamPulang: todayAttendance?.jamPulang || null,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get recap/summary for student
  async getRekapSaya(req, res) {
    try {
      const { siswaId, bulan, schoolId } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!siswaId) return res.status(400).json({ success: false, message: 'siswaId required' });

      if (enforcedSchoolId) {
        const isValid = await this._verifySiswaSchool(siswaId, enforcedSchoolId);
        if (!isValid) return res.status(403).json({ success: false, message: 'Akses ditolak' });
      }

      const whereClause = { siswaId: parseInt(siswaId) };
      if (bulan) {
        const [year, month] = bulan.split('-');
        const startDate = new Date(year, parseInt(month) - 1, 1);
        const endDate = new Date(year, parseInt(month), 0);
        whereClause.tanggal = { [Op.gte]: startDate, [Op.lte]: endDate };
      }

      const attendances = await Kehadiran.findAll({
        where: whereClause,
        order: [['tanggal', 'DESC']],
      });

      const stats = {
        hadir: attendances.filter(a => a.status === 'hadir').length,
        sakit: attendances.filter(a => a.status === 'sakit').length,
        izin: attendances.filter(a => a.status === 'izin').length,
        alpha: attendances.filter(a => a.status === 'alpha').length,
        total: attendances.length,
      };

      return res.json({ success: true, data: stats, attendances });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get all attendances for student
  async getAttendances(req, res) {
    try {
      const { siswaId, page = 1, limit = 30, schoolId } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!siswaId) return res.status(400).json({ success: false, message: 'siswaId required' });

      if (enforcedSchoolId) {
        const isValid = await this._verifySiswaSchool(siswaId, enforcedSchoolId);
        if (!isValid) return res.status(403).json({ success: false, message: 'Akses ditolak' });
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows } = await Kehadiran.findAndCountAll({
        where: { siswaId: parseInt(siswaId) },
        order: [['tanggal', 'DESC']],
        limit: parseInt(limit),
        offset,
      });

      return res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / parseInt(limit)),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get attendance report for admin dashboard (raw SQL)
  async getAttendanceReport(req, res) {
    try {
      const { schoolId, class: kelas, month, year, page = 1, limit = 50, date } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(200, Math.max(1, parseInt(limit)));
      const lim = Math.min(200, Math.max(1, parseInt(limit)));
      let where = `k.schoolId = ${parseInt(enforcedSchoolId)}`;
      if (month) where += ` AND MONTH(DATE(k.createdAt)) = ${parseInt(month)}`;
      if (year) where += ` AND YEAR(DATE(k.createdAt)) = ${parseInt(year)}`;
      if (date) where += ` AND DATE(k.createdAt) = '${date}'`;
      if (kelas) where += ` AND s.class = '${kelas.replace(/'/g, "''")}'`;

      const [rows] = await sequelize.query(`
        SELECT k.id, k.schoolId, k.studentId, k.status, k.createdAt as tanggal,
               s.name as siswaName, s.nis, s.class
        FROM kehadiran k
        LEFT JOIN siswa s ON k.studentId = s.id
        WHERE ${where}
        ORDER BY k.createdAt DESC
        LIMIT ${lim} OFFSET ${offset}
      `);

      const [countResult] = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM kehadiran k
        LEFT JOIN siswa s ON k.studentId = s.id
        WHERE ${where}
      `);

      const total = countResult?.[0]?.total || 0;

      return res.json({
        success: true,
        data: rows || [],
        pagination: {
          total,
          page: parseInt(page),
          limit: lim,
          pages: Math.ceil(total / lim),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get early warning for students with low attendance (raw SQL - no Sequelize associations needed)
  async getEarlyWarning(req, res) {
    try {
      const { schoolId } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

      const [rows] = await sequelize.query(`
        SELECT
          s.id as siswaId,
          s.name,
          s.nisn,
          COUNT(k.id) as totalDays,
          SUM(CASE WHEN k.status = 'hadir' THEN 1 ELSE 0 END) as hadirDays
        FROM siswa s
        LEFT JOIN kehadiran k ON s.id = k.studentId AND DATE(k.createdAt) >= '${dateStr}'
        WHERE s.schoolId = ${parseInt(enforcedSchoolId)} AND s.isActive = 1
        GROUP BY s.id, s.name, s.nisn
        HAVING totalDays > 0 AND (hadirDays / totalDays) < 0.9
        ORDER BY (hadirDays / totalDays) ASC
        LIMIT 100
      `);

      const warnings = (rows || []).map(r => {
        const totalDays = parseInt(r.totalDays) || 0;
        const hadirDays = parseInt(r.hadirDays) || 0;
        const presentRate = totalDays > 0 ? (hadirDays / totalDays) * 100 : 0;
        return {
          siswaId: r.siswaId,
          name: r.name,
          nisn: r.nisn,
          totalDays,
          hadirDays,
          presentRate: Math.round(presentRate),
          status: presentRate < 75 ? 'danger' : presentRate < 90 ? 'warning' : 'good'
        };
      });

      return res.json({ success: true, data: warnings });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get students with consecutive absent days (raw SQL)
  async getConsecutiveAbsent(req, res) {
    try {
      const { schoolId, minDays = 3, page = 1, limit = 20 } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - parseInt(minDays));
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
      const lim = Math.min(100, Math.max(1, parseInt(limit)));

      const [rows] = await sequelize.query(`
        SELECT
          s.id, s.name, s.nisn,
          SUM(CASE WHEN k.status != 'hadir' THEN 1 ELSE 0 END) as absentDays
        FROM siswa s
        LEFT JOIN kehadiran k ON s.id = k.studentId AND DATE(k.createdAt) >= '${dateStr}'
        WHERE s.schoolId = ${parseInt(enforcedSchoolId)} AND s.isActive = 1
        GROUP BY s.id, s.name, s.nisn
        HAVING absentDays >= ${parseInt(minDays)}
        ORDER BY absentDays DESC
        LIMIT ${lim} OFFSET ${offset}
      `);

      return res.json({ success: true, data: rows || [] });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get students with low attendance rate (raw SQL)
  async getLowAttendance(req, res) {
    try {
      const { schoolId, threshold = 75, page = 1, limit = 20 } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
      const lim = Math.min(100, Math.max(1, parseInt(limit)));

      const [rows] = await sequelize.query(`
        SELECT
          s.id, s.name, s.nisn,
          COUNT(k.id) as totalDays,
          SUM(CASE WHEN k.status = 'hadir' THEN 1 ELSE 0 END) as hadir
        FROM siswa s
        LEFT JOIN kehadiran k ON s.id = k.studentId AND DATE(k.createdAt) >= '${dateStr}'
        WHERE s.schoolId = ${parseInt(enforcedSchoolId)} AND s.isActive = 1
        GROUP BY s.id, s.name, s.nisn
        HAVING totalDays > 0 AND (SUM(CASE WHEN k.status = 'hadir' THEN 1 ELSE 0 END) / totalDays) < ${parseFloat(threshold) / 100}
        ORDER BY (SUM(CASE WHEN k.status = 'hadir' THEN 1 ELSE 0 END) / totalDays) ASC
        LIMIT ${lim} OFFSET ${offset}
      `);

      const data = (rows || []).map(r => {
        const totalDays = parseInt(r.totalDays) || 0;
        const hadir = parseInt(r.hadir) || 0;
        const presentRate = totalDays > 0 ? Math.round((hadir / totalDays) * 100) : 0;
        return { ...r, totalDays, hadir, presentRate };
      });

      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get students with frequent late arrivals (raw SQL)
  async getFrequentLate(req, res) {
    try {
      const { schoolId, minPerWeek = 2, page = 1, limit = 20 } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
      const lim = Math.min(100, Math.max(1, parseInt(limit)));

      const [rows] = await sequelize.query(`
        SELECT
          s.id, s.name, s.nisn,
          COUNT(k.id) as lateCount
        FROM siswa s
        LEFT JOIN kehadiran k ON s.id = k.studentId AND DATE(k.createdAt) >= '${dateStr}' AND k.status = 'terlambat'
        WHERE s.schoolId = ${parseInt(enforcedSchoolId)} AND s.isActive = 1
        GROUP BY s.id, s.name, s.nisn
        HAVING lateCount >= ${parseInt(minPerWeek)}
        ORDER BY lateCount DESC
        LIMIT ${lim} OFFSET ${offset}
      `);

      const data = (rows || []).map(r => ({ ...r, lateCount: parseInt(r.lateCount) || 0 }));
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get recap per class (raw SQL - no Sequelize model associations needed)
  async getRecapKelas(req, res) {
    try {
      const { schoolId, date } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      const dateFilter = date ? ` AND DATE(k.createdAt) = '${date}'` : '';

      const [rows] = await sequelize.query(`
        SELECT
          k.currentClass as namaKelas,
          COUNT(DISTINCT s.id) as totalSiswa,
          COUNT(k.id) as totalKehadiran,
          SUM(CASE WHEN k.status = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN k.status = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN k.status = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN k.status = 'alpha' THEN 1 ELSE 0 END) as alpha,
          SUM(CASE WHEN k.status = 'terlambat' THEN 1 ELSE 0 END) as terlambat
        FROM kehadiran k
        LEFT JOIN siswa s ON k.studentId = s.id AND s.isActive = 1 ${dateFilter}
        WHERE k.schoolId = ${parseInt(enforcedSchoolId)} ${dateFilter}
        GROUP BY k.currentClass
        ORDER BY k.currentClass ASC
        LIMIT 100
      `);

      const recap = (rows || []).map(r => {
        const totalSiswa = parseInt(r.totalSiswa) || 0;
        const hadir = parseInt(r.hadir) || 0;
        return {
          namaKelas: r.namaKelas,
          totalSiswa,
          hadir,
          izin: parseInt(r.izin) || 0,
          sakit: parseInt(r.sakit) || 0,
          alpha: parseInt(r.alpha) || 0,
          terlambat: parseInt(r.terlambat) || 0,
          presentRate: totalSiswa > 0 ? Math.round((hadir / totalSiswa) * 100) : 0
        };
      });

      return res.json({ success: true, data: recap });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get global statistics (raw SQL)
  async getGlobalStats(req, res) {
    try {
      const { schoolId } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

      const [totalResult] = await sequelize.query(`
        SELECT COUNT(*) as total FROM siswa WHERE schoolId = ${parseInt(enforcedSchoolId)} AND isActive = 1
      `);
      const totalSiswa = totalResult?.[0]?.total || 0;

      const [statsResult] = await sequelize.query(`
        SELECT
          COUNT(*) as totalAttendances,
          SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN status = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN status = 'alpha' THEN 1 ELSE 0 END) as alpha,
          SUM(CASE WHEN status = 'terlambat' THEN 1 ELSE 0 END) as terlambat
        FROM kehadiran k
        LEFT JOIN siswa s ON k.studentId = s.id
        WHERE k.schoolId = ${parseInt(enforcedSchoolId)} AND DATE(k.createdAt) >= '${dateStr}'
      `);

      const stats = statsResult?.[0] || {};
      const totalAttendances = parseInt(stats.totalAttendances) || 0;
      const hadir = parseInt(stats.hadir) || 0;
      const izin = parseInt(stats.izin) || 0;
      const sakit = parseInt(stats.sakit) || 0;
      const alpha = parseInt(stats.alpha) || 0;
      const terlambat = parseInt(stats.terlambat) || 0;

      return res.json({
        success: true,
        data: {
          totalSiswa,
          totalAttendances,
          hadir,
          izin,
          sakit,
          alpha,
          terlambat,
          presentRate: totalAttendances > 0 ? Math.round((hadir / totalAttendances) * 100) : 0,
          period: '30 days'
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Search siswa by name or nisn
  async searchSiswa(req, res) {
    try {
      const { schoolId, q } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      if (!q || q.length < 2) {
        return res.status(400).json({ success: false, message: 'Search query min 2 characters' });
      }

      const students = await Siswa.findAll({
        where: {
          schoolId: parseInt(enforcedSchoolId),
          [Op.or]: [
            { name: { [Op.like]: `%${q}%` } },
            { nisn: { [Op.like]: `%${q}%` } }
          ]
        },
        attributes: ['id', 'name', 'nisn', 'photoUrl'],
        limit: 20
      });

      return res.json({ success: true, data: students });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Share recap progress via WhatsApp (raw SQL)
  async shareRekapProgress(req, res) {
    try {
      const { schoolId } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

      const [totalResult] = await sequelize.query(`
        SELECT COUNT(*) as total FROM siswa WHERE schoolId = ${parseInt(enforcedSchoolId)} AND isActive = 1
      `);
      const totalSiswa = totalResult?.[0]?.total || 0;

      const [statsResult] = await sequelize.query(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN k.status = 'hadir' THEN 1 ELSE 0 END) as hadir
        FROM kehadiran k
        LEFT JOIN siswa s ON k.studentId = s.id
        WHERE k.schoolId = ${parseInt(enforcedSchoolId)} AND DATE(k.createdAt) >= '${dateStr}'
      `);

      const stats = statsResult?.[0] || {};
      const total = parseInt(stats.total) || 0;
      const hadir = parseInt(stats.hadir) || 0;
      const presentRate = total > 0 ? Math.round((hadir / total) * 100) : 0;

      const recapText = `📊 *Rekap Kehadiran 30 Hari*\n\n` +
        `🏫 Total Siswa: ${totalSiswa}\n` +
        `✅ Hadir: ${hadir}\n` +
        `📈 Kehadiran: ${presentRate}%\n\n` +
        `_Dikirim dari Xpresensi_`;

      return res.json({ success: true, data: { text: recapText } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Share recap via specific channel (raw SQL)
  async shareRekap(req, res) {
    try {
      const { schoolId, date, via } = req.query;
      const enforcedSchoolId = schoolId || req.enforcedSchoolId;

      if (!enforcedSchoolId) {
        return res.status(400).json({ success: false, message: 'schoolId required' });
      }

      let dateFilter = '';
      if (date) dateFilter = ` AND DATE(k.createdAt) = '${date}'`;

      const [rows] = await sequelize.query(`
        SELECT
          s.class as kelas,
          COUNT(DISTINCT s.id) as total,
          SUM(CASE WHEN k.status = 'hadir' THEN 1 ELSE 0 END) as hadir
        FROM siswa s
        LEFT JOIN kehadiran k ON s.id = k.studentId ${dateFilter.replace(' AND ', ' AND k.')}
        WHERE s.schoolId = ${parseInt(enforcedSchoolId)} AND s.isActive = 1 ${dateFilter}
        GROUP BY s.class
        ORDER BY s.class ASC
      `);

      const recap = (rows || []).map(r => {
        const total = parseInt(r.total) || 0;
        const hadir = parseInt(r.hadir) || 0;
        return {
          kelas: r.kelas,
          hadir,
          total,
          rate: total > 0 ? Math.round((hadir / total) * 100) : 0
        };
      });

      return res.json({ success: true, data: { recap, via: via || 'wa' } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new SiswaStatsController();
