import mysql from 'mysql2';
const db_password=process.env.READ_ONLY_DB_PASSWORD;
const db=mysql.createConnection({
    host:'localhost',
    user:'ai_reader',
    password:db_password,
    database:'online_food_ordering_system'
});
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }

    console.log('Successfully connected to the read only database!');
});
export default db;