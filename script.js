// --- Constants ---
const MPH_CONVERSION_FACTOR = 2.23694;
const KPH_CONVERSION_FACTOR = 3.6;
const METERS_TO_MILES = 0.000621371;
const METERS_TO_KM = 0.001;

// --- State Variables ---
let isMph = true;
let currentSpeed = 0; // m/s
let isTracking = false;
let isRecording = false;
let watchId = null;

// Speed history for chart
let speedHistory = [];
let timeHistory = [];
let startTime = null;

// Metrics
let maxSpeed = 0;
let totalDistance = 0;
let lastPosition = null;
let speedReadings = [];

// Current recording data
let currentRecording = {
    data: [],
    startTime: null,
    endTime: null
};

// Settings with defaults
let settings = {
    updateInterval: 1000,
    chartDuration: 60,
    highAccuracy: true,
    autoSave: true,
    darkMode: false
};

// Chart instance
let speedChart = null;

// --- DOM Elements ---
const speedValue = document.getElementById('speedValue');
const speedUnit = document.getElementById('speedUnit');
const startTrackingBtn = document.getElementById('startTracking');
const mphBtn = document.getElementById('mphBtn');
const kmhBtn = document.getElementById('kmhBtn');
const unitToggle = document.getElementById('unitToggle');
const metricsSection = document.getElementById('metricsSection');
const chartSection = document.getElementById('chartSection');
const recordingsSection = document.getElementById('recordingsSection');
const currentSpeedMetric = document.getElementById('currentSpeedMetric');
const avgSpeedElement = document.getElementById('avgSpeed');
const maxSpeedElement = document.getElementById('maxSpeed');
const distanceElement = document.getElementById('distance');
const recordBtn = document.getElementById('recordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const saveSettingsBtn = document.getElementById('saveSettings');
const resetSettingsBtn = document.getElementById('resetSettings');
const recordingsList = document.getElementById('recordingsList');
const clearAllBtn = document.getElementById('clearAllBtn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadRecordings();
    initializeChart();
    attachEventListeners();
    applyDarkMode();
    checkGeolocationSupport();
});

// --- Settings Management ---
function loadSettings() {
    const saved = localStorage.getItem('speedometerSettings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
        document.getElementById('updateInterval').value = settings.updateInterval;
        document.getElementById('chartDuration').value = settings.chartDuration;
        document.getElementById('highAccuracy').checked = settings.highAccuracy;
        document.getElementById('autoSave').checked = settings.autoSave;
        document.getElementById('darkMode').checked = settings.darkMode;
    }
}

function saveSettings() {
    settings.updateInterval = parseInt(document.getElementById('updateInterval').value);
    settings.chartDuration = parseInt(document.getElementById('chartDuration').value);
    settings.highAccuracy = document.getElementById('highAccuracy').checked;
    settings.autoSave = document.getElementById('autoSave').checked;
    settings.darkMode = document.getElementById('darkMode').checked;
    
    localStorage.setItem('speedometerSettings', JSON.stringify(settings));
    applyDarkMode();
    closeSettingsModal();
    
    // Reinitialize chart with new duration
    if (speedChart) {
        speedHistory = speedHistory.slice(-Math.ceil(settings.chartDuration / (settings.updateInterval / 1000)));
        timeHistory = timeHistory.slice(-Math.ceil(settings.chartDuration / (settings.updateInterval / 1000)));
        updateChart();
    }
}

function resetSettings() {
    settings = {
        updateInterval: 1000,
        chartDuration: 60,
        highAccuracy: true,
        autoSave: true,
        darkMode: false
    };
    localStorage.removeItem('speedometerSettings');
    loadSettings();
    applyDarkMode();
}

