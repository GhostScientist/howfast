// --- Constants ---
const MPH_CONVERSION_FACTOR = 2.23694;
const KPH_CONVERSION_FACTOR = 3.6;
const MAX_DATA_POINTS = 50; // Points to keep in the graph

// --- State Variables ---
let isMph = true;
let currentSpeed = 0; // m/s
let maxSpeedVal = 0; // m/s
let totalDistance = 0; // meters
let startTime = null;
let lastPosition = null;
let watchId = null;
let wakeLock = null;
let chart = null;

// Debug State
let isDebug = false;
let debugInterval = null;

// Speed history for averaging and graph
let speedHistory = [];

// --- DOM Elements ---
const dom = {
    speed: document.getElementById('speed'),
    unitLabel: document.getElementById('unitLabel'),
    gpsStatus: document.getElementById('gpsStatus'),
    statusDot: document.querySelector('.status-indicator'),
    maxSpeed: document.getElementById('maxSpeed'),
    avgSpeed: document.getElementById('avgSpeed'),
    distance: document.getElementById('distance'),
    duration: document.getElementById('duration'),
    startBtn: document.getElementById('startTracking'),
    mphBtn: document.getElementById('mphBtn'),
    kmhBtn: document.getElementById('kmhBtn'),
    debugBtn: document.getElementById('debugBtn'),
    chartCanvas: document.getElementById('speedChart')
};

// --- Initialization ---
function init() {
    initChart();
    setupEventListeners();
}

function setupEventListeners() {
    dom.startBtn.addEventListener('click', toggleTracking);
    dom.mphBtn.addEventListener('click', () => setUnit(true));
    dom.kmhBtn.addEventListener('click', () => setUnit(false));
    dom.debugBtn.addEventListener('click', toggleDebug);
}

// ... (Chart functions remain the same) ...

// --- Debug Logic ---
function toggleDebug() {
    isDebug = !isDebug;

    if (isDebug) {
        dom.debugBtn.classList.add('active');
        // Stop real tracking if active
        if (watchId) stopTracking();

        startDebugSimulation();
    } else {
        dom.debugBtn.classList.remove('active');
        stopDebugSimulation();
    }
}

function startDebugSimulation() {
    // Mimic startTracking UI updates
    dom.startBtn.classList.add('active');
    dom.startBtn.innerHTML = '<span class="icon">■</span> STOP (DEBUG)';
    dom.gpsStatus.innerText = "DEBUG MODE";
    dom.statusDot.classList.add('active');

    resetSession();
    startTimer();

    // Simulation loop
    let simSpeed = 0;
    debugInterval = setInterval(() => {
        // Randomly accelerate/decelerate
        const delta = (Math.random() - 0.5) * 2; // -1 to 1 m/s change
        simSpeed += delta;
        if (simSpeed < 0) simSpeed = 0;
        if (simSpeed > 45) simSpeed = 45; // ~100mph max

        // Mock position object structure
        const mockPosition = {
            coords: {
                speed: simSpeed,
                latitude: 40.7128 + (totalDistance * 0.000001), // Fake movement for distance calc usually requires lat/lon, 
                // but simpler to just mock distance directly in debug if we wanted, 
                // OR actualy update lat/lon to test Haversine.
                // Let's just mock speed and manually increment distance for debug simplicity.
                longitude: -74.0060
            }
        };

        // Manually handle distance for debug since lat/lon math on tiny random numbers is messy
        // At 1Hz interval, distance = speed (m/s) * 1s
        const dist = simSpeed;
        if (dist > 0.1) totalDistance += dist;

        // Reuse handlePosition variables logic locally or mock it?
        // Let's reuse standard flow but bypass the distance calc in handlePosition if debugging to avoid Haversine noise

        // Actually, let's just create a pure mock handler to keep it clean
        handleDebugTick(simSpeed);

    }, 1000); // 1Hz update like standard GPS
}

function stopDebugSimulation() {
    if (debugInterval) clearInterval(debugInterval);
    debugInterval = null;

    // Restore UI
    dom.startBtn.classList.remove('active');
    dom.startBtn.innerHTML = '<span class="icon">▶</span> START';
    dom.gpsStatus.innerText = "GPS OFF";
    dom.statusDot.classList.remove('active');

    stopTimer();
}

