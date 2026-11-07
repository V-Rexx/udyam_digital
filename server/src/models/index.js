import mongoose from 'mongoose';

const DAY = 86400 * 1000;
export const RETENTION = { abandonedDays: 365, kycAfterOrderDays: 365 };

const journeySchema = new mongoose.Schema({
  token: { type: String, unique: true, index: true },
  lang: { type: String, default: 'en' },
  source: { type: String, default: 'Website form' },
  status: { type: String, default: 'advising', index: true },
  profile: { type: Object, default: {} },
  slot: String,
  messages: { type: Array, default: [] },
  bundle: { type: Object, default: null },
  consentAt: Date,
  kyc: { type: Object, default: {} },
  order: { type: Object, default: null },
  otp: { type: Object, default: null },
  handoff: { type: Object, default: null },
  phoneEnc: String,
  phoneHash: { type: String, index: true },
  events: { type: Array, default: [] },
  purgeAt: { type: Date, default: () => new Date(Date.now() + RETENTION.abandonedDays * DAY) },
}, { timestamps: true, minimize: false });

journeySchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
journeySchema.index({ 'order.id': 1 });

const consentSchema = new mongoose.Schema({
  journeyToken: { type: String, index: true },
  noticeVersion: String,
  lang: String,
  action: { type: String, enum: ['given', 'withdrawn'] },
  purposes: Object,
  at: { type: Date, default: Date.now },
});

export const Journey = mongoose.model('Journey', journeySchema);
export const ConsentLog = mongoose.model('ConsentLog', consentSchema);