function applyDarkMode() {
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// --- Chart Management ---
function initializeChart() {
    const ctx = document.getElementById('speedChart');
    if (!ctx) return;
    
    const isDark = settings.darkMode;
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
    
    speedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Speed',
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 300
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toFixed(2) + ' ' + (isMph ? 'mph' : 'km/h');
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        maxTicksLimit: 6
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

function updateChart() {
    if (!speedChart) return;
    
    const maxPoints = Math.ceil(settings.chartDuration / (settings.updateInterval / 1000));
    const displayData = speedHistory.slice(-maxPoints);
    const displayTime = timeHistory.slice(-maxPoints);
    
    speedChart.data.labels = displayTime;
    speedChart.data.datasets[0].data = displayData;
    speedChart.update('none'); // Update without animation for smooth real-time feel
}

// --- Tracking Functions ---
function startTracking() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by this browser.');
        return;
    }
    
    const options = {
        enableHighAccuracy: settings.highAccuracy,
        maximumAge: 0,
        timeout: 10000
    };
    
    watchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handleGeolocationError,
        options
    );
    
    isTracking = true;
    startTime = Date.now();
    startTrackingBtn.classList.add('hidden');
    unitToggle.classList.remove('hidden');
    metricsSection.classList.remove('hidden');
    chartSection.classList.remove('hidden');
    recordingsSection.classList.remove('hidden');
    
    // Reset metrics
    maxSpeed = 0;
    totalDistance = 0;
    speedReadings = [];
    lastPosition = null;
}

function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    if (isRecording) {
        stopRecording();
    }
    
    isTracking = false;
}

function handlePositionUpdate(position) {
    currentSpeed = position.coords.speed || 0;
    if (currentSpeed < 0) currentSpeed = 0; // Ensure non-negative
    
    // Update speed display
    updateSpeedDisplay();
    
    // Calculate distance
    if (lastPosition && position.coords.latitude && position.coords.longitude) {
        const distance = calculateDistance(
            lastPosition.latitude,
            lastPosition.longitude,
            position.coords.latitude,
            position.coords.longitude
        );
        totalDistance += distance;
    }
    
    lastPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
    };
    
    // Update metrics
    const convertedSpeed = isMph ? currentSpeed * MPH_CONVERSION_FACTOR : currentSpeed * KPH_CONVERSION_FACTOR;
    speedReadings.push(convertedSpeed);
    
    if (convertedSpeed > maxSpeed) {
        maxSpeed = convertedSpeed;
    }
    
    updateMetrics();
    
    // Update chart
    const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
    const timeLabel = formatTime(elapsed);
    
    speedHistory.push(convertedSpeed);
    timeHistory.push(timeLabel);
    
    // Keep only recent data based on chart duration
    const maxPoints = Math.ceil(settings.chartDuration / (settings.updateInterval / 1000)) * 2;
    if (speedHistory.length > maxPoints) {
        speedHistory.shift();
        timeHistory.shift();
    }
    
    updateChart();
    
    // Record data if recording
    if (isRecording) {
        currentRecording.data.push({
            timestamp: Date.now(),
            speed: currentSpeed,
            speedConverted: convertedSpeed,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
        });
    }
}

function handleGeolocationError(error) {
    console.error('Geolocation error:', error);
    let message = 'Error getting location: ';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message += 'Location access denied. Please enable it in your browser settings.';
            break;
        case error.POSITION_UNAVAILABLE:
            message += 'Location information is unavailable.';
            break;
        case error.TIMEOUT:
            message += 'Location request timed out.';
            break;
        default:
            message += 'An unknown error occurred.';
    }
    
    alert(message);
}

// --- Speed Display ---
function updateSpeedDisplay() {
    const convertedSpeed = isMph ? 
        currentSpeed * MPH_CONVERSION_FACTOR : 
        currentSpeed * KPH_CONVERSION_FACTOR;
    
    speedValue.textContent = convertedSpeed.toFixed(2);
    speedUnit.textContent = isMph ? 'mph' : 'km/h';
}

function updateMetrics() {
    const convertedSpeed = isMph ? 
        currentSpeed * MPH_CONVERSION_FACTOR : 
        currentSpeed * KPH_CONVERSION_FACTOR;
    
    const avgSpeed = speedReadings.length > 0 ?
        speedReadings.reduce((a, b) => a + b, 0) / speedReadings.length : 0;
    
    const distanceConverted = isMph ? 
        totalDistance * METERS_TO_MILES : 
        totalDistance * METERS_TO_KM;
    
    const unit = isMph ? 'mph' : 'km/h';
    const distUnit = isMph ? 'mi' : 'km';
    
    currentSpeedMetric.textContent = convertedSpeed.toFixed(2);
    avgSpeedElement.textContent = avgSpeed.toFixed(2);
    maxSpeedElement.textContent = maxSpeed.toFixed(2);
    distanceElement.textContent = distanceConverted.toFixed(2);
    
    // Update all metric units
    document.querySelectorAll('.metric-unit').forEach((el, idx) => {
        el.textContent = idx === 3 ? distUnit : unit;
    });
}

