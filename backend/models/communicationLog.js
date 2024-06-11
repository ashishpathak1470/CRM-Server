const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const communicationLogSchema = new Schema({
  audienceFilters: {
    type: Schema.Types.Mixed,
    required: true,
  },
  audienceSize: {
    type: Number,
    required: true,
  },
  audienceMembers: [
    {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["SENT", "FAILED"],
    default: "SENT",
  },
});

const CommunicationLog = mongoose.model(
  "CommunicationLog",
  communicationLogSchema
);

module.exports = CommunicationLog;