function handleDebugTick(simSpeed) {
    currentSpeed = simSpeed;

    // High score
    if (currentSpeed > maxSpeedVal) maxSpeedVal = currentSpeed;

    // History
    speedHistory.push(currentSpeed);

    updateDisplay();
    updateChart(currentSpeed);
}

// ... (Rest of Geometry & Logic) ...

// --- Logic ---
function toggleTracking() {
    // If debug is on, start button just restarts the sim
    if (isDebug) {
        // If sim running, stop it
        if (debugInterval) {
            toggleDebug(); // Actually just toggle safe mode off? Or just stop?
            // User said "toggleable debug speed tracking that simulates GPS".
            // Let's say big button stops debug too.
            stopDebugSimulation();
            dom.debugBtn.classList.remove('active');
            isDebug = false;
        } else {
            // Start sim
            startDebugSimulation();
        }
    } else {
        if (watchId) {
            stopTracking();
        } else {
            startTracking();
        }
    }
}
// ... (startTracking/stopTracking/etc remain but we need to ensure they don't conflict)

function handlePosition(position) {
    if (isDebug) return; // Ignore real GPS if debug is on

    const { latitude, longitude, speed } = position.coords;

    // speed is m/s, can be null
    currentSpeed = speed || 0;

    // Filter noise
    if (currentSpeed < 0.5) currentSpeed = 0;

    // Update Max Speed
    if (currentSpeed > maxSpeedVal) maxSpeedVal = currentSpeed;

    // Update Distance
    if (lastPosition) {
        const dist = calculateDistance(
            lastPosition.latitude,
            lastPosition.longitude,
            latitude,
            longitude
        );
        if (dist > 5) {
            totalDistance += dist;
        }
    }
    lastPosition = { latitude, longitude };

    // Update History
    speedHistory.push(currentSpeed);

    updateDisplay();
    updateChart(currentSpeed);
}

// --- Chart.js Setup ---
function initChart() {
    const ctx = dom.chartCanvas.getContext('2d');

    // Check color scheme for initial render
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const color = isDark ? '#ffffff' : '#000000';

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(MAX_DATA_POINTS).fill(''),
            datasets: [{
                label: 'Speed',
                data: Array(MAX_DATA_POINTS).fill(0),
                borderColor: color,
                backgroundColor: 'transparent',
                borderWidth: 1.5, // Thin line
                pointRadius: 0,
                fill: false,
                tension: 0 // Sharp lines for brutalist look, or 0.1 for slight smooth
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: {
                x: { display: false },
                y: {
                    display: false, // Hide y-axis for cleaner look
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            layout: {
                padding: 0
            }
        }
    });

    // Listener for theme change to update chart color
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        const newColor = e.matches ? '#ffffff' : '#000000';
        chart.data.datasets[0].borderColor = newColor;
        chart.update();
    });
}

// --- Geometry & Math ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// --- Logic ---
function toggleTracking() {
    if (watchId) {
        stopTracking();
    } else {
        startTracking();
    }
}

async function startTracking() {
    if (!navigator.geolocation) {
        alert("Geolocation not supported");
        return;
    }

    try {
        // Request Wake Lock
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.warn('Wake Lock error:', err);
    }

    // Reset stats if improved session logic needed, else accumulate
    // For now, let's reset on new start for clean session
    resetSession();

    const options = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
    };

    watchId = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        options
    );

    dom.startBtn.classList.add('active');
    dom.startBtn.innerHTML = '<span class="icon">■</span> STOP';
    dom.gpsStatus.innerText = "GPS ACTIVE";
    dom.statusDot.classList.add('active');

    // Start duration timer
    startTimer();
}

function stopTracking() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (wakeLock) wakeLock.release();

    watchId = null;
    wakeLock = null;

    dom.startBtn.classList.remove('active');
    dom.startBtn.innerHTML = '<span class="icon">▶</span> RESUME';
    dom.gpsStatus.innerText = "GPS PAUSED";
    dom.statusDot.classList.remove('active');

    stopTimer();
}

function resetSession() {
    currentSpeed = 0;
    maxSpeedVal = 0;
    totalDistance = 0;
    speedHistory = [];
    startTime = Date.now();
    lastPosition = null;
    updateDisplay();
}