// --- Recording Functions ---
function startRecording() {
    if (!isTracking) {
        alert('Please start tracking first');
        return;
    }
    
    isRecording = true;
    currentRecording = {
        data: [],
        startTime: Date.now(),
        endTime: null
    };
    
    recordBtn.classList.add('hidden');
    stopRecordBtn.classList.remove('hidden');
    recordBtn.classList.add('recording');
}

function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    currentRecording.endTime = Date.now();
    
    recordBtn.classList.remove('hidden');
    stopRecordBtn.classList.add('hidden');
    recordBtn.classList.remove('recording');
    
    if (settings.autoSave && currentRecording.data.length > 0) {
        saveRecording(currentRecording);
    }
    
    currentRecording = {
        data: [],
        startTime: null,
        endTime: null
    };
}

function saveRecording(recording) {
    const recordings = getRecordings();
    const id = Date.now().toString();
    
    const recordingData = {
        id,
        startTime: recording.startTime,
        endTime: recording.endTime,
        duration: recording.endTime - recording.startTime,
        data: recording.data,
        unit: isMph ? 'mph' : 'km/h',
        maxSpeed: Math.max(...recording.data.map(d => d.speedConverted)),
        avgSpeed: recording.data.reduce((a, b) => a + b.speedConverted, 0) / recording.data.length
    };
    
    recordings.unshift(recordingData);
    
    // Keep only last 50 recordings
    if (recordings.length > 50) {
        recordings.splice(50);
    }
    
    localStorage.setItem('speedometerRecordings', JSON.stringify(recordings));
    loadRecordings();
}

function getRecordings() {
    const saved = localStorage.getItem('speedometerRecordings');
    return saved ? JSON.parse(saved) : [];
}

