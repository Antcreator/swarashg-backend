const bcrypt = require('bcrypt');
const { User, Member, Deposit, Loan, Statutory } = require('../models');
const { Op } = require('sequelize');

// ─── GET /admins ────────────────────────────────────────────────
const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.findAll({
      where: { role: ['admin', 'staff'] },
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt', 'isActive'],
      order: [['createdAt', 'ASC']],
    });
    return res.json({ admins });
  } catch (error) {
    console.error('Get admins error:', error);
    return res.status(500).json({ message: 'Failed to fetch admins', error: error.message });
  }
};

// ─── POST /admins ────────────────────────────────────────────────
const createAdmin = async (req, res) => {
  const { email, password, firstName, lastName, role = 'admin' } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ message: 'email, password, firstName and lastName are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Must be admin or staff.' });
  }

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin  = await User.create({
      email, password: hashed, firstName, lastName, role, isActive: true,
    });

    return res.status(201).json({
      message: `${role === 'staff' ? 'Staff' : 'Admin'} account created for ${firstName} ${lastName}`,
      admin: {
        id: admin.id, email: admin.email,
        firstName: admin.firstName, lastName: admin.lastName,
        role: admin.role, createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error('Create admin error:', error);
    return res.status(500).json({ message: 'Failed to create admin', error: error.message });
  }
};

// ─── PUT /admins/:id/reset-password ─────────────────────────────
const resetAdminPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  try {
    const admin = await User.findOne({ where: { id, role: { [Op.in]: ['admin', 'staff'] } } });
    if (!admin) return res.status(404).json({ message: 'User not found' });

    if (admin.id === req.user.id) {
      return res.status(400).json({ message: 'Use the profile settings to change your own password' });
    }

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    return res.json({ message: `Password reset for ${admin.email}` });
  } catch (error) {
    console.error('Reset admin password error:', error);
    return res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
};

// ─── PUT /admins/:id/toggle-active ──────────────────────────────
const toggleAdminActive = async (req, res) => {
  const { id } = req.params;

  try {
    const admin = await User.findOne({ where: { id, role: { [Op.in]: ['admin', 'staff'] } } });
    if (!admin) return res.status(404).json({ message: 'User not found' });

    if (admin.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    if (admin.role === 'admin') {
      const activeAdminCount = await User.count({ where: { role: 'admin', isActive: true } });
      if (admin.isActive && activeAdminCount <= 1) {
        return res.status(400).json({ message: 'Cannot deactivate the last active admin account' });
      }
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    return res.json({
      message: `${admin.role === 'staff' ? 'Staff' : 'Admin'} ${admin.email} has been ${admin.isActive ? 'activated' : 'deactivated'}`,
      admin: { id: admin.id, email: admin.email, isActive: admin.isActive },
    });
  } catch (error) {
    console.error('Toggle admin error:', error);
    return res.status(500).json({ message: 'Failed to update admin', error: error.message });
  }
};

// ─── DELETE /admins/:id ──────────────────────────────────────────
const deleteAdmin = async (req, res) => {
  const { id } = req.params;

  try {
    const admin = await User.findOne({ where: { id, role: { [Op.in]: ['admin', 'staff'] } } });
    if (!admin) return res.status(404).json({ message: 'User not found' });

    if (admin.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    if (admin.role === 'admin') {
      const activeAdminCount = await User.count({ where: { role: 'admin', isActive: true } });
      if (admin.isActive && activeAdminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last active admin account' });
      }
    }

    // ── Null out all foreign key references before deleting ──────
    await Deposit.update({ confirmedBy: null }, { where: { confirmedBy: id } });
    await Deposit.update({ approvedBy:  null }, { where: { approvedBy:  id } });
    await Loan.update(   { approvedBy:  null }, { where: { approvedBy:  id } });
    await Statutory.update({ editedBy:    null }, { where: { editedBy:    id } });
    await Statutory.update({ submittedBy: null }, { where: { submittedBy: id } });

    await admin.destroy();
    return res.json({
      message: `${admin.role === 'staff' ? 'Staff' : 'Admin'} ${admin.email} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    return res.status(500).json({ message: 'Failed to delete admin', error: error.message });
  }
};

module.exports = { getAllAdmins, createAdmin, resetAdminPassword, toggleAdminActive, deleteAdmin };