let timerInterval;
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now() - (lastDuration || 0); // Resume capability
    timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        const totalSecs = Math.floor(diff / 1000);
        const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
        const secs = (totalSecs % 60).toString().padStart(2, '0');
        dom.duration.innerText = `${mins}:${secs}`;
    }, 1000);
}

let lastDuration = 0;
function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    lastDuration = Date.now() - startTime;
}

function handlePosition(position) {
    const { latitude, longitude, speed } = position.coords;

    // speed is m/s, can be null
    currentSpeed = speed || 0;

    // Filter noise: ignore very low speeds implies stationary
    if (currentSpeed < 0.5) currentSpeed = 0;

    // Update Max Speed
    if (currentSpeed > maxSpeedVal) maxSpeedVal = currentSpeed;

    // Update Distance
    if (lastPosition) {
        const dist = calculateDistance(
            lastPosition.latitude,
            lastPosition.longitude,
            latitude,
            longitude
        );
        // Only add significant movement to avoid accumulated GPS jitter
        if (dist > 5) {
            totalDistance += dist;
        }
    }
    lastPosition = { latitude, longitude };

    // Update History for Avg
    speedHistory.push(currentSpeed);

    updateDisplay();
    updateChart(currentSpeed);
}

function handleError(err) {
    console.warn('GPS Error:', err);
    dom.gpsStatus.innerText = "GPS ERROR";
}

function updateDisplay() {
    const factor = isMph ? MPH_CONVERSION_FACTOR : KPH_CONVERSION_FACTOR;
    const unit = isMph ? 'MPH' : 'KM/H';
    const distUnit = isMph ? 'mi' : 'km';
    const distFactor = isMph ? 0.000621371 : 0.001; // meters to mi/km

    // Main Speed
    dom.speed.innerText = (currentSpeed * factor).toFixed(1);
    dom.unitLabel.innerText = unit;

    // Max Speed
    dom.maxSpeed.innerText = (maxSpeedVal * factor).toFixed(1);

    // Avg Speed
    const avg = speedHistory.length > 0
        ? (speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length)
        : 0;
    dom.avgSpeed.innerText = (avg * factor).toFixed(1);

    // Distance
    dom.distance.innerText = (totalDistance * distFactor).toFixed(2);
    dom.distance.nextElementSibling.innerText = distUnit;
}

function updateChart(speedMs) {
    if (!chart) return;

    const factor = isMph ? MPH_CONVERSION_FACTOR : KPH_CONVERSION_FACTOR;
    const val = speedMs * factor;

    // Remove oldest, add newest
    const data = chart.data.datasets[0].data;
    data.shift();
    data.push(val);

    chart.update();
}

function setUnit(mph) {
    isMph = mph;

    if (isMph) {
        dom.mphBtn.classList.add('active');
        dom.mphBtn.setAttribute('aria-pressed', 'true');
        dom.kmhBtn.classList.remove('active');
        dom.kmhBtn.setAttribute('aria-pressed', 'false');
    } else {
        dom.kmhBtn.classList.add('active');
        dom.kmhBtn.setAttribute('aria-pressed', 'true');
        dom.mphBtn.classList.remove('active');
        dom.mphBtn.setAttribute('aria-pressed', 'false');
    }

    updateDisplay();

    // Clean chart transition (optional, could just let it slide out)
    // For now we just let the values scale naturally on next update or if we wanted to
    // re-render the whole history with new unit we would store history in m/s and map it.
    // The current chart logic pushes new converted values, so old values stay in old unit until scrolled out.
    // To fix this instantly:
    const factor = isMph ? MPH_CONVERSION_FACTOR : KPH_CONVERSION_FACTOR;
    const prevFactor = isMph ? KPH_CONVERSION_FACTOR : MPH_CONVERSION_FACTOR; // Approximate flip
    // Better: re-map history
    const data = chart.data.datasets[0].data;
    // We don't store raw m/s history for the chart specifically in this simple version, 
    // but we could map the existing data points if we wanted smooth transition.
    // Simple fix: reset chart or let it slide. 
    // Let's reset chart data for cleanliness.
    chart.data.datasets[0].data = Array(MAX_DATA_POINTS).fill(0);
    chart.update();
}

// Start
document.addEventListener('DOMContentLoaded', init);
