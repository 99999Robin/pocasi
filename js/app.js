// Pocasi - najde mesto a ukaze aktualni pocasi, predpoved na 24 hodin a na 7 dni.
// Data jsou z Open-Meteo (https://open-meteo.com), ktere je zdarma a nepotrebuje API klic.

// kody pocasi (WMO) podle dokumentace Open-Meteo, ke kazdemu cesky popis a ikona,
// night je ikona pro noc tam, kde je na denni ikone slunce
const WEATHER_CODES = {
    0: { text: "Jasno", icon: "☀️", night: "🌙" },
    1: { text: "Převážně jasno", icon: "🌤️", night: "🌙" },
    2: { text: "Polojasno", icon: "⛅", night: "☁️" },
    3: { text: "Zataženo", icon: "☁️" },
    45: { text: "Mlha", icon: "🌫️" },
    48: { text: "Mrznoucí mlha", icon: "🌫️" },
    51: { text: "Slabé mrholení", icon: "🌦️", night: "🌧️" },
    53: { text: "Mírné mrholení", icon: "🌦️", night: "🌧️" },
    55: { text: "Silné mrholení", icon: "🌧️" },
    56: { text: "Mrznoucí mrholení", icon: "🌨️" },
    57: { text: "Silné mrznoucí mrholení", icon: "🌨️" },
    61: { text: "Slabý déšť", icon: "🌦️", night: "🌧️" },
    63: { text: "Mírný déšť", icon: "🌧️" },
    65: { text: "Silný déšť", icon: "🌧️" },
    66: { text: "Mrznoucí déšť", icon: "🌨️" },
    67: { text: "Silný mrznoucí déšť", icon: "🌨️" },
    71: { text: "Slabé sněžení", icon: "🌨️" },
    73: { text: "Mírné sněžení", icon: "❄️" },
    75: { text: "Silné sněžení", icon: "❄️" },
    77: { text: "Sněhová zrna", icon: "🌨️" },
    80: { text: "Slabé přeháňky", icon: "🌦️", night: "🌧️" },
    81: { text: "Mírné přeháňky", icon: "🌧️" },
    82: { text: "Silné přeháňky", icon: "⛈️" },
    85: { text: "Slabé sněhové přeháňky", icon: "🌨️" },
    86: { text: "Silné sněhové přeháňky", icon: "❄️" },
    95: { text: "Bouřka", icon: "⛈️" },
    96: { text: "Bouřka se slabým krupobitím", icon: "⛈️" },
    99: { text: "Bouřka se silným krupobitím", icon: "⛈️" }
};

let chart = null;
let chartType = "temperature";
let chartData = null;
let chartStart = 0;

let searchForm = document.getElementById("searchForm");
let cityInput = document.getElementById("cityInput");
let errorText = document.getElementById("errorText");

async function loadWeather(city) {
    errorText.hidden = true;

    try {
        // nejdriv se podle nazvu mesta zjisti jeho souradnice
        let geoUrl = "https://geocoding-api.open-meteo.com/v1/search?count=1&language=cs&name="
            + encodeURIComponent(city);
        let geoResponse = await fetch(geoUrl);
        let geoData = await geoResponse.json();

        // kdyz se nic nenajde, results v odpovedi vubec neni
        if (!geoData.results) {
            showError("Město " + city + " se nepodařilo najít.");
            return;
        }

        let place = geoData.results[0];

        let weatherUrl = "https://api.open-meteo.com/v1/forecast?timezone=auto"
            + "&latitude=" + place.latitude
            + "&longitude=" + place.longitude
            + "&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,"
            + "weather_code,pressure_msl,wind_speed_10m,wind_direction_10m"
            + "&hourly=temperature_2m,weather_code,is_day,precipitation_probability,wind_speed_10m"
            + "&daily=weather_code,temperature_2m_max,temperature_2m_min,"
            + "precipitation_probability_max,uv_index_max,sunrise,sunset";
        let weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) {
            showError("Server s počasím teď neodpovídá, zkuste to prosím později.");
            return;
        }

        let weather = await weatherResponse.json();

        // hodiny i graf zacinaji aktualni hodinou, napr. pro cas "2026-11-20T18:45"
        // se v seznamu hodin hleda "2026-11-20T18:00"
        let hour = weather.current.time.slice(0, 13) + ":00";
        let start = weather.hourly.time.indexOf(hour);

        showCurrent(place, weather.current, weather.daily);
        showHours(weather.hourly, start);
        showDays(weather.daily);

        // graf si data pamatuje, aby se dal po kliknuti na zalozku nakreslit znovu
        chartData = weather.hourly;
        chartStart = start;
        drawChart();
    } catch (e) {
        // sem se to dostane hlavne tehdy, kdyz nejde internet
        showError("Nepodařilo se načíst data. Zkontrolujte připojení k internetu.");
    }
}

