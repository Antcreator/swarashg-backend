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
      // totalParticipants = number of SLOTS (rows), not unique members
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
        order: [['position', 'ASC']],
      }],
    });

    if (!cycle) {
      return res.status(404).json({ message: 'Chamaa cycle not found' });
    }

    // Each row is one slot — a member can appear multiple times with different positions.
    const participants = cycle.participants
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
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
// memberIds may now contain duplicate member IDs — each entry becomes
// one slot/position. Example: [1, 2, 1, 3, 1] gives member 1 positions 1, 3 and 5.
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

    // Each entry in memberIds (including duplicates) becomes its own participant slot.
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
// Adds a new slot for a member — they may already have other slots in the same cycle.
const addParticipant = async (req, res) => {
  const { cycleId, memberId } = req.body;

  try {
    const cycle = await ChamaaCycle.findByPk(cycleId);
    if (!cycle)          return res.status(404).json({ message: 'Chamaa cycle not found' });
    if (!cycle.isActive) return res.status(400).json({ message: 'Cycle is not active' });

    // No longer reject if the member is already in the cycle — they can have multiple slots.

    const maxPos = await ChamaaParticipant.max('position', { where: { cycleId } }) || 0;

    const participant = await ChamaaParticipant.create({
      cycleId, memberId, position: maxPos + 1,
    });

    return res.status(201).json({ message: 'Participant slot added', participant });
  } catch (error) {
    console.error('Add participant error:', error);
    return res.status(500).json({ message: 'Failed to add participant' });
  }
};

// ─── PUT /chamaa/participant/:id/position ───────────────────────
// Swaps two slots by position. The unique constraint is only on (cycleId, position),
// so a member appearing in multiple rows is fine as long as positions stay unique.
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

    const occupant = await ChamaaParticipant.findOne({
      where: { cycleId, position: newPosition },
    });

    await sequelize.transaction(async (t) => {
      if (occupant) {
        occupant.position = -1;
        await occupant.save({ transaction: t });

        participant.position = newPosition;
        await participant.save({ transaction: t });

        occupant.position = oldPosition;
        await occupant.save({ transaction: t });
      } else {
        participant.position = newPosition;
        await participant.save({ transaction: t });
      }
    });

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

// ─── PUT /chamaa/participant/:id/schedule ───────────────────────
// Updates the scheduledMonth and scheduledYear for a participant slot.
// Multiple slots can share the same month (e.g. two members both receive in March).
const updateParticipantSchedule = async (req, res) => {
  const { id } = req.params;
  const { scheduledMonth, scheduledYear } = req.body;

  try {
    const participant = await ChamaaParticipant.findByPk(id);
    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    // Validate month range
    if (scheduledMonth !== null && scheduledMonth !== undefined) {
      const m = Number(scheduledMonth);
      if (!Number.isInteger(m) || m < 1 || m > 12) {
        return res.status(400).json({ message: 'scheduledMonth must be between 1 and 12' });
      }
      participant.scheduledMonth = m;
    } else {
      participant.scheduledMonth = null;
    }

    if (scheduledYear !== null && scheduledYear !== undefined) {
      participant.scheduledYear = Number(scheduledYear);
    } else {
      participant.scheduledYear = null;
    }

    await participant.save();

    return res.json({ message: 'Schedule updated successfully', participant });
  } catch (error) {
    console.error('Update schedule error:', error);
    return res.status(500).json({ message: 'Failed to update participant schedule' });
  }
};

