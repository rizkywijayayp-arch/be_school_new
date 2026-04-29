const Content = require('../models/appContent');

const contentController = {
  // Get all content
  async getAll(req, res) {
    try {
      const contents = await Content.findAll({
        where: { is_active: true },
        attributes: ['id', 'type', 'title', 'sections', 'faqs', 'contact_info', 'version', 'updated_at'],
      });
      res.json({ success: true, data: contents });
    } catch (error) {
      console.error('Error fetching contents:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil data konten' });
    }
  },

  // Get single content by type
  async getByType(req, res) {
    try {
      const { type } = req.params;
      const content = await Content.findOne({
        where: { type, is_active: true },
        attributes: ['id', 'type', 'title', 'sections', 'faqs', 'contact_info', 'version', 'updated_at'],
      });

      if (!content) {
        return res.status(404).json({ success: false, message: 'Konten tidak ditemukan' });
      }

      res.json({ success: true, data: content });
    } catch (error) {
      console.error('Error fetching content:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil data konten' });
    }
  },

  // Create or update content (admin only)
  async upsert(req, res) {
    try {
      const { type, title, sections, faqs, contact_info, version } = req.body;

      if (!type) {
        return res.status(400).json({ success: false, message: 'Type wajib diisi' });
      }

      const [content, created] = await Content.findOrCreate({
        where: { type },
        defaults: { title, sections, faqs, contact_info, version, is_active: true },
      });

      if (!created) {
        await content.update({
          title: title || content.title,
          sections: sections || content.sections,
          faqs: faqs || content.faqs,
          contact_info: contact_info || content.contact_info,
          version: version || content.version,
        });
      }

      res.json({
        success: true,
        message: created ? 'Konten berhasil dibuat' : 'Konten berhasil diperbarui',
        data: content,
      });
    } catch (error) {
      console.error('Error upserting content:', error);
      res.status(500).json({ success: false, message: 'Gagal menyimpan konten' });
    }
  },

  // Toggle active status
  async toggleActive(req, res) {
    try {
      const { type } = req.params;
      const content = await Content.findOne({ where: { type } });

      if (!content) {
        return res.status(404).json({ success: false, message: 'Konten tidak ditemukan' });
      }

      await content.update({ is_active: !content.is_active });

      res.json({
        success: true,
        message: `Konten berhasil ${content.is_active ? 'diaktifkan' : 'dinonaktifkan'}`,
      });
    } catch (error) {
      console.error('Error toggling content:', error);
      res.status(500).json({ success: false, message: 'Gagal update konten' });
    }
  },

  // Seed default content
  async seedDefaults(req, res) {
    try {
      const defaults = [
        {
          type: 'privacy_policy',
          title: 'Kebijakan Privasi',
          sections: [
            { title: '1. Pengumpulan Data', content: 'Kami mengumpulkan informasi yang Anda berikan secara langsung, seperti nama, email, dan data sekolah untuk memberikan layanan terbaik.' },
            { title: '2. Penggunaan Data', content: 'Data digunakan untuk personalisasi pengalaman, notifikasi penting, dan peningkatan layanan.' },
            { title: '3. Keamanan Data', content: 'Kami menggunakan enkripsi untuk melindungi data Anda. Tidak ada data yang dijual ke pihak ketiga.' },
            { title: '4. Hak Pengguna', content: 'Anda berhak mengakses, mengubah, atau menghapus data pribadi kapan saja.' },
            { title: '5. Kontak', content: 'Pertanyaan: privacy@nayaka.id' },
          ],
          faqs: null,
          contact_info: { email: 'privacy@nayaka.id' },
        },
        {
          type: 'help_center',
          title: 'Pusat Bantuan',
          sections: null,
          faqs: [
            { question: 'Bagaimana cara absen?', answer: 'Tap menu Absen, lalu scan QR code dari guru.' },
            { question: 'Lupa password?', answer: 'Tap "Lupa password" di halaman login, masukkan email untuk reset.' },
            { question: 'Cara mengajukan izin?', answer: 'Buka menu Izin, pilih jenis izin, isi form dan upload surat.' },
            { question: 'Bagaimana cara memilih sekolah?', answer: 'Sekolah dipilih saat pertama kali login dan tidak dapat diubah. Hubungi admin jika perlu perubahan.' },
            { question: 'Cara update profil?', answer: 'Tap Edit Profile, ubah data yang diperlukan. Nama harus sesuai identitas untuk kartu pelajar.' },
          ],
          contact_info: { email: 'support@nayaka.id', phone: '+6281234567890', address: 'PT Nayaka Haga Media, Jakarta' },
        },
        {
          type: 'terms_of_service',
          title: 'Syarat & Ketentuan',
          sections: [
            { title: '1. Penerimaan Syarat', content: 'Dengan mengakses dan menggunakan aplikasi Nayaka, Anda dianggap telah membaca, memahami, dan menyetujui untuk terikat oleh syarat dan ketentuan ini.' },
            { title: '2. Layanan', content: 'Nayaka menyediakan layanan: Sistem absensi digital untuk sekolah, Pelacakan lokasi anak oleh orang tua, Informasi nilai dan jadwal pelajaran, Komunikasi antara sekolah dan orang tua.' },
            { title: '3. Kewajiban Pengguna', content: 'Anda wajib: Memberikan informasi yang akurat saat registrasi, Menjaga kerahasiaan akun dan password, Tidak menyalahgunakan aplikasi untuk tujuan ilegal, Menghormati guru, staff, dan pengguna lain.' },
            { title: '4. Pelacakan Lokasi', content: 'Fitur lokasi hanya untuk keamanan anak. Orang tua harus mendapatkan persetujuan dari anak. Penyalahgunaan tracking akan mengakibatkan akun dinonaktifkan.' },
            { title: '5. Batasan Tanggung Jawab', content: 'Kami tidak bertanggung jawab atas: Kerusakan akibat penggunaan yang tidak benar, Kehilangan data karena faktor eksternal, Penyalahgunaan oleh pihak ketiga.' },
            { title: '6. Perubahan Syarat', content: 'Kami dapat mengubah syarat ini sewaktu-waktu. Perubahan akan diumumkan melalui aplikasi. Penggunaan berkelanjutan berarti Anda menyetujui syarat baru.' },
          ],
          faqs: null,
          contact_info: { email: 'support@nayaka.id' },
        },
        {
          type: 'privacy_policy_ortu',
          title: 'Kebijakan Privasi Orang Tua',
          sections: [
            { title: '1. Data yang Kami Kumpulkan', content: 'Kami mengumpulkan data berikut untuk memberikan layanan absensi dan pelacakan lokasi: Data Pribadi (Nama, email, NIS, NISN, nomor telepon, foto profil), Data Sekolah (Nama sekolah, kelas, alamat sekolah), Data Lokasi (Koordinat GPS anak saat absen dan dalam mode lacak), Data Absensi (Waktu masuk, waktu pulang, status kehadiran), Data Nilai (Nilai akademik dari guru).' },
            { title: '2. Penggunaan Data', content: 'Data lokasi digunakan untuk: Membantu orang tua memantau lokasi anak, Verifikasi absensi berbasis lokasi, Keamanan anak saat di perjalanan. Kami tidak menjual data ke pihak ketiga.' },
            { title: '3. Pembagian Data Lokasi', content: 'Data lokasi hanya dapat dilihat oleh akun orang tua yang terhubung. Guru dan sekolah dapat melihat lokasi anak saat absen saja. Kami tidak membagikan data lokasi ke advertiser atau pihak lain.' },
            { title: '4. Penyimpanan Data', content: 'Anda dapat melihat data anak kapan saja. Hubungi admin sekolah untuk mengubah atau menghapus data. Permintaan penghapusan data akan diproses dalam 30 hari.' },
            { title: '5. Keamanan Data', content: 'Kami menggunakan: Enkripsi data saat transmisi (HTTPS), Penyimpanan data yang aman di server, Akses terbatas hanya untuk pengguna yang berhak.' },
            { title: '6. Lokasi Background', content: 'Fitur pelacakan lokasi background hanya aktif jika orang tua mengaktifkan dan anak harus memberikan persetujuan. Lokasi dikirim periodik (setiap 5-15 menit) untuk menghemat baterai. Tidak ada tracking real-time berkelanjutan. Anda dapat menonaktifkan kapan saja.' },
          ],
          faqs: null,
          contact_info: { email: 'privacy@nayaka.id' },
        },
      ];

      for (const data of defaults) {
        await Content.findOrCreate({
          where: { type: data.type },
          defaults: { ...data, is_active: true },
        });
      }

      res.json({ success: true, message: 'Default content seeded successfully' });
    } catch (error) {
      console.error('Error seeding content:', error);
      res.status(500).json({ success: false, message: 'Gagal seed konten' });
    }
  },
};

module.exports = contentController;