function showError(message) {
    errorText.textContent = message;
    errorText.hidden = false;
}

function getIcon(code, isDay) {
    let weather = WEATHER_CODES[code];

    if (isDay === 0 && weather.night) {
        return weather.night;
    }

    return weather.icon;
}

function showCurrent(place, current, daily) {
    let weather = WEATHER_CODES[current.weather_code];
    let icon = getIcon(current.weather_code, current.is_day);
    let feels = Math.round(current.apparent_temperature);

    document.getElementById("cityName").textContent = place.name;
    document.getElementById("cityCountry").textContent = place.country;
    document.getElementById("currentIcon").textContent = icon;
    document.getElementById("currentTemp").textContent = Math.round(current.temperature_2m);
    document.getElementById("currentDesc").textContent = weather.text;
    document.getElementById("currentFeels").textContent = "Pocitová teplota " + feels + " °C";
    document.getElementById("humidity").textContent = current.relative_humidity_2m;
    document.getElementById("wind").textContent = Math.round(current.wind_speed_10m);
    document.getElementById("windDir").textContent = windDirection(current.wind_direction_10m);
    document.getElementById("pressure").textContent = Math.round(current.pressure_msl);

    // UV index je nejvyssi hodnota za dnesek
    document.getElementById("uv").textContent = Math.round(daily.uv_index_max[0]);

    // cas je v textu az za T, napr. "2026-11-20T07:12"
    document.getElementById("sunrise").textContent = daily.sunrise[0].slice(11);
    document.getElementById("sunset").textContent = daily.sunset[0].slice(11);
}

// stupne -> svetova strana, kruh je rozdeleny na 8 dilu po 45 stupnich
function windDirection(degrees) {
    let names = ["S", "SV", "V", "JV", "J", "JZ", "Z", "SZ"];
    let index = Math.round(degrees / 45) % 8;
    return names[index];
}

function showHours(hourly, start) {
    let html = "";

    for (let i = start; i < start + 24; i++) {
        let code = hourly.weather_code[i];
        let icon = getIcon(code, hourly.is_day[i]);
        let temp = Math.round(hourly.temperature_2m[i]);
        let time = hourly.time[i].slice(11);

        if (i === start) {
            time = "Nyní";
        }

        // u hodin bez srazek se misto 0 % nepise nic
        let rain = "";

        if (hourly.precipitation_probability[i] > 0) {
            rain = hourly.precipitation_probability[i] + " %";
        }

        html = html + "<li class='hourly-item'>";
        html = html + "<span class='hourly-item__time'>" + time + "</span>";
        html = html + "<span class='hourly-item__icon' title='" + WEATHER_CODES[code].text + "'>";
        html = html + icon + "</span>";
        html = html + "<span class='hourly-item__temp'>" + temp + "°</span>";
        html = html + "<span class='hourly-item__rain'>" + rain + "</span>";
        html = html + "</li>";
    }

    document.getElementById("hourlyList").innerHTML = html;
}

