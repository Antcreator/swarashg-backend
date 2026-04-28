const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { User, Member } = require('../models');


// ─── POST /auth/register ────────────────────────────────────────
const register = async (req, res) => {
  const { email, password, role = 'member', firstName, lastName, phone, nationalId } = req.body;

  try {
    const exists = await User.findOne({ where: { email } });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      role,
      firstName,
      lastName,
      mustChangePassword: role === 'member', // ✅ members must change on first login, admins don't
    });

    let memberId = null;
    if (role === 'member' && firstName && lastName && phone && nationalId) {
      const member = await Member.create({
        userId: user.id, firstName, lastName, phone, nationalId,
      });
      memberId = member.id;
    }

    return res.status(201).json({ message: 'User registered successfully', userId: user.id, memberId });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'National ID already registered' });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration failed' });
  }
};

// ─── POST /auth/login ───────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({
      where: { email },
      include: [{ model: Member, as: 'member' }],
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const mustChangePassword = !!user.mustChangePassword;

    const token = jwt.sign(
      { userId: user.id, role: user.role, mustChangePassword },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const firstName = user.member ? user.member.firstName : user.firstName;
    const lastName  = user.member ? user.member.lastName  : user.lastName;

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id:                user.id,
        email:             user.email,
        role:              user.role,
        memberId:          user.member ? user.member.id : null,
        firstName,
        lastName,
        mustChangePassword, // ← frontend reads this to show the gate screen
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
};

// ─── GET /auth/me ───────────────────────────────────────────────
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Member, as: 'member' }],
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ message: 'Failed to fetch user data' });
  }
};

// ─── POST /auth/change-password ─────────────────────────────────
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Failed to change password' });
  }
};

// ─── POST /auth/change-first-password ───────────────────────────
// Called when a member logs in for the first time with an
// admin-assigned password. Clears the mustChangePassword flag
// and issues a fresh token so the member can access the app.
const changeFirstPassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const userId = req.user.id;

  try {
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Both password fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ message: 'Password must contain at least one uppercase letter' });
    }
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ message: 'Password must contain at least one number' });
    }

    const user = await User.findByPk(userId, {
      include: [{ model: Member, as: 'member' }],
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Save new password and clear the first-login flag
    user.password           = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    // Issue a fresh token without the mustChangePassword flag
    const token = jwt.sign(
      { userId: user.id, role: user.role, mustChangePassword: false },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const firstName = user.member ? user.member.firstName : user.firstName;
    const lastName  = user.member ? user.member.lastName  : user.lastName;

    return res.json({
      message: 'Password changed successfully. Welcome!',
      token,
      user: {
        id:                user.id,
        email:             user.email,
        role:              user.role,
        memberId:          user.member ? user.member.id : null,
        firstName,
        lastName,
        mustChangePassword: false,
      },
    });
  } catch (error) {
    console.error('Change first password error:', error);
    return res.status(500).json({ message: 'Failed to change password' });
  }
};

// ─── POST /auth/forgot-password ─────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email, phoneNumber } = req.body;

  try {
    const user = await User.findOne({
      where: { email },
      include: [{ model: Member, as: 'member' }],
    });

    if (!user || !user.member) {
      return res.status(404).json({ message: 'No member account found with this email' });
    }

    if (user.member.phone !== phoneNumber) {
      return res.status(401).json({ message: 'Phone number does not match our records' });
    }

    return res.json({ message: 'Identity verified successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Failed to verify identity' });
  }
};

// ─── POST /auth/reset-password ──────────────────────────────────
const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const user = await User.findOne({
      where: { email },
      include: [{ model: Member, as: 'member' }],
    });

    if (!user || !user.member) {
      return res.status(404).json({ message: 'No member account found with this email' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: 'Password reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Failed to reset password' });
  }
};

// ─── POST /auth/admin-reset-password ────────────────────────────
// Admin resets a member's password. Sets mustChangePassword = true
// so the member is forced to choose a new password on next login.
const adminResetMemberPassword = async (req, res) => {
  const { memberId } = req.body;

  try {
    const member = await Member.findByPk(memberId, {
      include: [{ model: User, as: 'user' }],
    });

    if (!member || !member.user) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8).toUpperCase();

    member.user.password           = await bcrypt.hash(tempPassword, 10);
    member.user.mustChangePassword = true; // force change on next login
    await member.user.save();

    return res.json({
      message:           'Temporary password generated successfully',
      temporaryPassword: tempPassword,
      memberName:        `${member.firstName} ${member.lastName}`,
      email:             member.user.email,
    });
  } catch (error) {
    console.error('Admin reset password error:', error);
    return res.status(500).json({ message: 'Failed to generate temporary password' });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  changePassword,
  changeFirstPassword,        // ← new
  forgotPassword,
  resetPassword,
  adminResetMemberPassword,
};