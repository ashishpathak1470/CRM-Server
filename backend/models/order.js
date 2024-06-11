const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  product: {
    type: String,
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Customer",
  },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
