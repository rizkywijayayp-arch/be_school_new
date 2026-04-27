const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Apresiasi = sequelize.define('Apresiasi', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  schoolId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.ENUM('AKADEMIK', 'NON_AKADEMIK', 'OLAHRAGA', 'SENI', 'ORGANISASI', 'LAINNYA'),
    allowNull: false,
    defaultValue: 'LAINNYA'
  },
  poin: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  images: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  authorId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  authorName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'appreciations',
  timestamps: true
});

module.exports = Apresiasi;
