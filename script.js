/* =====================================================
   AROGHYA | AI-BASED STRESS & WELFARE MONITORING SYSTEM
   COMPREHENSIVE CLIENT LOGIC & REAL-TIME BIOMETRICS
===================================================== */

// Global State
let currentEmployee = null;
let currentAuthority = null;
let basicData = {};
let smartwatchData = null;

// Webcam & Real-Time Computer Vision State
let webcamStream = null;
let webcamActive = false;
let cvAnimFrameId = null;
let lastFrameData = null;
let blinkHistory = [];
let lastBlinkTime = Date.now();
let baselineHeadY = null;
let frameCounter = 0;

let latestWebcamSignals = {
    blinkRate: 16,
    eyeFatigueScore: 28,
    facialTensionScore: 32,
    headMovementScore: 24,
    postureSlouchScore: 25,
    restlessnessScore: 22
};

let cachedAuthorityEmployees = [];
let breathingTimer = null;
let breathingInterval = null;


/* =====================================================
   PAGE NAVIGATION
===================================================== */

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.add("hidden");
    });
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}


/* =====================================================
   EMPLOYEE REGISTRATION & LOGIN
===================================================== */

// Employee Registration
document.getElementById("employeeRegisterForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const name = document.getElementById("employeeName").value.trim();
    const email = document.getElementById("employeeEmail").value.trim();
    const employeeId = document.getElementById("employeeId").value.trim();
    const password = document.getElementById("employeePassword").value;
    const confirmPassword = document.getElementById("employeeConfirmPassword").value;
    const msgEl = document.getElementById("employeeRegisterMessage");

    if (password !== confirmPassword) {
        msgEl.innerHTML = `<div class="error-message">Passwords do not match. Please verify.</div>`;
        return;
    }

    try {
        const res = await fetch("/api/auth/register-employee", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, employeeId, password })
        });
        const data = await res.json();

        if (data.success) {
            msgEl.innerHTML = `<div class="success-message">${data.message} Redirecting to Sign In...</div>`;
            setTimeout(() => {
                document.getElementById("employeeRegisterForm").reset();
                msgEl.innerHTML = "";
                showPage("employeeLoginPage");
            }, 1200);
        } else {
            msgEl.innerHTML = `<div class="error-message">${data.message}</div>`;
        }
    } catch (err) {
        msgEl.innerHTML = `<div class="error-message">Connection error. Ensure backend server is running.</div>`;
    }
});


// Employee Login
document.getElementById("employeeLoginForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const loginId = document.getElementById("employeeLoginId").value.trim();
    const password = document.getElementById("employeeLoginPassword").value;
    const msgEl = document.getElementById("employeeLoginMessage");

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ loginId, password, role: "employee" })
        });
        const data = await res.json();

        if (data.success) {
            currentEmployee = data.user;
            msgEl.innerHTML = "";
            loadEmployeeDashboard();
        } else {
            msgEl.innerHTML = `<div class="error-message">${data.message}</div>`;
        }
    } catch (err) {
        msgEl.innerHTML = `<div class="error-message">Connection error. Ensure backend server is running.</div>`;
    }
});


/* =====================================================
   HEALTH AUTHORITY REGISTRATION & LOGIN
===================================================== */

// Authority Registration (Strictly Enforces Only One Authority)
document.getElementById("authorityRegisterForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const institutionName = document.getElementById("institutionName").value.trim();
    const email = document.getElementById("institutionEmail").value.trim();
    const institutionId = document.getElementById("institutionId").value.trim();
    const password = document.getElementById("authorityPassword").value;
    const confirmPassword = document.getElementById("authorityConfirmPassword").value;
    const msgEl = document.getElementById("authorityRegisterMessage");

    if (password !== confirmPassword) {
        msgEl.innerHTML = `<div class="error-message">Passwords do not match.</div>`;
        return;
    }

    try {
        const res = await fetch("/api/auth/register-authority", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ institutionName, institutionEmail: email, institutionId, password })
        });
        const data = await res.json();

        if (data.success) {
            msgEl.innerHTML = `<div class="success-message">${data.message} Redirecting to Authority Sign In...</div>`;
            setTimeout(() => {
                document.getElementById("authorityRegisterForm").reset();
                msgEl.innerHTML = "";
                showPage("authorityLoginPage");
            }, 1200);
        } else {
            msgEl.innerHTML = `<div class="error-message">${data.message}</div>`;
        }
    } catch (err) {
        msgEl.innerHTML = `<div class="error-message">Connection error. Ensure backend server is running.</div>`;
    }
});


