const bcrypt = require('bcrypt');
const sequelize = require('./config/database');
const { DataTypes } = require('sequelize');

// Inline User model matching your exact definition
const User = sequelize.define('User', {
  id:        { type: DataTypes.INTEGER,                        primaryKey: true, autoIncrement: true },
  email:     { type: DataTypes.STRING(255),                    allowNull: false, unique: true, validate: { isEmail: true } },
  password:  { type: DataTypes.STRING(255),                    allowNull: false },
  role:      { type: DataTypes.ENUM('admin', 'member'),        allowNull: false, defaultValue: 'member' },
  firstName: { type: DataTypes.STRING(255),                    allowNull: true },
  lastName:  { type: DataTypes.STRING(255),                    allowNull: true },
}, {
  tableName: 'users',
  freezeTableName: true,
  timestamps: true,
});

const admins = [
  { email: 'cliff.ochino@swara.com',  plainPassword: 'Swara@2024', firstName: 'Cliff',  lastName: 'Ochino'  },
  { email: 'david.ogetch@swara.com',  plainPassword: 'Swara@2024', firstName: 'David',  lastName: 'Ogetch'  },
  { email: 'andrew.wafula@swara.com', plainPassword: 'Swara@2024', firstName: 'Andrew', lastName: 'Wafula'  },
];

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');

    for (const admin of admins) {
      const hashed = await bcrypt.hash(admin.plainPassword, 10);

      const [user, created] = await User.findOrCreate({
        where: { email: admin.email },
        defaults: {
          email:     admin.email,
          password:  hashed,
          role:      'admin',
          firstName: admin.firstName,
          lastName:  admin.lastName,
        }
      });

      if (created) {
        console.log(`✓ Created admin: ${admin.firstName} ${admin.lastName} (${admin.email})`);
      } else {
        await user.update({ role: 'admin', firstName: admin.firstName, lastName: admin.lastName });
        console.log(`✓ Updated admin: ${admin.firstName} ${admin.lastName} (${admin.email})`);
      }
    }

    console.log('\nAll done! Default password for all: Swara@2024');
    console.log('Remind each admin to change their password after first login.');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

seed();