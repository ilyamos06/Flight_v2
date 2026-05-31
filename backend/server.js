const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();

app.use(cors());
app.use(express.json());

// DATABASE
const db = new sqlite3.Database("./flight.db", (err) => {
    if (err) {
        console.log("DB ERROR:", err);
    } else {
        console.log("SQLite connected");
    }
});

// USERS TABLE
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT,
        birth TEXT,
        passport TEXT,
        email TEXT UNIQUE,
        password TEXT
    )`);

// TICKETS TABLE
db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        from_city TEXT,
        to_city TEXT,
        departure TEXT,
        return_date TEXT,
        passengers TEXT,
        flight_class TEXT,
        company TEXT,
        price REAL,
        status TEXT
    )`);

// CACHE
let cache = {};

// API CITIES
app.get("/api/cities", async (req, res) => {
    const query = req.query.q;

    if (!query) return res.json([]);
    if (cache[query]) return res.json(cache[query]);
    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5`
        );

        const data = await response.json();
        cache[query] = data.results || [];
        res.json(cache[query]);
    }
    catch (error) {
        console.log(error);
        res.json([]);
    }
});

// API FLIGHTS
app.get("/api/flights", (req, res) => {

    const { from, to, date } = req.query;
    const flights = Array.from({ length: 5 }).map((_, i) => ({
        id: i, from, to, date, time: `${8 + i}:30`, company: ["Ryanair", "WizzAir", "Lufthansa"][i % 3], price: 80 + i * 40
    }));

    res.json(flights);
});

// REGISTER
app.post("/api/register", (req, res) => {
    const { fullname, birth, passport, email, password } = req.body;

    db.run(`INSERT INTO users (fullname, birth, passport, email, password) VALUES (?, ?, ?, ?, ?)`,[fullname, birth, passport, email, password], function(err) {
            if (err) {
                console.log(err);

                return res.json({
                    success: false,
                    message: "User already exists"
                });
            }

            res.json({
                success: true,
                id: this.lastID
            });
        }
    );
});

// LOGIN
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`,[email, password],(err, row) => {
            if (err) {
                console.log(err);

                return res.json({
                    success: false
                });
            }

            if (!row) {
                return res.json({
                    success: false,
                    message: "Wrong login"
                });
            }

            res.json({
                success: true,
                user: row
            });
        }
    );
});

// BUY TICKET
app.post("/api/buy-ticket", (req, res) => {
    const {user_email, from, to, departure, returnDate, passengers, flightClass, company, price} = req.body;

    db.run(`
        INSERT INTO tickets (
            user_email,
            from_city,
            to_city,
            departure,
            return_date,
            passengers,
            flight_class,
            company,
            price,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            user_email,
            from,
            to,
            departure,
            returnDate,
            passengers,
            flightClass,
            company,
            price,
            "active"
        ],

        function(err) {
            if (err) {
                console.log(err);

                return res.json({
                    success: false
                });
            }
            res.json({
                success: true
            });
        }
    );
});

// GET TICKETS
app.get("/api/tickets/:email", (req, res) => {
    const email = req.params.email;

    db.all(`SELECT * FROM tickets WHERE user_email = ?`,[email],(err, rows) => {
            if (err) {
                console.log(err);
                return res.json([]);
            }
            res.json(rows);
        }
    );
});

// DELETE TICKET
app.put("/api/delete-ticket/:id", (req, res) => {
    const id = req.params.id;

    db.run(`UPDATE tickets SET status = 'deleted' WHERE id = ?`,[id],function(err) {
            if (err) {
                console.log(err);

                return res.json({
                    success: false
                });
            }

            res.json({
                success: true
            });
        }
    );
});

// SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});