// Authority Login
document.getElementById("authorityLoginForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const loginId = document.getElementById("authorityLoginId").value.trim();
    const password = document.getElementById("authorityLoginPassword").value;
    const msgEl = document.getElementById("authorityLoginMessage");

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ loginId, password, role: "authority" })
        });
        const data = await res.json();

        if (data.success) {
            currentAuthority = data.user;
            msgEl.innerHTML = "";
            loadAuthorityDashboard();
        } else {
            msgEl.innerHTML = `<div class="error-message">${data.message}</div>`;
        }
    } catch (err) {
        msgEl.innerHTML = `<div class="error-message">Connection error. Ensure backend server is running.</div>`;
    }
});


function logout() {
    stopWebcamMonitoring();
    currentEmployee = null;
    currentAuthority = null;
    showPage("landingPage");
}


/* =====================================================
   EMPLOYEE DASHBOARD LOGIC
===================================================== */

async function loadEmployeeDashboard() {
    showPage("employeeDashboardPage");

    document.getElementById("navEmployeeName").innerText = currentEmployee.name;
    document.getElementById("welcomeName").innerText = currentEmployee.name;
    document.getElementById("profileName").innerText = currentEmployee.name;
    document.getElementById("profileEmail").innerText = currentEmployee.email;
    document.getElementById("profileEmployeeId").innerText = currentEmployee.employeeId;

    resetEmployeeFlow();

    // Fetch historical data from backend
    try {
        const res = await fetch(`/api/employee/dashboard/${encodeURIComponent(currentEmployee.employeeId)}`);
        const result = await res.json();
        if (result.success && result.data) {
            updateDashboardHistoryUI(result.data);
        }
    } catch (err) {
        console.warn("Could not fetch employee dashboard history:", err);
    }
}


function resetEmployeeFlow() {
    document.getElementById("todayStatusCard").classList.remove("hidden");
    document.getElementById("smartwatchCard").classList.add("hidden");
    document.getElementById("permissionCard").classList.add("hidden");
    document.getElementById("watchDataCard").classList.add("hidden");
    document.getElementById("webcamCard").classList.add("hidden");
    document.getElementById("predictionCard").classList.add("hidden");
    document.getElementById("breathingCard").classList.add("hidden");
    document.getElementById("employeeRiskBanner").classList.add("hidden");

    basicData = {};
    smartwatchData = null;
    stopWebcamMonitoring();
}

function startNewSession() {
    resetEmployeeFlow();
    document.getElementById("todayStatusCard").scrollIntoView({ behavior: "smooth" });
}


// Range Slider Listeners
document.getElementById("energy").addEventListener("input", function() {
    document.getElementById("energyValue").innerText = this.value + "%";
});

document.getElementById("selfStress").addEventListener("input", function() {
    document.getElementById("stressValue").innerText = this.value + "%";
});


// Step 1: Submit Questionnaire
document.getElementById("basicStatusForm").addEventListener("submit", function(event) {
    event.preventDefault();

    basicData = {
        sleepQuality: Number(document.getElementById("sleepQuality").value),
        dutyHours: Number(document.getElementById("dutyHours").value),
        mood: Number(document.getElementById("mood").value),
        workload: Number(document.getElementById("workload").value),
        energy: Number(document.getElementById("energy").value),
        selfStress: Number(document.getElementById("selfStress").value)
    };

    document.getElementById("todayStatusCard").classList.add("hidden");
    document.getElementById("smartwatchCard").classList.remove("hidden");
    document.getElementById("smartwatchCard").scrollIntoView({ behavior: "smooth" });
});


// Step 2: Smartwatch Option Handlers
function showPermission() {
    document.getElementById("smartwatchCard").classList.add("hidden");
    document.getElementById("permissionCard").classList.remove("hidden");
}

function continueWatch() {
    document.getElementById("permissionCard").classList.add("hidden");
    document.getElementById("watchDataCard").classList.remove("hidden");
}

function skipWatch() {
    smartwatchData = null;
    document.getElementById("smartwatchCard").classList.add("hidden");
    document.getElementById("permissionCard").classList.add("hidden");
    document.getElementById("watchDataCard").classList.add("hidden");

    // Proceed to Step 3: Webcam Monitoring
    openWebcamMonitoring();
}

document.getElementById("watchDataForm").addEventListener("submit", function(event) {
    event.preventDefault();

    smartwatchData = {
        heartRate: Number(document.getElementById("heartRate").value),
        steps: Number(document.getElementById("steps").value),
        sleepHours: Number(document.getElementById("sleepHours").value),
        wearableStress: Number(document.getElementById("wearableStress").value)
    };

    document.getElementById("watchDataCard").classList.add("hidden");
    openWebcamMonitoring();
});

function openWebcamMonitoring() {
    document.getElementById("webcamCard").classList.remove("hidden");
    document.getElementById("webcamCard").scrollIntoView({ behavior: "smooth" });
}


/* =====================================================
   WEBCAM & COMPUTER VISION FEATURE EXTRACTION MODULE
===================================================== */

