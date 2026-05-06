const jwt    = require('jsonwebtoken');
const { User, Member } = require('../models');

// ─── verify JWT and attach req.user ─────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      // ✅ Log the JWT error so Railway logs show you exactly what's wrong
      console.error('JWT verify failed:', err.message, 'token prefix:', token?.slice(0, 20));
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // ✅ Guard against tokens that verified but have no userId in payload
    //    This catches JWT_SECRET mismatches that produce valid-but-wrong decodes
    if (!decoded || !decoded.userId) {
      console.error('Decoded JWT missing userId. Full decoded payload:', decoded);
      return res.status(403).json({ message: 'Malformed token payload' });
    }

    try {
      const user = await User.findByPk(decoded.userId, {
        include: [{ model: Member, as: 'member', attributes: ['id'] }],
      });

      if (!user) {
        // ✅ Log the ID so you can verify it exists in the DB
        console.error('User not found for decoded.userId:', decoded.userId);
        return res.status(403).json({ message: 'User not found' });
      }

      req.user = {
        id:        user.id,
        email:     user.email,
        role:      user.role,
        member_id: user.member ? user.member.id : null,
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });
};

// ─── admin or staff (view access) ───────────────────────────────
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// ─── admin only (write/mutate actions) ──────────────────────────
const requireAdminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'This action requires full admin access' });
  }
  next();
};

// ─── own data or admin ──────────────────────────────────────────
const requireOwnerOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'staff') return next();

  const requested = parseInt(req.params.id || req.params.memberId, 10);
  if (req.user.member_id !== requested) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin, requireAdminOnly, requireOwnerOrAdmin };