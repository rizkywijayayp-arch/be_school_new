/**
 * Kelulusan Model
 * Database model untuk data kelulusan siswa
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Kelulusan = sequelize.define('Kelulusan', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },

  // Relasi ke sekolah
  schoolId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  // Data Siswa
  nama: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Nama lengkap siswa'
  },
  nisn: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'NISN 10 digit'
  },
  nis: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'NIS Sekolah'
  },
  jenjang: {
    type: DataTypes.ENUM('SD', 'SMP', 'SMA', 'SMK'),
    allowNull: false,
    comment: 'Jenjang pendidikan'
  },
  jurusan: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Jurusan/Paket Keahlian (untuk SMA/SMK)'
  },
  kelas: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Kelas terakhir'
  },
  tahunLulus: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Tahun kelulusan'
  },
  noIjazah: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Nomor Ijazah'
  },

  // Status Kelulusan
  status: {
    type: DataTypes.ENUM('lulus', 'tunda', 'mengulang'),
    defaultValue: 'tunda',
    comment: 'lulus=Printable, tunda=Belum bisa, mengulang=Harus ulangi'
  },

  // Catatan Admin
  catatanAdmin: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Catatan dari admin'
  },

  // TTD Surat
  nomorSurat: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Nomor surat keterangan lulus'
  },
  ttdKepalaSekolah: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nama Kepala Sekolah'
  },
  nipKepalaSekolah: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'NIP Kepala Sekolah'
  },
  ttdTataUsaha: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nama Kepala Tata Usaha'
  },
  nipTataUsaha: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'NIP Kepala Tata Usaha'
  },
  kopSuratUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL kop surat'
  },

  // Metadata
  ipAddress: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },

}, {
  tableName: 'kelulusans',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    { fields: ['schoolId'] },
    { fields: ['nisn'], unique: true },
    { fields: ['tahunLulus'] },
    { fields: ['jenjang'] },
    { fields: ['status'] },
    { fields: ['schoolId', 'tahunLulus'] },
    { fields: ['schoolId', 'status'] },
  ]
});

module.exports = Kelulusan;