// ─── POST /chamaa/contribution ──────────────────────────────────
// Contributions are tracked per participant slot (id), so Mary's slot at
// position 1 and her slot at position 5 each have independent contribution records.
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

    // Duplicate check is per slot (participantId), not per member — intentional.
    const existing = await ChamaaContribution.findOne({
      where: { participantId, month, year },
    });
    if (existing) {
      return res.status(400).json({ message: 'Contribution already recorded for this slot this month' });
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

const getChamaaPaymentsReport = async (req, res) => {
  const { month, year } = req.query;
 
  if (!month || !year) {
    return res.status(400).json({ message: 'month and year are required' });
  }
 
  const targetMonth = Number(month);
  const targetYear  = Number(year);
 
  try {
    const { Member, ChamaaParticipant, ChamaaCycle, ChamaaContribution, Deposit } = require('../models');
 
    // Get all active members
    const members = await Member.findAll({
      where: { isActive: true },
      order: [['lastName', 'ASC'], ['firstName', 'ASC']],
    });
 
    // Get all active chamaa cycles with their participants
    const cycles = await ChamaaCycle.findAll({
      where: { isActive: true },
      include: [{
        model: ChamaaParticipant,
        as: 'participants',
        include: [{
          model: ChamaaContribution,
          as: 'contributions',
          where: { month: targetMonth, year: targetYear },
          required: false,
        }],
      }],
    });
 
    // Also check deposits distributed with chamaa for this month/year
    const chamaaDeposits = await Deposit.findAll({
      where: {
        depositStatus:      'distributed',
        chamaaMonth:        targetMonth,
        chamaaYear:         targetYear,
        chamaaPaymentAmount: { [require('sequelize').Op.gt]: 0 },
      },
    });
 
    // Build a set of memberIds who paid via deposit this month
    const paidViaDeposit = new Set(chamaaDeposits.map(d => Number(d.memberId)));
 
    // Build report rows — one row per member
    const details = members.map(member => {
      const mid = Number(member.id);
 
      // Find all participant slots for this member across active cycles
      const memberSlots = [];
      cycles.forEach(cycle => {
        const slots = (cycle.participants || []).filter(p => Number(p.memberId) === mid);
        slots.forEach(slot => {
          const contribs = slot.contributions || [];
          const paid     = contribs.length > 0;
          const isLate   = contribs.some(c => c.isLate);
          const amount   = contribs.reduce((s, c) => s + Number(c.amount || 0), 0);
          const fine     = contribs.reduce((s, c) => s + Number(c.fineAmount || 0), 0);
          memberSlots.push({
            cycleId:       cycle.id,
            cycleName:     cycle.name,
            participantId: slot.id,
            position:      slot.position,
            scheduledMonth:slot.scheduledMonth,
            scheduledYear: slot.scheduledYear,
            paid,
            isLate,
            amount,
            fine,
            paymentDate: contribs[0]?.paymentDate || null,
            paidViaDeposit: paidViaDeposit.has(mid),
          });
        });
      });
 
      // Overall status for this member this month
      const hasPaid      = memberSlots.some(s => s.paid) || paidViaDeposit.has(mid);
      const hasLate      = memberSlots.some(s => s.isLate);
      const totalAmount  = memberSlots.reduce((s, sl) => s + sl.amount, 0);
      const totalFine    = memberSlots.reduce((s, sl) => s + sl.fine, 0);
      const hasActiveChamaa = memberSlots.length > 0;
 
      return {
        id:             mid,
        memberId:       member.memberId,
        firstName:      member.firstName,
        lastName:       member.lastName,
        phone:          member.phone || '',
        hasActiveChamaa,
        slots:          memberSlots,
        paid:           hasPaid,
        isLate:         hasLate,
        amount:         totalAmount,
        fine:           totalFine,
        paidViaDeposit: paidViaDeposit.has(mid),
        status: !hasActiveChamaa
          ? 'No Active Chamaa'
          : !hasPaid
            ? 'Not Paid'
            : hasLate
              ? 'Late'
              : 'On Time',
      };
    });
 
    const summary = {
      totalMembers:        details.length,
      membersWithChamaa:   details.filter(d => d.hasActiveChamaa).length,
      paidMembers:         details.filter(d => d.paid && d.hasActiveChamaa).length,
      unpaidMembers:       details.filter(d => !d.paid && d.hasActiveChamaa).length,
      latePayments:        details.filter(d => d.isLate).length,
      totalCollected:      details.reduce((s, d) => s + d.amount, 0),
      totalFines:          details.reduce((s, d) => s + d.fine, 0),
      paidViaDeposit:      details.filter(d => d.paidViaDeposit).length,
    };
 
    return res.json({ month: targetMonth, year: targetYear, summary, details });
  } catch (error) {
    console.error('Chamaa payments report error:', error);
    return res.status(500).json({ message: 'Failed to generate chamaa payments report' });
  }
};

// ─── GET /chamaa/report/:cycleId/:month/:year ───────────────────
const getMonthlyChamaaReport = async (req, res) => {
  const { cycleId, month, year } = req.params;

  try {
    const cycle = await ChamaaCycle.findByPk(cycleId);
    if (!cycle) return res.status(404).json({ message: 'Cycle not found' });

    // Each row is a slot — a member with 3 slots appears 3 times.
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
          id:             p.id,
          position:       p.position,
          scheduledMonth: p.scheduledMonth,
          scheduledYear:  p.scheduledYear,
          firstName:      p.member.firstName,
          lastName:       p.member.lastName,
          amount:         contribution ? contribution.amount     : null,
          isPaid:         contribution ? contribution.isPaid     : false,
          isLate:         contribution ? contribution.isLate     : false,
          fineAmount:     contribution ? contribution.fineAmount : 0,
          status:         !contribution ? 'Not Paid' : (contribution.isLate ? 'Late' : 'On Time'),
        };
      })
    );

    const summary = {
      totalSlots:       details.length,
      paidSlots:        details.filter((d) => d.isPaid).length,
      latePayments:     details.filter((d) => d.isLate).length,
      totalAmount:      details.reduce((s, d) => s + Number(d.amount || 0), 0),
      totalFines:       details.reduce((s, d) => s + Number(d.fineAmount || 0), 0),
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
  updateParticipantSchedule,
  recordContribution,
  markAsReceived,
  endCycle,
  getChamaaPaymentsReport,
  getMonthlyChamaaReport,
};