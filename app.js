// ГЛОБАЛЬНІ ЗМІННІ ТА КОНФІГУРАЦІЯ

let currentCurrency = localStorage.getItem("currency") || "eur";
let currentLang = localStorage.getItem("lang") || "en";

let lastFlights = [];
let translations = {};

const currencyRates = {
    eur: 1,
    usd: 1.09,
    czk: 25,
    uah: 42
};

const currencySymbols = {
    eur: "€",
    usd: "$",
    czk: "Kč",
    uah: "₴"
};

// ІНІЦІАЛІЗАЦІЯ

document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    loadTranslations();
    loadTickets();
    loadProfile();

    // Валюта
    const currencyElem = document.getElementById("currency");
    if (currencyElem) {
        currencyElem.value = currentCurrency;
        currencyElem.addEventListener("change", (e) => {
            currentCurrency = e.target.value;
            localStorage.setItem("currency", currentCurrency);
            renderFlights(lastFlights);
        });
    }

    // Мова
    const langElem = document.getElementById("lang");
    if (langElem) {
        langElem.value = currentLang;
        langElem.addEventListener("change", changeLanguage);
    }

    // Автокомпліт
    setupAutocomplete("from", "suggestions-from");
    setupAutocomplete("to", "suggestions-to");
});

// ТЕМА

function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeSwitch(newTheme);
}

function updateThemeSwitch(theme) {
    const switchBg = document.getElementById("switchBg");
    const switchCircle = document.getElementById("switchCircle");

    if (switchBg && switchCircle) {
        switchBg.classList.toggle("active", theme === "dark");
        switchCircle.classList.toggle("active", theme === "dark");
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.body.setAttribute("data-theme", savedTheme);
    updateThemeSwitch(savedTheme);
}

// ПЕРЕКЛАДИ

async function loadTranslations() {
    try {
        const response = await fetch("flights.json");
        translations = await response.json();
        applyTranslations();
    } catch (error) {
        console.error("Translation error:", error);
    }
}

function applyTranslations() {
    document.querySelectorAll("[data-key]").forEach(element => {
        const key = element.dataset.key;
        if (translations[key] && translations[key][currentLang]) {
            element.innerText = translations[key][currentLang];
        }
    });
}

function changeLanguage() {
    currentLang = document.getElementById("lang").value;
    localStorage.setItem("lang", currentLang);

    applyTranslations();
    loadProfile();
    loadTickets();
}

// АВТОКОМПЛІТ

function setupAutocomplete(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);

    if (!input || !suggestions) return;

    input.addEventListener("input", async () => {
        const value = input.value.trim();
        suggestions.innerHTML = "";

        if (value.length < 2) return;

        try {
            const response = await fetch(`http://localhost:3000/api/cities?q=${value}`);
            const cities = await response.json();

            cities.forEach(city => {
                const item = document.createElement("div");
                item.className = "suggestion-item";
                item.innerText = `${city.name}, ${city.country}`;

                item.onclick = () => {
                    input.value = city.name;
                    suggestions.innerHTML = "";
                };

                suggestions.appendChild(item);
            });
        } catch (error) {
            console.error("Autocomplete error:", error);
        }
    });
}

// ПОШУК РЕЙСІВ