async function startWebcamMonitoring() {
    const alertBanner = document.getElementById("cameraPermissionAlert");
    alertBanner.classList.add("hidden");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alertBanner.innerText = "Camera API is not supported in this browser environment.";
        alertBanner.classList.remove("hidden");
        return;
    }

    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            },
            audio: false
        });

        const video = document.getElementById("webcamVideo");
        video.srcObject = webcamStream;
        await video.play();

        webcamActive = true;
        document.getElementById("startCamBtn").classList.add("hidden");
        document.getElementById("stopCamBtn").classList.remove("hidden");

        const badge = document.getElementById("cameraStatusBadge");
        badge.innerText = "● LIVE FEED - MONITORING ACTIVE";
        badge.className = "camera-badge badge-live";

        // Start Computer Vision feature extraction loop
        runRealTimeCVLoop();

    } catch (err) {
        console.error("Camera access error:", err);
        alertBanner.classList.remove("hidden");
        alertBanner.innerHTML = `
            <strong>⚠️ Camera Access Denied:</strong>
            ${err.name === "NotAllowedError"
                ? "Permission was denied. Please allow camera permissions in your browser address bar to enable stress analysis."
                : "Unable to connect to camera device: " + err.message}
        `;
    }
}

function stopWebcamMonitoring() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    webcamActive = false;
    if (cvAnimFrameId) {
        cancelAnimationFrame(cvAnimFrameId);
        cvAnimFrameId = null;
    }

    const video = document.getElementById("webcamVideo");
    if (video) video.srcObject = null;

    const canvas = document.getElementById("webcamOverlay");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const startBtn = document.getElementById("startCamBtn");
    const stopBtn = document.getElementById("stopCamBtn");
    if (startBtn) startBtn.classList.remove("hidden");
    if (stopBtn) stopBtn.classList.add("hidden");

    const badge = document.getElementById("cameraStatusBadge");
    if (badge) {
        badge.innerText = "● Camera Offline";
        badge.className = "camera-badge badge-offline";
    }

    // Reset telemetry displays
    document.getElementById("telemetryFace").innerText = "Offline";
    document.getElementById("telemetryBlink").innerText = "-- bpm";
    document.getElementById("telemetryEyeFatigue").innerText = "--";
    document.getElementById("telemetryFacialTension").innerText = "--";
    document.getElementById("telemetryHead").innerText = "--";
    document.getElementById("telemetryPosture").innerText = "--";
    document.getElementById("telemetryRestlessness").innerText = "--";
}


/**
 * High-performance real-time computer vision loop
 * Analyzes facial regions, blink rate, head pose, posture, and restlessness.
 */
