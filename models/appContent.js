const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Content = sequelize.define('content', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'privacy_policy | help_center | terms_of_service | about_app'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sections: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of {title, content} objects'
    },
    faqs: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of {question, answer} objects for help center'
    },
    contact_info: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '{email, phone, address} object'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    version: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'app_contents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return Content;
};