async function searchFlights() {
    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;
    const passengers = document.getElementById("passengers").value;
    const flightClass = document.getElementById("class").value;
    let departure = document.getElementById("departure").value;
    let returnDate = document.getElementById("return").value;

    if (!departure) {
        departure = new Date().toISOString().split("T")[0];
    }

    if (!returnDate) {
        returnDate = departure;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/flights?from=${from}&to=${to}&date=${departure}`);
        let flights = await response.json();

        flights = flights.map(flight => {
            let price = flight.price;
            if (flightClass === "business") {
                price *= 1.8;
            }
            price *= Number(passengers);

            const day = new Date(departure).getDay();
            if (day === 0 || day === 6) {
                price *= 1.2;
            }

            return {
                ...flight,
                passengers,
                flightClass,
                departure,
                returnDate,
                price
            };
        });

        lastFlights = flights;
        renderFlights(flights);
    } catch (error) {
        console.error("Search error:", error);
    }
}

// РЕНДЕР РЕЙСІВ

function renderFlights(flights) {
    const results = document.getElementById("results");
    if (!results) return;

    results.innerHTML = "";

    flights.forEach((flight, index) => {
        const convertedPrice = (flight.price * currencyRates[currentCurrency]).toFixed(2);
        const symbol = currencySymbols[currentCurrency];

        const card = document.createElement("div");
        card.className = "result-card";
        card.innerHTML = `
            <div class="result-left">
                <div>✈ ${flight.from} → ${flight.to}</div>
                <div>📅 ${flight.departure} → ${flight.returnDate}</div>
                <div>👤 ${flight.passengers} | 🪑 ${flight.flightClass}</div>
                <div>🏢 ${flight.company} | 🕒 ${flight.time}</div>
                <div>💰 ${convertedPrice} ${symbol}</div>
            </div>
            <button class="buy-btn" onclick="buyFlightByIndex(${index})">
                Buy
            </button>
        `;
        results.appendChild(card);
    });
}

// КУПІВЛЯ КВИТКА

async function buyFlightByIndex(index) {
    const flight = lastFlights[index];
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser) {
        alert("Login first");
        return;
    }

    try {
        const response = await fetch("http://localhost:3000/api/buy-ticket", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_email: currentUser.email,
                from: flight.from,
                to: flight.to,
                departure: flight.departure,
                returnDate: flight.returnDate,
                passengers: flight.passengers,
                flightClass: flight.flightClass,
                company: flight.company,
                price: flight.price
            })
        });

        const data = await response.json();
        if (data.success) {
            alert("Ticket purchased ✈");
            loadTickets();
        } else {
            alert("Error");
        }
    } catch (error) {
        console.log(error);
        alert("Server error");
    }
}

// ЗАВАНТАЖЕННЯ КВИТКІВ

async function loadTickets() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const container = document.getElementById("tickets");

    if (!container || !currentUser) return;

    try {
        const response = await fetch(`http://localhost:3000/api/tickets/${currentUser.email}`);
        const tickets = await response.json();

        container.innerHTML = "";

        tickets.forEach(ticket => {
            const div = document.createElement("div");
            div.className = ticket.status === "deleted"
                ? "result-card deleted-ticket"
                : "result-card";

            div.innerHTML = `
                <div class="result-left">
                    <div>✈ ${ticket.from_city} → ${ticket.to_city}</div>
                    <div>📅 ${ticket.departure} → ${ticket.return_date}</div>
                    <div>👤 ${ticket.passengers}</div>
                    <div>🪑 ${ticket.flight_class}</div>
                    <div>🏢 ${ticket.company}</div>
                    <div>💰 ${ticket.price}</div>
                </div>
                ${ticket.status === "deleted"
                ? "<div>Ticket deleted</div>"
                : `<button class="delete-btn" onclick="deleteTicket(${ticket.id})">Delete</button>`
            }
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.log(error);
    }
}

// ВИДАЛЕННЯ КВИТКА

async function deleteTicket(id) {
    try {
        await fetch(`http://localhost:3000/api/delete-ticket/${id}`, {
            method: "PUT"
        });
        loadTickets();
    } catch (error) {
        console.log(error);
    }
}

// ПРОФІЛЬ

function openProfile() {
    const modal = document.getElementById("profileModal");
    if (modal) {
        modal.classList.remove("hidden");
        loadProfile();
        loadTickets();
    }
}

function closeProfile() {
    const modal = document.getElementById("profileModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

function loadProfile() {
    const user = JSON.parse(localStorage.getItem("currentUser"));
    const profileInfo = document.getElementById("profileInfo");
    const profileForm = document.querySelector(".profile-form");

    if (!profileInfo) return;

    if (user) {
        if (profileForm) profileForm.style.display = "none";

        profileInfo.innerHTML = `
            <div class="profile-details mt-4">
                <div>👤 <strong>Name:</strong> ${user.fullname}</div>
                <div>🎂 <strong>Birth:</strong> ${user.birth}</div>
                <div>🛂 <strong>Passport:</strong> ${user.passport}</div>
                <div>📧 <strong>Email:</strong> ${user.email}</div>
                <button class="logout-btn mt-4" onclick="logoutUser()">
                    Logout / Exit
                </button>
            </div>
        `;
    } else {
        if (profileForm) profileForm.style.display = "block";
        profileInfo.innerHTML = "<div>User not found. Please register or login.</div>";
    }
}

// REGISTER

async function registerUser() {
    const user = {
        fullname: document.getElementById("fullname").value,
        birth: document.getElementById("birth").value,
        passport: document.getElementById("passport").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
    };

    try {
        const response = await fetch("http://localhost:3000/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(user)
        });

        const data = await response.json();
        if (data.success) {
            alert("Registered successfully");
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.log(error);
        alert("Server error");
    }
}

// LOGIN

async function loginUser() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("http://localhost:3000/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (data.success) {
            localStorage.setItem("currentUser", JSON.stringify(data.user));
            alert("Login successful");
            loadProfile();
            loadTickets();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.log(error);
        alert("Server error");
    }
}

// LOGOUT

function logoutUser() {
    if (confirm("Are you sure you want to logout?")) {
        localStorage.removeItem("currentUser");
        loadProfile();
        const ticketsContainer = document.getElementById("tickets");
        if (ticketsContainer) ticketsContainer.innerHTML = "";
    }
}

window.addEventListener("click", (e) => {
    const modal = document.getElementById("profileModal");
    if (e.target === modal) {
        closeProfile();
    }
});
