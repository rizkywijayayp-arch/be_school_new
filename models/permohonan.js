/**
 * Permohonan Model
 * Database model untuk permohonan surat
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Permohonan = sequelize.define('Permohonan', {
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

  // Jenis surat (slug untuk identifier)
  jenisSurat: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'izin_guru, keterangan_aktif, lomba, kjp_tutup, kjp_blokir, kjp_nama, kjp_atm, dispensasi, pengalaman, rekomendasi, rt_rw, domisili, legalisasi'
  },

  // Label human-readable
  jenisSuratLabel: {
    type: DataTypes.STRING(255),
    allowNull: false
  },

  // Data pemohon (JSON untuk fleksibilitas)
  dataPemohon: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Objek berisi data spesifik per jenis surat'
  },

  // Status permohonan
  status: {
    type: DataTypes.ENUM('pending', 'diproses', 'diterima', 'ditolak', 'selesai'),
    defaultValue: 'pending'
  },

  // Timeline
  tanggalPengajuan: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  tanggalProses: {
    type: DataTypes.DATE,
    allowNull: true
  },
  tanggalSelesai: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // Admin response
  catatanAdmin: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  diprosesOleh: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  // File hasil (URL ke surat yang sudah dibuat)
  fileSuratUrl: {
    type: DataTypes.STRING(500),
    allowNull: true
  },

  // Nomor surat (misal: 001/SK/A/2025)
  nomorSurat: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  // Kop Surat (URL gambar upload)
  kopSuratUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL gambar kop surat sekolah'
  },

  // Tanda Tangan Kepala Sekolah
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

  // Tanda Tangan Kepala Tata Usaha
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

  // Prioritas
  prioritas: {
    type: DataTypes.ENUM('normal', 'mendesak', 'menunggu'),
    defaultValue: 'normal'
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
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    { fields: ['schoolId'] },
    { fields: ['jenisSurat'] },
    { fields: ['status'] },
    { fields: ['tanggalPengajuan'] },
    { fields: ['schoolId', 'status'] }
  ]
});

module.exports = Permohonan;

/**
 * JENIS SURAT YANG TERSEDIA:
 *
 * 1. izin_guru        → Surat Izin Guru dan Pegawai
 * 2. keterangan_aktif → Surat Keterangan Aktif Sekolah
 * 3. keterangan_lulus → Surat Keterangan Lulus
 * 4. keterangan_pindah→ Surat Keterangan Pindah
 * 5. lomba            → Surat Keterangan Lomba (Team)
 * 6. kjp_tutup        → Surat Permohonan Tutup Buku Rekening KJP
 * 7. kjp_blokir       → Surat Permohonan Buka Blokir KJP
 * 8. kjp_nama         → Surat Permohonan Perubahan Nama / Wali KJP
 * 9. kjp_atm          → Surat Permohonan Ganti Buku / ATM Bank DKI KJP
 * 10. dispensasi       → Surat Dispensasi Siswa
 * 11. pengalaman       → Surat Keterangan Pengalaman
 * 12. rekomendasi      → Surat Rekomendasi
 * 13. rt_rw            → Surat Pengantar RT/RW
 * 14. domisili         → Surat Keterangan Domisili
 * 15. legalisasi       → Surat Permohonan Legalisasi
 */