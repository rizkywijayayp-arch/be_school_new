/**
 * Tuition Model
 * Database model for student tuition/fee records
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tuition = sequelize.define('Tuition', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },

  schoolId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  type: {
    type: DataTypes.ENUM('tuition', 'development', 'activity', 'book', 'other'),
    defaultValue: 'tuition',
    comment: 'tuition=SPP Bulanan, development=Dana Pengembangan, activity=Dana Kegiatan, book=Buku & Seragam'
  },

  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'Jumlah tagihan dalam mata uang'
  },

  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Tanggal jatuh tempo'
  },

  academicYear: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Tahun ajaran, contoh: 2024/2025'
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  paidAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: 'Jumlah yang sudah dibayar'
  },

  paidDate: {
    type: DataTypes.DATE,
    allowNull: true
  },

  paymentMethod: {
    type: DataTypes.ENUM('cash', 'bank_transfer', 'e_wallet', 'credit_card'),
    allowNull: true
  },

  referenceNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Nomor referensi pembayaran'
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }

}, {
  tableName: 'tuitions',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    { fields: ['schoolId'] },
    { fields: ['studentId'] },
    { fields: ['schoolId', 'studentId'] },
    { fields: ['academicYear'] },
    { fields: ['schoolId', 'academicYear'] },
    { fields: ['isPaid'] },
    { fields: ['dueDate'] },
    { fields: ['schoolId', 'studentId', 'academicYear', 'type'], unique: true }
  ]
});

module.exports = Tuition;
