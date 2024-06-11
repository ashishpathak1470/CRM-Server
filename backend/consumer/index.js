const redis = require("redis");
const mongoose = require("mongoose");
const Customer = require("../models/customer");
const Order = require("../models/order");
const CommunicationLog = require("../models/communicationLog");
const dotenv = require("dotenv");

dotenv.config();

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.on("error", (err) => console.error("Redis Client Error", err));

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected for consumer"))
  .catch((err) => console.error("MongoDB connection error for consumer:", err));

const batchQueue = [];
const batchSize = 10;
let timer;

const handleCustomer = async (data) => {
  const customer = new Customer(data);
  await customer.save();
};

const handleOrder = async (data) => {
  const order = new Order(data);
  await order.save();
};

const handleCommunicationLog = async (data) => {
  const communicationLog = new CommunicationLog(data);
  await communicationLog.save();
};

const processBatch = async () => {
  try {
    if (batchQueue.length > 0) {
      await Promise.all(batchQueue.map(handleCommunicationLog));
      console.log(`Processed batch of ${batchQueue.length} messages`);
      batchQueue.length = 0;
    }
  } catch (error) {
    console.error("Error processing batch:", error);
  }
};

redisClient.on("message", async (channel, message) => {
  try {
    const data = JSON.parse(message);
    if (channel === "customer_channel") {
      handleCustomer(data).catch(console.error);
    } else if (channel === "order_channel") {
      handleOrder(data).catch(console.error);
    } else if (channel === "communication_log_channel") {
      batchQueue.push(data);
      if (!timer) {
        timer = setTimeout(async () => {
          await processBatch();
          timer = null;
        }, 5000);
      }
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
});

redisClient.subscribe("customer_channel");
redisClient.subscribe("order_channel");
redisClient.subscribe("communication_log_channel");
