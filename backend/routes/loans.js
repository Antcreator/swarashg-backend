const express = require('express');
const router  = express.Router();
const { authenticateToken, requireAdmin, requireAdminOnly } = require('../middleware/auth');
const loanController = require('../controllers/loanController');

router.use(authenticateToken);

router.get ('/office-guarantor',               loanController.getOfficeGuarantor);
router.get ('/duration-options',               loanController.getDurationOptions);
router.get ('/my-guarantor-requests',          loanController.getMyGuarantorRequests);
router.get ('/stats/summary',                  requireAdmin,     loanController.getLoanStatistics);
router.get ('/eligibility/:memberId',          loanController.checkLoanEligibility);
router.get ('/max-loan/:memberId',             loanController.getMaxLoan);
router.get ('/guaranteed/:memberId',           loanController.getGuaranteedLoans);
router.get ('/:id/guarantor-status',           loanController.getLoanGuarantorStatus);
router.get ('/',                               loanController.getAllLoans);
router.get ('/:id',                            loanController.getLoanById);

router.post('/apply',                          loanController.applyForLoan);
router.post('/top-up',                         loanController.requestTopUp);
router.post('/guarantor-requests/:id/respond', loanController.respondToGuarantorRequest);
router.post('/payment',                        requireAdminOnly, loanController.recordLoanPayment);
router.post('/update-statuses',                requireAdminOnly, loanController.updateAllLoanStatuses);
router.post('/guarantor-payment/:guarantorPaymentId', requireAdminOnly, loanController.recordGuarantorPayment);
router.post('/:id/replace-guarantor',          loanController.replaceGuarantor);
router.post('/:id/approve',                    requireAdminOnly, loanController.approveLoan);
router.post('/:id/reject',                     requireAdminOnly, loanController.rejectLoan);
router.put ('/:id',                            requireAdminOnly, loanController.updateLoan);
router.delete('/:id',                          requireAdminOnly, loanController.deleteLoan);

module.exports = router;