function showDays(daily) {
    // nejnizsi a nejvyssi teplota za cely tyden, z nich se pocitaji pruhy jednotlivych dni
    let weekMin = daily.temperature_2m_min[0];
    let weekMax = daily.temperature_2m_max[0];

    for (let i = 0; i < daily.time.length; i++) {
        if (daily.temperature_2m_min[i] < weekMin) {
            weekMin = daily.temperature_2m_min[i];
        }

        if (daily.temperature_2m_max[i] > weekMax) {
            weekMax = daily.temperature_2m_max[i];
        }
    }

    let range = weekMax - weekMin;
    let html = "";

    for (let i = 0; i < daily.time.length; i++) {
        let weather = WEATHER_CODES[daily.weather_code[i]];
        let date = new Date(daily.time[i]);
        let day = date.toLocaleDateString("cs-CZ", { weekday: "long" });

        if (i === 0) {
            day = "dnes";
        }

        let rain = daily.precipitation_probability_max[i] + " %";

        // u nekterych dni API pravdepodobnost srazek neposle
        if (daily.precipitation_probability_max[i] === null) {
            rain = "-";
        }

        let min = daily.temperature_2m_min[i];
        let max = daily.temperature_2m_max[i];

        // kde barevny pruh zacina a jak je dlouhy, v procentech z rozpeti celeho tydne
        let left = (min - weekMin) / range * 100;
        let width = (max - min) / range * 100;

        html = html + "<li class='daily-item'>";
        html = html + "<span class='daily-item__day'>" + day + "</span>";
        html = html + "<span class='daily-item__icon' title='" + weather.text + "'>";
        html = html + weather.icon + "</span>";
        html = html + "<span class='daily-item__rain'>💧 " + rain + "</span>";
        html = html + "<div class='daily-item__temp'>";
        html = html + "<span class='daily-item__min'>" + Math.round(min) + "°</span>";
        html = html + "<div class='daily-item__bar'>";
        html = html + "<div class='daily-item__fill' style='left: " + left + "%;";
        html = html + " width: " + width + "%'></div>";
        html = html + "</div>";
        html = html + "<span class='daily-item__max'>" + Math.round(max) + "°</span>";
        html = html + "</div>";
        html = html + "</li>";
    }

    document.getElementById("dailyList").innerHTML = html;
}

function drawChart() {
    let labels = [];

    for (let i = chartStart; i < chartStart + 48; i++) {
        let text = chartData.time[i].slice(11);

        // o pulnoci je misto hodiny datum, aby bylo poznat, kde zacina dalsi den
        if (text === "00:00") {
            let date = new Date(chartData.time[i]);
            text = date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
        }

        labels.push(text);
    }

    let label = "Teplota (°C)";
    let values = chartData.temperature_2m;
    let lineColor = "#f97316";
    let fillColor = "rgba(249, 115, 22, 0.2)";

    if (chartType === "precipitation") {
        label = "Pravděpodobnost srážek (%)";
        values = chartData.precipitation_probability;
        lineColor = "#0ea5e9";
        fillColor = "rgba(14, 165, 233, 0.2)";
    } else if (chartType === "wind") {
        label = "Rychlost větru (km/h)";
        values = chartData.wind_speed_10m;
        lineColor = "#8b5cf6";
        fillColor = "rgba(139, 92, 246, 0.2)";
    }

    let points = values.slice(chartStart, chartStart + 48);

    // tahle seda je dobre videt na svetlem i tmavem pozadi,
    // takze se graf pri prepnuti rezimu nemusi kreslit znovu
    let textColor = "#7c8a9e";
    let gridColor = "rgba(148, 163, 184, 0.25)";

    // do platna, ve kterem uz graf je, Chart.js novy nenakresli
    if (chart) {
        chart.destroy();
    }

    let canvas = document.getElementById("weatherChart");

    chart = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: points,
                borderColor: lineColor,
                backgroundColor: fillColor,
                fill: true,
                tension: 0.3,
                pointRadius: 0
            }]
        },
        options: {
            maintainAspectRatio: false,
            // bublina s hodnotou se ukaze, i kdyz mys neni presne na care
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: { padding: 12, displayColors: false }
            },
            scales: {
                x: {
                    ticks: { color: textColor, maxRotation: 0, maxTicksLimit: 12 },
                    grid: { color: gridColor }
                },
                y: {
                    title: { display: true, text: label, color: textColor },
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                }
            }
        }
    });
}

let tabs = document.querySelectorAll(".tab");

for (let i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener("click", function () {
        for (let j = 0; j < tabs.length; j++) {
            tabs[j].classList.remove("tab--active");
        }

        tabs[i].classList.add("tab--active");
        chartType = tabs[i].dataset.chart;
        drawChart();
    });
}

searchForm.addEventListener("submit", function (event) {
    // bez tohohle by prohlizec formular odeslal a stranku znovu nacetl
    event.preventDefault();

    let city = cityInput.value.trim();
    loadWeather(city);
});

let themeButton = document.getElementById("themeButton");

// volba se uklada do localStorage, po nacteni ji zapne skript v hlavicce index.html
themeButton.addEventListener("click", function () {
    // toggle tridu prida nebo odebere a vrati true, kdyz je ted tmavy rezim zapnuty
    let dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("dark", dark);
});

// po otevreni stranky se rovnou ukaze pocasi v Praze
loadWeather("Jirkov");