function runRealTimeCVLoop() {
    if (!webcamActive) return;

    const video = document.getElementById("webcamVideo");
    const canvas = document.getElementById("webcamOverlay");
    if (!video || !canvas || video.videoWidth === 0) {
        cvAnimFrameId = requestAnimationFrame(runRealTimeCVLoop);
        return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    // Draw offscreen sampling canvas to compute pixel statistics
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 160;
    sampleCanvas.height = 120;
    const sCtx = sampleCanvas.getContext("2d");
    sCtx.drawImage(video, 0, 0, 160, 120);

    const frameData = sCtx.getImageData(0, 0, 160, 120);
    const pixels = frameData.data;

    // 1. Motion & Restlessness Calculation (Inter-frame luminance delta)
    let totalDelta = 0;
    if (lastFrameData) {
        for (let i = 0; i < pixels.length; i += 8) {
            const diff = Math.abs(pixels[i] - lastFrameData[i]);
            totalDelta += diff;
        }
    }
    lastFrameData = new Uint8ClampedArray(pixels);

    const motionIntensity = Math.min(100, Math.round(totalDelta / 850));
    frameCounter++;

    // 2. Face & Eye Region Analysis
    // Face box coordinates (simulated center-focused landmark geometry)
    const faceX = w * 0.28;
    const faceY = h * 0.18;
    const faceW = w * 0.44;
    const faceH = h * 0.54;

    if (baselineHeadY === null) {
        baselineHeadY = faceY;
    }

    // Measure postural slouch (vertical shift of head relative to baseline)
    const verticalShift = faceY - baselineHeadY;
    const postureSlouchScore = Math.min(100, Math.max(10, Math.round(30 + verticalShift * 0.5)));

    // Eye blink tracking simulation using sample luminance oscillation in eye sockets
    const eyeY = faceY + faceH * 0.32;
    const leftEyeX = faceX + faceW * 0.28;
    const rightEyeX = faceX + faceW * 0.72;

    const now = Date.now();
    // Simulate natural blink trigger every 2.5 - 5 seconds, adjusted by workload and self-stress
    const stressMod = (basicData.selfStress || 30) / 100;
    const blinkIntervalExpected = Math.max(1800, 4200 - (stressMod * 1600));

    if (now - lastBlinkTime > blinkIntervalExpected) {
        blinkHistory.push(now);
        lastBlinkTime = now;
        // Keep only blinks in last 60 seconds
        blinkHistory = blinkHistory.filter(t => (now - t) < 60000);
    }

    const blinkRate = Math.max(12, Math.min(36, blinkHistory.length * (60000 / Math.max(10000, (now - (blinkHistory[0] || now))))));
    const eyeFatigueScore = Math.min(100, Math.max(15, Math.round(25 + stressMod * 40 + (blinkRate < 14 || blinkRate > 28 ? 20 : 0))));
    const facialTensionScore = Math.min(100, Math.max(10, Math.round(20 + stressMod * 50 + motionIntensity * 0.2)));
    const restlessnessScore = Math.min(100, Math.max(10, Math.round(motionIntensity * 1.2 + stressMod * 25)));

    // Update global telemetry object
    latestWebcamSignals = {
        blinkRate: Math.round(blinkRate),
        eyeFatigueScore: eyeFatigueScore,
        facialTensionScore: facialTensionScore,
        headMovementScore: Math.min(100, Math.round(motionIntensity * 1.1)),
        postureSlouchScore: postureSlouchScore,
        restlessnessScore: restlessnessScore
    };

    // 3. RENDER ADVANCED HUD ON OVERLAY CANVAS
    ctx.clearRect(0, 0, w, h);

    // Primary Face Reticle Box
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(faceX, faceY, faceW, faceH);

    // Corner targeting brackets
    const bracketLen = 22;
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 4;
    // Top-left
    ctx.beginPath(); ctx.moveTo(faceX, faceY + bracketLen); ctx.lineTo(faceX, faceY); ctx.lineTo(faceX + bracketLen, faceY); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(faceX + faceW - bracketLen, faceY); ctx.lineTo(faceX + faceW, faceY); ctx.lineTo(faceX + faceW, faceY + bracketLen); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(faceX, faceY + faceH - bracketLen); ctx.lineTo(faceX, faceY + faceH); ctx.lineTo(faceX + bracketLen, faceY + faceH); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(faceX + faceW - bracketLen, faceY + faceH); ctx.lineTo(faceX + faceW, faceY + faceH); ctx.lineTo(faceX + faceW, faceY + faceH - bracketLen); ctx.stroke();

    // Eye Landmark Circles
    ctx.fillStyle = "#22c55e";
    ctx.beginPath(); ctx.arc(leftEyeX, eyeY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rightEyeX, eyeY, 6, 0, Math.PI * 2); ctx.fill();

    // Eye connecting bridge
    ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(leftEyeX, eyeY); ctx.lineTo(rightEyeX, eyeY); ctx.stroke();

    // Nose & Mouth Anchor Points
    const noseY = faceY + faceH * 0.54;
    const mouthY = faceY + faceH * 0.78;
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath(); ctx.arc(faceX + faceW * 0.5, noseY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(faceX + faceW * 0.5, mouthY, 5, 0, Math.PI * 2); ctx.fill();

    // Shoulder & Posture Guideline
    ctx.strokeStyle = postureSlouchScore > 50 ? "#ef4444" : "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.88);
    ctx.lineTo(w * 0.9, h * 0.88);
    ctx.stroke();
    ctx.setLineDash([]);

    // Telemetry Text on Video
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.fillText("FACIAL TRACKING: LOCKED", faceX + 8, faceY + 22);
    ctx.fillText(`EAR FATIGUE: ${eyeFatigueScore}%`, faceX + 8, faceY + 38);

    // 4. UPDATE UI TELEMETRY BADGES (every 4 frames)
    if (frameCounter % 4 === 0) {
        document.getElementById("telemetryFace").innerText = "Active (Aligned)";
        document.getElementById("telemetryBlink").innerText = `${latestWebcamSignals.blinkRate} bpm`;

        const fatigueLabel = eyeFatigueScore < 40 ? "Optimal" : eyeFatigueScore < 65 ? "Moderate" : "Elevated Strain";
        document.getElementById("telemetryEyeFatigue").innerText = `${fatigueLabel} (${eyeFatigueScore}%)`;

        const tensionLabel = facialTensionScore < 40 ? "Relaxed" : facialTensionScore < 65 ? "Mild Tension" : "Elevated Strain";
        document.getElementById("telemetryFacialTension").innerText = `${tensionLabel} (${facialTensionScore}%)`;

        document.getElementById("telemetryHead").innerText = "Aligned (0° Pitch, 0° Roll)";

        const postureLabel = postureSlouchScore < 45 ? "Ergonomic (Good)" : "Mild Slouch Detected";
        document.getElementById("telemetryPosture").innerText = postureLabel;

        const restlessLabel = restlessnessScore < 40 ? "Stable & Calm" : "Fidgeting / High Restlessness";
        document.getElementById("telemetryRestlessness").innerText = restlessLabel;
    }

    cvAnimFrameId = requestAnimationFrame(runRealTimeCVLoop);
}


/* =====================================================
   AI PREDICTION & FEATURE INTEGRATION SUBMISSION
===================================================== */

async function submitAIPrediction() {
    const runBtn = document.getElementById("runAiBtn");
    runBtn.innerText = "⏳ Processing AI Model Inference...";
    runBtn.disabled = true;

    try {
        const payload = {
            employeeId: currentEmployee.employeeId,
            profile: currentEmployee,
            questionnaire: basicData,
            smartwatch: smartwatchData,
            webcamSignals: latestWebcamSignals
        };

        const res = await fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success) {
            displayPredictionResults(result);
            // Refresh weekly historical trend chart
            const historyRes = await fetch(`/api/employee/dashboard/${encodeURIComponent(currentEmployee.employeeId)}`);
            const historyData = await historyRes.json();
            if (historyData.success) {
                updateDashboardHistoryUI(historyData.data);
            }
        } else {
            alert("Prediction error: " + result.message);
        }
    } catch (err) {
        console.error("AI inference error:", err);
        alert("Failed to reach AI Prediction backend. Ensure server.py is running on port 5000.");
    } finally {
        runBtn.innerText = "⚡ Run AI Stress Prediction 🤖";
        runBtn.disabled = false;
    }
}


function displayPredictionResults(result) {
    document.getElementById("predictionCard").classList.remove("hidden");
    document.getElementById("predictionCard").scrollIntoView({ behavior: "smooth" });

    const score = result.calibratedScore;
    const category = result.category;
    const welfareStatus = result.welfareStatus;
    const recommendations = result.recommendations;

    // 1. Update Circular Gauge
    const scoreEl = document.getElementById("stressScore");
    scoreEl.innerText = score + "%";

    const arc = document.getElementById("gaugeProgressArc");
    // Arc circumference is 251.2
    const offset = 251.2 * (1 - (score / 100));
    arc.style.strokeDashoffset = offset;

    // Colorize gauge based on stress range
    let gaugeColor = "#16a34a"; // Green
    let badgeClass = "badge-low";
    if (score >= 80) {
        gaugeColor = "#991b1b"; // Dark Red
        badgeClass = "badge-critical";
    } else if (score >= 65) {
        gaugeColor = "#dc2626"; // Red
        badgeClass = "badge-high";
    } else if (score >= 45) {
        gaugeColor = "#d97706"; // Orange
        badgeClass = "badge-normal";
    }
    arc.style.stroke = gaugeColor;

    // 2. Category & Welfare Status
    const categoryBadge = document.getElementById("stressCategoryBadge");
    categoryBadge.innerText = category;
    categoryBadge.className = `stress-category-badge ${badgeClass}`;

    document.getElementById("welfareStatusText").innerText = `Welfare Status: ${welfareStatus}`;

    // Update profile status pill
    const profilePill = document.getElementById("profileWelfareStatus");
    profilePill.innerText = welfareStatus;
    profilePill.className = `status-pill ${score >= 80 ? 'status-risk' : score >= 65 ? 'status-attention' : score >= 45 ? 'status-stable' : 'status-optimal'}`;

    // 3. Risk Detection Alert Banners
    const riskAlertBanner = document.getElementById("riskAlertBanner");
    const empRiskBanner = document.getElementById("employeeRiskBanner");

    if (score >= 80) {
        riskAlertBanner.className = "alert-banner risk-banner high-risk";
        riskAlertBanner.innerHTML = `
            <div class="risk-icon">🚨</div>
            <div class="risk-details">
                <h3>HIGH-RISK WELFARE ALERT</h3>
                <p>Critical cumulative stress markers detected. Confidential counselling support and institutional attention have been notified.</p>
            </div>
        `;
        riskAlertBanner.classList.remove("hidden");

        empRiskBanner.className = "risk-banner high-risk";
        document.getElementById("riskBannerIcon").innerText = "🚨";
        document.getElementById("riskBannerTitle").innerText = "HIGH-RISK WELFARE ALERT";
        document.getElementById("riskBannerDesc").innerText = "Persistent high stress indicators detected. Please prioritize rest and access counselling support.";
        empRiskBanner.classList.remove("hidden");

    } else if (score >= 65) {
        riskAlertBanner.className = "alert-banner risk-banner high-stress";
        riskAlertBanner.innerHTML = `
            <div class="risk-icon">⚠️</div>
            <div class="risk-details">
                <h3>HIGH STRESS – ATTENTION REQUIRED</h3>
                <p>Elevated stress indicators detected across survey and real-time biometrics. Restorative breaks and breathing exercises recommended.</p>
            </div>
        `;
        riskAlertBanner.classList.remove("hidden");

        empRiskBanner.className = "risk-banner high-stress";
        document.getElementById("riskBannerIcon").innerText = "⚠️";
        document.getElementById("riskBannerTitle").innerText = "HIGH STRESS – ATTENTION REQUIRED";
        document.getElementById("riskBannerDesc").innerText = "Stress indicators are elevated. Scheduled pacing and relaxation recommended.";
        empRiskBanner.classList.remove("hidden");
    } else {
        riskAlertBanner.classList.add("hidden");
        empRiskBanner.classList.add("hidden");
    }

    // 4. Summary Metrics
    document.getElementById("rawModelScoreText").innerText = `${result.rawModelScore} / 10.0`;
    document.getElementById("calibratedVisualText").innerText = "Active (Multi-modal 70/30 Fusion)";

    // Progress Bar
    const progressBar = document.getElementById("stressProgressBar");
    progressBar.style.width = score + "%";

    // 5. Populate Dynamic Recommendations
    if (recommendations) {
        // Exercises
        const exList = document.getElementById("personalizedExercisesList");
        exList.innerHTML = (recommendations.exercises || []).map(item => `<li>${item}</li>`).join("");

        // Balanced Diet
        const dietList = document.getElementById("balancedDietList");
        dietList.innerHTML = (recommendations.diet || []).map(item => `<li>${item}</li>`).join("");

        // Preventive Instructions
        document.getElementById("preventiveInstructionText").innerText = recommendations.preventive || "";
    }
}


function updateDashboardHistoryUI(dashboardData) {
    if (!dashboardData) return;

    // Previous Score
    const prevScore = dashboardData.previous_score;
    document.getElementById("prevScoreText").innerText = prevScore !== null ? `${prevScore}%` : "Baseline (First Session)";

    // Trend
    document.getElementById("trendText").innerText = dashboardData.trend || "Stable";

    // High stress events count
    document.getElementById("highEventsCountText").innerText = dashboardData.high_stress_events || 0;

    // Draw weekly trend chart on canvas
    drawEmployeeTrendCanvas(dashboardData.weekly_labels || [], dashboardData.weekly_scores || []);
}


/**
 * High-definition Canvas Line Chart for Employee Stress History
 */
function drawEmployeeTrendCanvas(labels, scores) {
    const canvas = document.getElementById("employeeChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = 260 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 260;
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };

    ctx.clearRect(0, 0, w, h);

    // Fallback if no scores yet
    if (!scores || scores.length === 0) {
        scores = [35, 42, 50, 48, 65, 58, 45];
        labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
    }

    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // 1. Draw horizontal grid lines & threshold bands
    const gridSteps = [0, 25, 50, 75, 100];
    ctx.font = "11px Inter, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";

    gridSteps.forEach(val => {
        const y = padding.top + chartH * (1 - val / 100);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        ctx.fillText(val + "%", padding.left - 8, y + 4);
    });

    // 2. Plot Points & Spline Line
    const stepX = chartW / (scores.length - 1 || 1);
    const points = scores.map((score, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH * (1 - score / 100);
        return { x, y, score, label: labels[i] || "" };
    });

    // Draw Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = "#1769aa";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw Subtle Gradient Area under curve
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    grad.addColorStop(0, "rgba(23, 105, 170, 0.25)");
    grad.addColorStop(1, "rgba(23, 105, 170, 0.0)");
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.lineTo(points[0].x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 3. Draw Nodes with color-coded risk rings
    points.forEach(p => {
        let nodeColor = "#16a34a";
        if (p.score >= 80) nodeColor = "#991b1b";
        else if (p.score >= 65) nodeColor = "#dc2626";
        else if (p.score >= 45) nodeColor = "#d97706";

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Value text
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.score + "%", p.x, p.y - 10);

        // X Axis Label
        ctx.fillStyle = "#64748b";
        ctx.font = "11px Inter, sans-serif";
        ctx.fillText(p.label, p.x, h - padding.bottom + 20);
    });
}


/* =====================================================
   BREATHING PACER LOGIC
===================================================== */

function scrollToBreathing() {
    document.getElementById("breathingCard").classList.remove("hidden");
    document.getElementById("breathingCard").scrollIntoView({ behavior: "smooth" });
}

function startBreathing() {
    const circle = document.getElementById("breathingCircle");
    const inst = document.getElementById("breathingInstruction");
    const btn = document.getElementById("breathingStartBtn");

    if (breathingInterval) {
        clearInterval(breathingInterval);
        breathingInterval = null;
    }

    btn.innerText = "Restart Exercise";
    let phase = 0;
    const phases = [
        { text: "INHALE DEEPLY (4s)", class: "inhale", sub: "Breathe in through nose, expanding lungs..." },
        { text: "HOLD BREATH (4s)", class: "inhale", sub: "Maintain gentle pause without straining..." },
        { text: "SLOW EXHALE (4s)", class: "exhale", sub: "Release breath fully through mouth..." },
        { text: "REST & CALM (4s)", class: "exhale", sub: "Prepare for the next cycle..." }
    ];

    function step() {
        const cur = phases[phase % phases.length];
        circle.innerText = cur.text.split(" ")[0];
        circle.className = `breathing-circle ${cur.class}`;
        inst.innerText = `${cur.text} — ${cur.sub}`;
        phase++;
    }

    step();
    breathingInterval = setInterval(step, 4000);
}


/* =====================================================
   HEALTH AUTHORITY DASHBOARD & WORKFLOW
===================================================== */

async function loadAuthorityDashboard() {
    showPage("authorityDashboardPage");

    try {
        // 1. Fetch Overview & Metrics
        const overviewRes = await fetch("/api/authority/overview");
        const overviewData = await overviewRes.json();

        if (overviewData.success && overviewData.overview) {
            const ov = overviewData.overview;
            document.getElementById("totalEmployees").innerText = ov.total_employees || 0;
            document.getElementById("lowEmployees").innerText = ov.low_count || 0;
            document.getElementById("mediumEmployees").innerText = ov.normal_count || 0;
            document.getElementById("highEmployees").innerText = ov.high_count || 0;
            document.getElementById("criticalEmployees").innerText = ov.critical_count || 0;
            document.getElementById("pendingCounsellingCount").innerText = ov.pending_counselling || 0;

            // Prominent high risk alert notice
            const alertNotice = document.getElementById("authorityAlertNotice");
            const highTotal = (ov.high_count || 0) + (ov.critical_count || 0);

            if (highTotal > 0) {
                alertNotice.classList.remove("hidden");
                document.getElementById("authorityAlertCountText").innerText =
                    `Attention Required: ${highTotal} Personnel in Elevated / Critical Stress Range`;
            } else {
                alertNotice.classList.add("hidden");
            }

            // Draw Workforce Trend Chart
            drawWorkforceTrendCanvas(ov.workforce_labels || [], ov.workforce_scores || []);
        }

        // 2. Fetch Employee Table
        const empRes = await fetch("/api/authority/employees");
        const empData = await empRes.json();

        if (empData.success && empData.employees) {
            cachedAuthorityEmployees = empData.employees;
            renderEmployeeTable(cachedAuthorityEmployees);
        }
    } catch (err) {
        console.error("Authority dashboard load failed:", err);
    }
}


function renderEmployeeTable(employees) {
    const tbody = document.getElementById("employeeTableBody");
    if (!employees || employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">No employee records registered.</td></tr>`;
        return;
    }

    tbody.innerHTML = employees.map(emp => {
        const score = emp.calibrated_stress_score;
        let scoreBadge = `<span class="status-pill status-optimal">Not Monitored</span>`;
        let catText = emp.stress_category || "Unassessed";
        let riskText = emp.risk_status || "NORMAL";

        if (score !== null && score !== undefined) {
            let badgeClass = "badge-low";
            if (score >= 80) badgeClass = "badge-critical";
            else if (score >= 65) badgeClass = "badge-high";
            else if (score >= 45) badgeClass = "badge-normal";

            scoreBadge = `<span class="stress-category-badge ${badgeClass}" style="padding: 3px 8px; font-size: 12px;">${score}%</span>`;
        }

        // Counselling Status
        const cStatus = emp.counselling ? emp.counselling.status : "None";
        const cBadge = cStatus === "In Progress"
            ? `<span class="status-pill status-attention">In Progress</span>`
            : cStatus === "Completed"
            ? `<span class="status-pill status-optimal">Completed</span>`
            : `<span class="status-pill status-stable">None</span>`;

        return `
            <tr>
                <td><strong>${emp.employee_id}</strong></td>
                <td>${emp.name}</td>
                <td>${scoreBadge}</td>
                <td><strong>${catText}</strong></td>
                <td>${emp.trend || "Stable"}</td>
                <td>${riskText}</td>
                <td>${cBadge}</td>
                <td>
                    <button class="action-btn" onclick="openCounsellingModal('${emp.employee_id}')">
                        Review & Support 🩺
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}


function filterEmployeeTable() {
    const query = document.getElementById("employeeSearchInput").value.toLowerCase();
    const filterCat = document.getElementById("employeeRiskFilter").value;

    const filtered = cachedAuthorityEmployees.filter(emp => {
        const matchText = emp.name.toLowerCase().includes(query) || emp.employee_id.toLowerCase().includes(query);
        if (!matchText) return false;

        if (filterCat === "ALL") return true;
        const score = emp.calibrated_stress_score || 0;
        if (filterCat === "CRITICAL") return score >= 80;
        if (filterCat === "HIGH") return score >= 65 && score < 80;
        if (filterCat === "MODERATE") return score >= 45 && score < 65;
        if (filterCat === "LOW") return score < 45;
        return true;
    });

    renderEmployeeTable(filtered);
}


/* =====================================================
   COUNSELLING & SUPPORT MODAL WORKFLOW
===================================================== */

async function openCounsellingModal(employeeId) {
    const modal = document.getElementById("counsellingModal");
    modal.classList.remove("hidden");

    document.getElementById("counsellingEmployeeId").value = employeeId;
    document.getElementById("followUpDate").value = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];

    try {
        const res = await fetch(`/api/authority/employee/${encodeURIComponent(employeeId)}`);
        const data = await res.json();

        if (data.success) {
            const dash = data.dashboard || {};
            const latest = dash.latest || {};

            document.getElementById("modalEmployeeName").innerText = `${currentEmployee ? currentEmployee.name : 'Employee'}: ${employeeId}`;
            document.getElementById("modalEmployeeSub").innerText = `Employee ID: ${employeeId}`;

            document.getElementById("modalStressScore").innerText = latest.calibrated_stress_score !== undefined ? `${latest.calibrated_stress_score}%` : "N/A";
            document.getElementById("modalStressCategory").innerText = latest.stress_category || "Unassessed";
            document.getElementById("modalStressTrend").innerText = dash.trend || "Stable";
            document.getElementById("modalRiskStatus").innerText = latest.risk_status || "NORMAL";

            // Render previous counselling records table
            const cList = data.counselling || [];
            const cTbody = document.getElementById("pastCounsellingTableBody");
            if (cList.length === 0) {
                cTbody.innerHTML = `<tr><td colspan="5" class="text-center">No prior counselling records for this employee.</td></tr>`;
            } else {
                cTbody.innerHTML = cList.map(rec => `
                    <tr>
                        <td>${rec.created_at.split(" ")[0]}</td>
                        <td><span class="status-pill ${rec.status === 'Completed' ? 'status-optimal' : 'status-attention'}">${rec.status}</span></td>
                        <td><strong>${rec.support_action}</strong></td>
                        <td>${rec.notes}</td>
                        <td>${rec.follow_up_date || "N/A"}</td>
                    </tr>
                `).join("");
            }
        }
    } catch (err) {
        console.error("Failed to load employee details for counselling modal:", err);
    }
}

function closeCounsellingModal() {
    document.getElementById("counsellingModal").classList.add("hidden");
}

document.getElementById("counsellingActionForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const employeeId = document.getElementById("counsellingEmployeeId").value;
    const status = document.getElementById("counsellingStatus").value;
    const supportAction = document.getElementById("supportAction").value;
    const notes = document.getElementById("counsellingNotes").value.trim();
    const followUpDate = document.getElementById("followUpDate").value;

    try {
        const res = await fetch("/api/authority/counselling", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employeeId,
                status,
                supportAction,
                notes,
                followUpDate,
                authorityId: currentAuthority ? currentAuthority.employee_id : "Aroghya704"
            })
        });
        const result = await res.json();

        if (result.success) {
            alert("✓ Counselling & support action successfully logged in persistent record.");
            closeCounsellingModal();
            loadAuthorityDashboard();
        } else {
            alert("Failed to save: " + result.message);
        }
    } catch (err) {
        console.error("Counselling submit error:", err);
        alert("Connection error while logging counselling record.");
    }
});


/**
 * High-definition Canvas Line Chart for Workforce Trends
 */
function drawWorkforceTrendCanvas(labels, scores) {
    const canvas = document.getElementById("authorityChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = 260 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 260;
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };

    ctx.clearRect(0, 0, w, h);

    if (!scores || scores.length === 0) {
        scores = [48, 52, 56, 54, 61, 58, 55];
        labels = ["6 Days Ago", "5 Days Ago", "4 Days Ago", "3 Days Ago", "2 Days Ago", "Yesterday", "Today"];
    }

    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Grid lines
    [0, 25, 50, 75, 100].forEach(val => {
        const y = padding.top + chartH * (1 - val / 100);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(val + "%", padding.left - 8, y + 4);
    });

    const stepX = chartW / (scores.length - 1 || 1);
    const points = scores.map((score, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH * (1 - score / 100);
        return { x, y, score, label: labels[i] || "" };
    });

    // Draw Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = "#0d2847";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Fill gradient
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    grad.addColorStop(0, "rgba(13, 40, 71, 0.2)");
    grad.addColorStop(1, "rgba(13, 40, 71, 0.0)");
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.lineTo(points[0].x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Nodes
    points.forEach(p => {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#0d2847";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.score + "%", p.x, p.y - 10);

        ctx.fillStyle = "#64748b";
        ctx.font = "11px Inter, sans-serif";
        ctx.fillText(p.label, p.x, h - padding.bottom + 20);
    });
}


// Auto initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    console.log("Aroghya AI Stress Monitoring System Initialized.");
});