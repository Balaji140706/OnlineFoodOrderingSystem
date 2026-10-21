import mysql from 'mysql2';
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD,
    database: "online_food_ordering_system",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
export default db;