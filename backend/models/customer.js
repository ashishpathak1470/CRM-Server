const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const customerSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  totalspends: {
    type: Number,
    default: 0,
  },
  lastvisit: {
    type: Date,
    default: Date.now(),
  },
  totalvisits: {
    type: Number,
    default: 0,
  },
});

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
