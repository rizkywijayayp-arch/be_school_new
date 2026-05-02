require('dotenv').config();
const db = require('./config/database.js');

async function run() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS klasifikasi_surat (
      id INT AUTO_INCREMENT PRIMARY KEY,
      schoolId INT NOT NULL,
      kode VARCHAR(30) NOT NULL,
      nama VARCHAR(255) NOT NULL,
      kategori ENUM('keluar','masuk','internal') DEFAULT 'keluar',
      keterangan TEXT,
      isActive TINYINT(1) DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_schoolid (schoolId),
      INDEX idx_kategori (kategori),
      UNIQUE KEY uk_school_kode (schoolId, kode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS arsip_surat (
      id INT AUTO_INCREMENT PRIMARY KEY,
      schoolId INT NOT NULL,
      kategori ENUM('keluar','masuk','internal') NOT NULL DEFAULT 'keluar',
      nomor_surat VARCHAR(150),
      klasifikasi_id INT,
      tanggal_surat DATE NOT NULL,
      tanggal_input DATETIME DEFAULT CURRENT_TIMESTAMP,
      hal VARCHAR(500) NOT NULL,
      ringkasan TEXT,
      pengirim VARCHAR(255),
      tujuan VARCHAR(255),
      tempat VARCHAR(100),
      jumlah_lampiran INT DEFAULT 0,
      lampiran_file VARCHAR(500),
      penandatangan VARCHAR(255),
      nip_penandatangan VARCHAR(50),
      jabatan_penandatangan VARCHAR(100) DEFAULT 'Kepala Sekolah',
      kop_surat_url VARCHAR(500),
      ttd_image_url VARCHAR(500),
      status ENUM('draft','arsip','diteruskan') DEFAULT 'arsip',
      permohonan_id INT,
      klasifikasi_kode VARCHAR(30),
      deletedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_schoolid (schoolId),
      INDEX idx_kategori (kategori),
      INDEX idx_tanggal (tanggal_surat),
      INDEX idx_nomor (nomor_surat),
      INDEX idx_status (status),
      INDEX idx_permohonan (permohonan_id),
      INDEX idx_klasifikasi (klasifikasi_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS disposisi_surat (
      id INT AUTO_INCREMENT PRIMARY KEY,
      schoolId INT NOT NULL,
      surat_id INT NOT NULL,
      dari_user VARCHAR(255) NOT NULL,
      kepada_user VARCHAR(255) NOT NULL,
      instruksi TEXT,
      tanggal_disposisi DATETIME DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_surat (surat_id),
      INDEX idx_schoolid (schoolId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const q of queries) {
    try {
      await db.query(q);
      const firstLine = q.split('\n')[0];
      console.log('OK: ' + firstLine.substring(0, 50));
    } catch(e) {
      console.log('ERR: ' + e.message.substring(0, 120));
    }
  }

  const defaultKlasifikasi = [
    ['432.1', 'Surat Keterangan', 'keluar', 'Surat keterangan aktif, lulus, pindah'],
    ['432.2', 'Legalisasi', 'keluar', 'Legalisasi dokumen'],
    ['432.3', 'Surat Pindah / Mutasi', 'keluar', 'Surat keterangan pindah'],
    ['432.4', 'Undangan', 'keluar', 'Surat undangan'],
    ['432.5', 'Surat Dinas', 'keluar', 'Surat keluar kantor'],
    ['432.6', 'Surat Edaran', 'keluar', 'Surat edaran'],
    ['432.7', 'Surat Permohonan', 'keluar', 'Surat permohonan ke instansi lain'],
    ['432.8', 'Surat Rekomendasi', 'keluar', 'Surat rekomendasi'],
    ['001', 'Surat Masuk', 'masuk', 'Surat masuk dari luar'],
    ['002', 'Undangan Masuk', 'masuk', 'Undangan masuk'],
    ['003', 'Memo Internal', 'internal', 'Memo / surat internal'],
  ];

  for (const row of defaultKlasifikasi) {
    try {
      await db.query(
        'INSERT IGNORE INTO klasifikasi_surat (schoolId, kode, nama, kategori, keterangan, isActive) VALUES (?, ?, ?, ?, ?, 1)',
        [1, row[0], row[1], row[2], row[3]]
      );
      console.log('INSERT: ' + row[1]);
    } catch(e) {
      console.log('INSERT SKIP: ' + row[1] + ' - ' + e.message.substring(0, 60));
    }
  }

  console.log('ALL DONE');
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });