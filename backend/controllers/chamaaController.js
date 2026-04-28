const {
  Member, ChamaaCycle, ChamaaParticipant, ChamaaContribution, Fine, sequelize,
} = require('../models');

// ─── GET /chamaa ────────────────────────────────────────────────
const getAllCycles = async (req, res) => {
  const { isActive } = req.query;

  try {
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const cycles = await ChamaaCycle.findAll({
      where,
      include: [{ model: ChamaaParticipant, as: 'participants' }],
      order: [['createdAt', 'DESC']],
    });

    const rows = cycles.map((c) => ({
      ...c.toJSON(),
      totalParticipants: c.participants.length,
      completedRounds:   c.participants.filter((p) => p.hasReceived).length,
    }));

    return res.json({ cycles: rows });
  } catch (error) {
    console.error('Get all cycles error:', error);
    return res.status(500).json({ message: 'Failed to fetch chamaa cycles' });
  }
};

// ─── GET /chamaa/:id ────────────────────────────────────────────
const getCycleById = async (req, res) => {
  try {
    const cycle = await ChamaaCycle.findByPk(req.params.id, {
      include: [{
        model: ChamaaParticipant, as: 'participants',
        include: [
          { model: Member, as: 'member', attributes: ['firstName', 'lastName'] },
          { model: ChamaaContribution, as: 'contributions' },
        ],
      }],
    });

    if (!cycle) {
      return res.status(404).json({ message: 'Chamaa cycle not found' });
    }

    const participants = cycle.participants.map((p) => ({
      ...p.toJSON(),
      contributionsMade: p.contributions.length,
      paidContributions: p.contributions.filter((c) => c.isPaid).length,
      totalFines:        p.contributions.reduce((s, c) => s + Number(c.fineAmount), 0),
    }));

    return res.json({ cycle, participants });
  } catch (error) {
    console.error('Get cycle error:', error);
    return res.status(500).json({ message: 'Failed to fetch cycle details' });
  }
};

// ─── POST /chamaa ───────────────────────────────────────────────
const createCycle = async (req, res) => {
  const { name, contributionAmount, startDate, memberIds } = req.body;

  try {
    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: 'At least one member is required' });
    }

    const cycle = await ChamaaCycle.create({
      name,
      contributionAmount,
      startDate: startDate || new Date(),
    });

    // add all members as participants with sequential positions
    for (let i = 0; i < memberIds.length; i++) {
      await ChamaaParticipant.create({
        cycleId:  cycle.id,
        memberId: memberIds[i],
        position: i + 1,
      });
    }

    return res.status(201).json({ message: 'Chamaa cycle created successfully', cycle });
  } catch (error) {
    console.error('Create cycle error:', error);
    return res.status(500).json({ message: 'Failed to create chamaa cycle' });
  }
};

// ─── POST /chamaa/participant ───────────────────────────────────
const addParticipant = async (req, res) => {
  const { cycleId, memberId } = req.body;

  try {
    const cycle = await ChamaaCycle.findByPk(cycleId);
    if (!cycle)          return res.status(404).json({ message: 'Chamaa cycle not found' });
    if (!cycle.isActive) return res.status(400).json({ message: 'Cycle is not active' });

    const alreadyIn = await ChamaaParticipant.findOne({ where: { cycleId, memberId } });
    if (alreadyIn) return res.status(400).json({ message: 'Member already in this cycle' });

    // next position
    const maxPos = await ChamaaParticipant.max('position', { where: { cycleId } }) || 0;

    const participant = await ChamaaParticipant.create({
      cycleId, memberId, position: maxPos + 1,
    });

    return res.status(201).json({ message: 'Participant added', participant });
  } catch (error) {
    console.error('Add participant error:', error);
    return res.status(500).json({ message: 'Failed to add participant' });
  }
};

// ─── PUT /chamaa/participant/:id/position ───────────────────────
// Uses a temp position (-1) as a stepping stone to avoid the unique
// constraint on (cycleId, position) firing during the swap.
const updateParticipantPosition = async (req, res) => {
  const { id } = req.params;
  const { newPosition } = req.body;

  try {
    const participant = await ChamaaParticipant.findByPk(id);
    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    const { cycleId, position: oldPosition } = participant;

    if (newPosition === oldPosition) {
      return res.json({ message: 'Position unchanged', participant });
    }

    // Find whoever currently holds the target position (if any).
    const occupant = await ChamaaParticipant.findOne({
      where: { cycleId, position: newPosition },
    });

    // Wrap the swap in a transaction so a partial update is never left in the DB.
    await sequelize.transaction(async (t) => {
      if (occupant) {
        // Step 1: Park occupant at a temporary slot that can't clash with any real position.
        occupant.position = -1;
        await occupant.save({ transaction: t });

        // Step 2: Move the target participant into the now-vacant slot.
        participant.position = newPosition;
        await participant.save({ transaction: t });

        // Step 3: Give the occupant the vacated old position.
        occupant.position = oldPosition;
        await occupant.save({ transaction: t });
      } else {
        // No one is sitting there — just move directly.
        participant.position = newPosition;
        await participant.save({ transaction: t });
      }
    });

    // Return all participants sorted so the caller can refresh the list.
    const allParticipants = await ChamaaParticipant.findAll({
      where: { cycleId },
      include: [{ model: Member, as: 'member', attributes: ['firstName', 'lastName'] }],
      order: [['position', 'ASC']],
    });

    return res.json({
      message: 'Position updated successfully',
      participant,
      allParticipants,
    });
  } catch (error) {
    console.error('Update position error:', error);
    return res.status(500).json({ message: 'Failed to update participant position' });
  }
};

// ─── POST /chamaa/contribution ──────────────────────────────────
const recordContribution = async (req, res) => {
  const { participantId, month, year, amount, paymentDate } = req.body;

  try {
    const participant = await ChamaaParticipant.findByPk(participantId, {
      include: [{ model: ChamaaCycle, as: 'cycle' }],
    });

    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    const expected = Number(participant.cycle.contributionAmount);
    if (Number(amount) !== expected) {
      return res.status(400).json({ message: `Contribution must be exactly KES ${expected}` });
    }

    // duplicate?
    const existing = await ChamaaContribution.findOne({
      where: { participantId, month, year },
    });
    if (existing) {
      return res.status(400).json({ message: 'Contribution already recorded for this month' });
    }

    // ─── late check ───────────────────────────────────────────
    const payDate    = paymentDate ? new Date(paymentDate) : new Date();
    const payMonth   = payDate.getMonth() + 1;
    const payYear    = payDate.getFullYear();
    const dayOfMonth = payDate.getDate();

    let isLate    = false;
    let fineAmount = 0;

    if (month === payMonth && year === payYear && dayOfMonth > 10) {
      isLate = true; fineAmount = 500;
    } else if (year < payYear || (year === payYear && month < payMonth)) {
      isLate = true; fineAmount = 500;
    }

    const contribution = await ChamaaContribution.create({
      participantId, month, year, amount,
      paymentDate: payDate,
      isPaid: true, isLate, fineAmount,
    });

    // record fine
    if (isLate) {
      await Fine.create({
        memberId:    participant.memberId,
        fineType:    'chamaa_late',
        amount:      fineAmount,
        month, year,
        referenceId: contribution.id,
        notes:       'Late chamaa contribution',
      });
    }

    return res.status(201).json({
      message: isLate ? 'Contribution recorded with late fine' : 'Contribution recorded successfully',
      contribution,
    });
  } catch (error) {
    console.error('Record contribution error:', error);
    return res.status(500).json({ message: 'Failed to record contribution' });
  }
};

// ─── POST /chamaa/received ──────────────────────────────────────
const markAsReceived = async (req, res) => {
  const { participantId, receivedDate } = req.body;

  try {
    const participant = await ChamaaParticipant.findByPk(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    participant.hasReceived  = true;
    participant.receivedDate = receivedDate || new Date();
    await participant.save();

    return res.json({ message: 'Marked as received', participant });
  } catch (error) {
    console.error('Mark as received error:', error);
    return res.status(500).json({ message: 'Failed to update participant' });
  }
};

// ─── PUT /chamaa/:id/end ────────────────────────────────────────
const endCycle = async (req, res) => {
  try {
    const cycle = await ChamaaCycle.findByPk(req.params.id);
    if (!cycle) return res.status(404).json({ message: 'Chamaa cycle not found' });

    cycle.isActive = false;
    cycle.endDate  = new Date();
    await cycle.save();

    return res.json({ message: 'Chamaa cycle ended', cycle });
  } catch (error) {
    console.error('End cycle error:', error);
    return res.status(500).json({ message: 'Failed to end cycle' });
  }
};

// ─── GET /chamaa/report/:cycleId/:month/:year ───────────────────
const getMonthlyChamaaReport = async (req, res) => {
  const { cycleId, month, year } = req.params;

  try {
    const cycle = await ChamaaCycle.findByPk(cycleId);
    if (!cycle) return res.status(404).json({ message: 'Cycle not found' });

    const participants = await ChamaaParticipant.findAll({
      where: { cycleId },
      include: [
        { model: Member, as: 'member', attributes: ['firstName', 'lastName'] },
      ],
      order: [['position', 'ASC']],
    });

    const details = await Promise.all(
      participants.map(async (p) => {
        const contribution = await ChamaaContribution.findOne({
          where: { participantId: p.id, month, year },
        });
        return {
          id:         p.id,
          position:   p.position,
          firstName:  p.member.firstName,
          lastName:   p.member.lastName,
          amount:     contribution ? contribution.amount     : null,
          isPaid:     contribution ? contribution.isPaid     : false,
          isLate:     contribution ? contribution.isLate     : false,
          fineAmount: contribution ? contribution.fineAmount : 0,
          status:     !contribution ? 'Not Paid' : (contribution.isLate ? 'Late' : 'On Time'),
        };
      })
    );

    const summary = {
      totalParticipants: details.length,
      paidParticipants:  details.filter((d) => d.isPaid).length,
      latePayments:      details.filter((d) => d.isLate).length,
      totalAmount:       details.reduce((s, d) => s + Number(d.amount || 0), 0),
      totalFines:        details.reduce((s, d) => s + Number(d.fineAmount || 0), 0),
    };

    return res.json({ cycle, month, year, summary, details });
  } catch (error) {
    console.error('Monthly chamaa report error:', error);
    return res.status(500).json({ message: 'Failed to generate report' });
  }
};

module.exports = {
  getAllCycles,
  getCycleById,
  createCycle,
  addParticipant,
  updateParticipantPosition,
  recordContribution,
  markAsReceived,
  endCycle,
  getMonthlyChamaaReport,
};