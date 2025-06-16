// --- Constants ---
const MPH_CONVERSION_FACTOR = 2.23694;
const KPH_CONVERSION_FACTOR = 3.6;

// --- State Variables ---
let isMph = true;
let currentSpeed = 0; // Stores speed in m/s, as provided by the Geolocation API
let grantedLocationAccess = false;
let watchId = null; // To store the ID of the geolocation watch

// --- DOM Elements ---
// Cache DOM elements that are frequently accessed
const speedDisplay = document.getElementById('speed');
const startTrackingBtn = document.getElementById('startTracking');
const mphBtn = document.getElementById('mphBtn');
const kmhBtn = document.getElementById('kmhBtn');

// --- Functions ---

/**
 * Processes the new geographic position provided by the Geolocation API.
 * @param {GeolocationPosition} position - The position object.
 */
function processNewPosition(position) {
    if (!grantedLocationAccess) {
        grantedLocationAccess = true;
        // Show unit buttons and hide the start button
        mphBtn.style.display = 'inline-block';
        kmhBtn.style.display = 'inline-block';
        startTrackingBtn.style.display = 'none';
    }
    // position.coords.speed is in meters per second.
    currentSpeed = position.coords.speed || 0; // Default to 0 if speed is null
    updateSpeedDisplay();
}

/**
 * Updates the displayed speed, converting it to the selected unit (mph or km/h).
 */
function updateSpeedDisplay() {
    if (!speedDisplay) return; // Guard clause if element not found

    let convertedSpeed;
    let unit;

    if (isMph) {
        convertedSpeed = currentSpeed * MPH_CONVERSION_FACTOR;
        unit = 'mph';
    } else {
        convertedSpeed = currentSpeed * KPH_CONVERSION_FACTOR;
        unit = 'km/h';
    }
    speedDisplay.innerText = convertedSpeed.toFixed(2) + ' ' + unit;
}

/**
 * Switches the speed display and calculation to miles per hour (mph).
 */
function switchToMph() {
    isMph = true;
    if (mphBtn) {
        mphBtn.disabled = true;
        mphBtn.setAttribute('aria-pressed', 'true');
    }
    if (kmhBtn) {
        kmhBtn.disabled = false;
        kmhBtn.setAttribute('aria-pressed', 'false');
    }
    updateSpeedDisplay();
}

/**
 * Switches the speed display and calculation to kilometers per hour (km/h).
 */
function switchToKmh() {
    isMph = false;
    if (kmhBtn) {
        kmhBtn.disabled = true;
        kmhBtn.setAttribute('aria-pressed', 'true');
    }
    if (mphBtn) {
        mphBtn.disabled = false;
        mphBtn.setAttribute('aria-pressed', 'false');
    }
    updateSpeedDisplay();
}

/**
 * Starts tracking the user's location and speed.
 */
function startTracking() {
    // Geolocation options: enable high accuracy and ensure fresh data.
    const geolocationOptions = {
        enableHighAccuracy: true,
        maximumAge: 0, // Don't use a cached position.
        timeout: 10000 // Time (in milliseconds) until the error callback is invoked.
    };

    if (navigator.geolocation) {
        // Clear any existing watch
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
        }
        // Start watching the user's position.
        watchId = navigator.geolocation.watchPosition(
            processNewPosition,
            handleGeolocationError,
            geolocationOptions
        );
        if (startTrackingBtn) {
             startTrackingBtn.disabled = true; // Disable button after clicking
             startTrackingBtn.innerText = "Tracking...";
        }
    } else {
        if (speedDisplay) {
            speedDisplay.innerText = "Geolocation is not supported by this browser.";
        }
        if (startTrackingBtn) {
            startTrackingBtn.disabled = true; // Also disable if geolocation is not supported
        }
    }
}

/**
 * Handles errors from the Geolocation API.
 * @param {GeolocationPositionError} err - The error object.
 */
function handleGeolocationError(err) {
    console.warn(`ERROR(${err.code}): ${err.message}`);
    if (speedDisplay) {
        if (err.code === 1) { // PERMISSION_DENIED
            speedDisplay.innerText = "Location access denied. Please enable it in your browser settings.";
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
            speedDisplay.innerText = "Location information is unavailable.";
        } else if (err.code === 3) { // TIMEOUT
            speedDisplay.innerText = "The request to get user location timed out.";
        } else {
            speedDisplay.innerText = "An unknown error occurred while trying to get your location.";
        }
    }
    // Re-enable start button if tracking fails to start or an error occurs that stops tracking
    if (startTrackingBtn) {
        startTrackingBtn.disabled = false;
        startTrackingBtn.innerText = "Start Tracking";
    }
    // If permission was denied, don't try to show unit buttons
    if (err.code === 1) {
        grantedLocationAccess = false; // Reset this so user can try again if they enable permissions
        mphBtn.style.display = 'none';
        kmhBtn.style.display = 'none';
        startTrackingBtn.style.display = 'inline-block'; // Show start button again
    }
}

// --- Event Listeners ---
// Ensure the DOM is fully loaded before attaching event listeners.
document.addEventListener('DOMContentLoaded', () => {
    // Attach event listeners to buttons
    if (startTrackingBtn) {
        startTrackingBtn.addEventListener('click', startTracking);
    }
    if (mphBtn) {
        mphBtn.addEventListener('click', switchToMph);
    }
    if (kmhBtn) {
        kmhBtn.addEventListener('click', switchToKmh);
    }

    // Initial UI setup
    // Buttons are hidden by default via CSS (or should be if that's the desired initial state)
    // and then shown by JS when appropriate.
    // Here, we ensure mphBtn and kmhBtn are not displayed until location access.
    if (mphBtn) mphBtn.style.display = 'none';
    if (kmhBtn) kmhBtn.style.display = 'none';
    // Set initial state for mph/kmh buttons and ARIA attributes
    if (mphBtn && kmhBtn) { // Ensure buttons exist
        if (isMph) {
            mphBtn.disabled = true;
            mphBtn.setAttribute('aria-pressed', 'true');
            kmhBtn.disabled = false;
            kmhBtn.setAttribute('aria-pressed', 'false');
        } else {
            kmhBtn.disabled = true;
            kmhBtn.setAttribute('aria-pressed', 'true');
            mphBtn.disabled = false;
            mphBtn.setAttribute('aria-pressed', 'false');
        }
    }

    // Initial message in speed display
    if (speedDisplay) {
        speedDisplay.innerText = "Please allow Current Location access to determine speed.";
    }
     // Check if geolocation is supported at all and update UI accordingly
    if (!navigator.geolocation && speedDisplay) {
        speedDisplay.innerText = "Geolocation is not supported by this browser.";
        if(startTrackingBtn) startTrackingBtn.disabled = true;
    }
});
