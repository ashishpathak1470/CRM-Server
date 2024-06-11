const express = require("express");
const mongoose = require("mongoose");
const Customer = require("../models/customer");
const Order = require("../models/order");
const CommunicationLog = require("../models/communicationLog");
const router = express.Router();
const axios = require("axios");

const buildQuery = (filters) => {
  let query = {};

  filters.forEach((filter, index) => {
    const { field, operator, value, logic } = filter;

    let condition = {};
    switch (operator) {
      case "greater_then":
        condition[field] = { $gt: value };
        break;
      case "less_then":
        condition[field] = { $lt: value };
        break;
      case "greater_then_or_equal_to":
        condition[field] = { $gte: value };
        break;
      case "less_then_or_equal_to":
        condition[field] = { $lte: value };
        break;
      case "equal_to":
        condition[field] = value;
        break;
      case "not_equal_to":
        condition[field] = { $ne: value };
        break;
    }

    if (index === 0) {
      query = condition;
    } else {
      if (logic === "AND") {
        query = { $and: [...(query.$and || [query]), condition] };
      } else if (logic === "OR") {
        query = { $or: [...(query.$or || [query]), condition] };
      }
    }
  });

  return query;
};

module.exports = function (redisClient) {
  router.post("/customer", async (req, res) => {
    const { name, email, lastvisit, totalspends, totalvisits } = req.body;
    if (!name || !email || !totalspends || !totalvisits || !lastvisit) {
      return res.status(400).json({ error: "Invalid data" });
    }

    try {
      const existingCustomer = await Customer.findOne({ email }).exec();
      if (existingCustomer && existingCustomer.totalvisits === totalvisits) {
        return res.status(400).json({
          error:
            "Customer with the same email cannot have the same total visits increment it Please !!",
        });
      }

      if (existingCustomer) {
        existingCustomer.totalvisits = totalvisits;
        await existingCustomer.save();
        await redisClient.publish(
          "customer_channel",
          JSON.stringify(existingCustomer)
        );
        return res.status(200).json({ message: "Customer data received" });
      }

      const customer = new Customer({
        name,
        email,
        totalspends,
        lastvisit,
        totalvisits,
      });

      await customer.save();
      await redisClient.publish("customer_channel", JSON.stringify(customer));
      return res.status(200).json({ message: "Customer data received" });
    } catch (error) {
      console.error("Error saving customer data:", error.stack);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/order", async (req, res) => {
    const { product, customerId } = req.body;
    if (!product || !customerId) {
      return res.status(400).json({ error: "Invalid data" });
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ error: "Invalid customerId" });
    }

    const order = new Order({
      product,
      customerId,
    });

    try {
      await order.save();
      await redisClient.publish("order_channel", JSON.stringify(order));
      res.status(200).json({ message: "Order data received" });
    } catch (error) {
      console.error("Error saving order data:", error.stack);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/customer/:id/orders", async (req, res) => {
    const customerId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ error: "Invalid customerId" });
    }

    try {
      const orders = await Order.find({ customerId }).exec();
      if (!orders) {
        return res
          .status(404)
          .json({ error: "No orders found for this customer" });
      }
      res.status(200).json({ orders });
    } catch (error) {
      console.error("Error fetching orders:", error.stack);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/audience/save", async (req, res) => {
    const { filters } = req.body;
    console.log("Saving audience with filters:", filters);

    try {
      const query = buildQuery(filters);
      const audienceMembers = await Customer.find(query).exec();
      console.log("Found audience members:", audienceMembers);

      const communicationLog = new CommunicationLog({
        audienceFilters: filters,
        audienceSize: audienceMembers.length,
        audienceMembers: audienceMembers.map((member) => member._id),
        campaignDetails: {},
      });

      await communicationLog.save();

      await sendPersonalizedMessages(audienceMembers);

      res.status(200).json({ message: "Audience saved successfully" });
    } catch (error) {
      console.error("Error saving audience:", error.stack);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const sendPersonalizedMessages = async (audienceMembers) => {
    for (const member of audienceMembers) {
      try {
        const response = await axios.post("https://crm-mock-server.onrender.com/send", {
          message: `Hi ${member.name}, here is 10% off on your next order`,
          customerId: member._id,
        });

        if (response.status >= 200 && response.status < 300) {
          await updateDeliveryStatus(member._id, "SENT");
        } else {
          throw new Error("Failed to send message");
        }
      } catch (error) {
        console.error("Error sending message to", member.name, error);
        await updateDeliveryStatus(member._id, "FAILED");
      }
    }
  };

  router.post("/audience/size", async (req, res) => {
    const { filters } = req.body;
    console.log("Checking audience size with filters:", filters);

    try {
      const query = buildQuery(filters);
      const audienceSize = await Customer.countDocuments(query).exec();
      console.log("Calculated audience size:", audienceSize);

      res.status(200).json({ size: audienceSize });
    } catch (error) {
      console.error("Error getting audience size:", error.stack);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/delivery-receipt", async (req, res) => {
    const { communicationLogId, status } = req.body;

    try {
      await updateDeliveryStatus(communicationLogId, status);
      res.status(200).json({ message: "Delivery status updated successfully" });
    } catch (error) {
      console.error("Error updating delivery status:", error.stack);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const updateDeliveryStatus = async (communicationLogId, status) => {
    await CommunicationLog.findByIdAndUpdate(communicationLogId, {
      status,
    }).exec();
  };

  router.get("/campaigns", async (req, res) => {
    try {
      const campaigns = await CommunicationLog.find().exec();
      res.status(200).json({ campaigns });
    } catch (error) {
      console.error("Error fetching campaigns:", error.stack);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
};
