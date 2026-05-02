module.exports = (sequelize, DataTypes) => {
  const Nilai = sequelize.define('Nilai', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    schoolId: { type: DataTypes.INTEGER },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    guruId: { type: DataTypes.INTEGER },
    classId: { type: DataTypes.INTEGER },
    mataPelajaranId: { type: DataTypes.INTEGER },
    mapel: { type: DataTypes.STRING(255), allowNull: false },
    semester: { type: DataTypes.STRING(255), allowNull: false },
    academicYear: { type: DataTypes.STRING(20) },
    knowledgeScore: { type: DataTypes.DECIMAL(5, 2) },
    skillScore: { type: DataTypes.DECIMAL(5, 2) },
    assignScore: { type: DataTypes.DECIMAL(5, 2) },
    examScore: { type: DataTypes.DECIMAL(5, 2) },
    nilai: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    creditHours: { type: DataTypes.INTEGER, defaultValue: 4 },
    deskripsi: { type: DataTypes.TEXT },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'nilai', timestamps: true });

  Nilai.associate = (models) => {
    Nilai.belongsTo(models.siswa, { foreignKey: 'studentId', as: 'siswa' });
  };

  return Nilai;
};