function loadRecordings() {
    const recordings = getRecordings();
    const container = recordingsList;
    
    if (recordings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <p>No recordings yet</p>
                <small>Start recording to save your speed data</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recordings.map(rec => `
        <div class="recording-item" data-id="${rec.id}">
            <div class="recording-info">
                <div class="recording-date">${new Date(rec.startTime).toLocaleString()}</div>
                <div class="recording-stats">
                    <span>Duration: ${formatDuration(rec.duration)}</span>
                    <span>Max: ${rec.maxSpeed.toFixed(2)} ${rec.unit}</span>
                    <span>Avg: ${rec.avgSpeed.toFixed(2)} ${rec.unit}</span>
                    <span>Points: ${rec.data.length}</span>
                </div>
            </div>
            <div class="recording-actions">
                <button type="button" class="icon-btn" onclick="exportRecording('${rec.id}')" title="Export to CSV">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                </button>
                <button type="button" class="icon-btn" onclick="deleteRecording('${rec.id}')" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function exportRecording(id) {
    const recordings = getRecordings();
    const recording = recordings.find(r => r.id === id);
    
    if (!recording) return;
    
    // Create CSV content
    let csv = 'Timestamp,Elapsed Time (s),Speed (m/s),Speed (' + recording.unit + '),Latitude,Longitude,Accuracy (m)\n';
    
    const startTime = recording.startTime;
    recording.data.forEach(point => {
        const elapsed = ((point.timestamp - startTime) / 1000).toFixed(2);
        csv += `${new Date(point.timestamp).toISOString()},${elapsed},${point.speed.toFixed(4)},${point.speedConverted.toFixed(4)},${point.latitude},${point.longitude},${point.accuracy}\n`;
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speedometer-recording-${new Date(startTime).toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function deleteRecording(id) {
    if (!confirm('Delete this recording?')) return;
    
    let recordings = getRecordings();
    recordings = recordings.filter(r => r.id !== id);
    localStorage.setItem('speedometerRecordings', JSON.stringify(recordings));
    loadRecordings();
}

function clearAllRecordings() {
    if (!confirm('Delete all recordings? This cannot be undone.')) return;
    
    localStorage.removeItem('speedometerRecordings');
    loadRecordings();
}

// --- Unit Conversion ---
function switchToMph() {
    const previousIsMph = isMph;
    isMph = true;
    mphBtn.classList.add('active');
    kmhBtn.classList.remove('active');
    mphBtn.setAttribute('aria-pressed', 'true');
    kmhBtn.setAttribute('aria-pressed', 'false');
    
    // Recalculate everything with new units
    recalculateWithUnits(previousIsMph);
}

function switchToKmh() {
    const previousIsMph = isMph;
    isMph = false;
    kmhBtn.classList.add('active');
    mphBtn.classList.remove('active');
    kmhBtn.setAttribute('aria-pressed', 'true');
    mphBtn.setAttribute('aria-pressed', 'false');
    
    // Recalculate everything with new units
    recalculateWithUnits(previousIsMph);
}

function recalculateWithUnits(previousIsMph) {
    if (previousIsMph === isMph) {
        updateSpeedDisplay();
        updateMetrics();
        updateChart();
        return;
    }
    
    // Recalculate speed history from previous unit -> m/s -> new unit
    speedHistory = speedHistory.map(speed => {
        const mps = previousIsMph ? speed / MPH_CONVERSION_FACTOR : speed / KPH_CONVERSION_FACTOR;
        return isMph ? mps * MPH_CONVERSION_FACTOR : mps * KPH_CONVERSION_FACTOR;
    });
    
    // Recalculate max speed
    const mpsMax = previousIsMph ? maxSpeed / MPH_CONVERSION_FACTOR : maxSpeed / KPH_CONVERSION_FACTOR;
    maxSpeed = isMph ? mpsMax * MPH_CONVERSION_FACTOR : mpsMax * KPH_CONVERSION_FACTOR;
    
    // Recalculate speed readings
    speedReadings = speedReadings.map(speed => {
        const mps = previousIsMph ? speed / MPH_CONVERSION_FACTOR : speed / KPH_CONVERSION_FACTOR;
        return isMph ? mps * MPH_CONVERSION_FACTOR : mps * KPH_CONVERSION_FACTOR;
    });
    
    updateSpeedDisplay();
    updateMetrics();
    updateChart();
}

// --- Modal Functions ---
function openSettingsModal() {
    settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
    settingsModal.classList.add('hidden');
}

// --- Utility Functions ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in meters
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hours = Math.floor(mins / 60);
    const displayMins = mins % 60;
    
    if (hours > 0) {
        return `${hours}h ${displayMins}m`;
    }
    return `${displayMins}m ${secs}s`;
}

function checkGeolocationSupport() {
    if (!navigator.geolocation) {
        speedValue.textContent = 'Not Supported';
        startTrackingBtn.disabled = true;
        startTrackingBtn.textContent = 'Geolocation Not Supported';
    }
}

// --- Event Listeners ---
function attachEventListeners() {
    startTrackingBtn?.addEventListener('click', startTracking);
    mphBtn?.addEventListener('click', switchToMph);
    kmhBtn?.addEventListener('click', switchToKmh);
    recordBtn?.addEventListener('click', startRecording);
    stopRecordBtn?.addEventListener('click', stopRecording);
    settingsBtn?.addEventListener('click', openSettingsModal);
    closeSettingsBtn?.addEventListener('click', closeSettingsModal);
    saveSettingsBtn?.addEventListener('click', saveSettings);
    resetSettingsBtn?.addEventListener('click', resetSettings);
    clearAllBtn?.addEventListener('click', clearAllRecordings);
    
    // Close modal on outside click
    settingsModal?.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });
    
    // Prevent tracking stop when page is hidden (background tab)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isTracking) {
            console.log('Page hidden, tracking continues in background');
        }
    });
}

// Make functions globally accessible for inline event handlers
window.exportRecording = exportRecording;
window.deleteRecording = deleteRecording;
