import "dotenv/config";
import express from "express";
import cors from "cors";
import loginRouter from "./routes/Login.js";
import restaurantRouter from './routes/Restaurant.js';
import deliveryRouter from './routes/Delivery.js';
import customerRouter from './routes/Customer.js';
import adminRouter from './routes/Admin.js';
import {startTokenCleanup} from './utils/tokenCleanup.js';
const app = express();
const port = Number(process.env.PORT) || 5299;

app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());

app.use("/api/auth", loginRouter);
app.use("/api/restaurant",restaurantRouter);
app.use("/api/delivery",deliveryRouter);
app.use("/api/customer",customerRouter);
app.use("/api/admin",adminRouter);

app.use((err, req, res, next) => {
    console.error("Unhandled server error:", err);
    res.status(500).json({
        message: "Internal server error!"
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    startTokenCleanup();
});