const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const session = require("express-session");
const cors = require("cors");
const redis = require('redis');

dotenv.config();

const app = express();
app.use(bodyParser.json());

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().then(() => {
  console.log('Redis connected');
}).catch(err => {
  console.error('Failed to connect to Redis:', err);
  process.exit(1);
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

const apiRoutes = require("./routes/api")(redisClient);
app.use("/api", apiRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the CRM Server');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, (err) => {
  if (err) {
    console.error("Error starting server:", err);
  } else {
    console.log(`Server is running on port ${PORT}`);
  }
});
