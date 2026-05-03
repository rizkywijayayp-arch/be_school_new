/**
 * models/index.js — Central model registry
 * Initializes ALL Sequelize models so they get proper prototype methods (findAll, create, etc.)
 * and so associations are set up. Every model in this file will be registered with sequelize.models.
 * Controllers can safely require individual models and they will have full Sequelize methods.
 */
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// ── Factory-function models (must be called with (sequelize, DataTypes)) ──
// These use module.exports = (sequelize, DataTypes) => { return sequelize.define(...) }
const IzinModel = require('./izin');
const NilaiModel = require('./nilai');
const PlacesModel = require('./places');
const AppContentModel = require('./appContent');

// ── Standard Sequelize model classes ──────────────────────────────────────
const SchoolAccount = require('./auth');
const Student = require('./siswa');
const Parent = require('./orangTua');
const GuruTendik = require('./guruTendik');
const Kelas = require('./kelas');
const Siswa = require('./siswa');
const Presence = require('./presence');
const Announcement = require('./pengumuman');
const Berita = require('./berita');
const Album = require('./album');
const GalleryItem = require('./galleryItem');
const Ekstrakurikuler = require('./ekstrakurikuler');
const Osis = require('./osis');
const Ppdb = require('./ppdb');
const Kelulusan = require('./kelulusan');
const Alumni = require('./alumni');
const ProfileSekolah = require('./profileSekolah');
const Visimisi = require('./visiMisi');
const Fasilitas = require('./fasilitas');
const Kalender = require('./kalender');
const Jadwal = require('./jadwal');
const Curriculum = require('./kurikulum');
const PpId = require('./ppid');
const Prestation = require('./prestasi');
const Layanan = require('./layanan');
const organisasi = require('./organisasi');
const Voting = require('./voting');
const TanyaJawab = require('./faq');
const Aturan = require('./rule');
const Makanan = require('./makanan');
const { Perpustakaan, Peminjaman } = require('./perpustakaan');
const Activities = require('./activities');
const Notifications = require('./notifications');
const Tuition = require('./tuition');
const Apresiasi = require('./apresiasi');
const Feed = require('./feed');
const AuditLog = require('./auditLog');
const Sokrates = require('./sos');
const { Catatan, CatatanGuru } = require('./catatan');
const { Kuis, Soal, HasilKuis } = require('./kuis');
const { SchoolZones, SafeZones, ZoneAlerts } = require('./zones');
const Materi = require('./materi');
const Tugas = require('./tugas');
const Tenant = require('./tenant');

// ── Initialize factory-function models ────────────────────────────────────
// These are defined with module.exports = (sequelize, DataTypes) => {...}
// They must be called once so sequelize registers them in models
const Izin = IzinModel(sequelize, DataTypes);
const Nilai = NilaiModel(sequelize, DataTypes);
const Places = PlacesModel(sequelize, DataTypes);
const AppContent = AppContentModel(sequelize, DataTypes);

// ── Associations ─────────────────────────────────────────────────────────
Parent.hasMany(Student, { foreignKey: 'parentId', as: 'children' });
Student.belongsTo(Parent, { foreignKey: 'parentId', as: 'parent' });

Student.hasMany(Izin, { foreignKey: 'siswaId', as: 'izins' });
Izin.belongsTo(Student, { foreignKey: 'siswaId', as: 'Siswa' });

// ── Re-export sequelize (now all models are registered) ─────────────────
module.exports = sequelize;