// ---------------------------------------------------------------------------
// API barrel — the single import surface for the whole app (`@/api`).
//
// When VITE_API_URL is set, calls go to the live NestJS backend (`remote.ts`);
// otherwise everything runs on the in-memory mock (`mock.ts`). Endpoints the
// backend doesn't expose yet (spots, aggregated chat threads, public reviews,
// dev lifecycle triggers) always fall back to the mock so no screen crashes.
// ---------------------------------------------------------------------------
import { USE_REMOTE } from './http';
import * as mock from './mock';
import * as remote from './remote';

// Start from the complete mock surface, then let the remote implementations
// override the endpoints they cover. Cast to the mock's types so every caller
// keeps a stable, fully-typed signature (remote ignores any extra args).
const impl = (USE_REMOTE ? { ...mock, ...remote } : mock) as typeof mock;

export const {
  // ---- Auth (remote-backed when VITE_API_URL is set) ----
  login,
  signup,
  signupBusiness,
  getCurrentUser,
  getReferral,
  updateProfile,
  getUser,
  submitVerification,
  // ---- Activities & events ----
  listActivities,
  createCustomActivity,
  listEvents,
  listPreviewEvents,
  getEvent,
  createEvent,
  joinEvent,
  leaveEvent,
  startActivity,
  confirmActivity,
  cancelActivity,
  getEventsForUser,
  getSubscriptionSummary,
  createSubscriptionCheckout,
  createExpressPaymentIntent,
  listSponsoredVenues,
  registerBusiness,
  createSponsorshipCheckout,
  getMyBusiness,
  updateMyBusiness,
  uploadVenuePhotos,
  removeVenuePhoto,
  // ---- Business orgs & venues (Foundation) ----
  createBusinessOrg,
  getMyBusinesses,
  getBusinessOrg,
  updateBusinessOrg,
  submitBusinessVerification,
  inviteBusinessMember,
  acceptBusinessInvite,
  updateBusinessMemberRole,
  removeBusinessMember,
  listVenues,
  getVenue,
  createVenue,
  updateVenue,
  claimVenue,
  submitVenueReview,
  listBusinessVerificationsAdmin,
  approveBusinessVerification,
  rejectBusinessVerification,
  listVenueClaimsAdmin,
  approveVenueClaim,
  rejectVenueClaim,
  // ---- Chat / ratings / reports / notifications / admin ----
  listThreads,
  getThread,
  sendMessage,
  submitRating,
  getRateablePeople,
  reportTarget,
  submitFeedback,
  listFeedback,
  resolveFeedback,
  listNotifications,
  markNotificationsRead,
  listReports,
  listFlaggedUsers,
  adminOverview,
  adminAnalytics,
  listSubscribers,
  listBusinessesAdmin,
  approveBusiness,
  listExpressPaymentsAdmin,
  listUnderReviewActivities,
  restoreActivity,
  listPendingActivities,
  approveActivity,
  rejectActivity,
  listVerifications,
  approveVerification,
  rejectVerification,
  resolveReport,
  warnUser,
  suspendUser,
  banUser,
  // ---- Mock-only (no backend endpoint yet) ----
  listSpots,
  getConditions,
  getReviewsForUser,
  hasRated,
  canStart,
  devTriggerLifecycle,
} = impl;

export type { AdminReport, FlaggedUser, DevPhase, AdminAnalytics, NamedCount, DailyPoint, AdminVerification, AdminFeedback, FeedbackInput, FeedbackCategory } from './mock';
