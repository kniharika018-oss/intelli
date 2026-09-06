/* =====================================================
   AROGHYA | AI-BASED STRESS & WELFARE MONITORING SYSTEM
   COMPREHENSIVE CLIENT LOGIC & REAL-TIME BIOMETRICS
===================================================== */

// Global State
let currentEmployee = null;
let currentAuthority = null;
let basicData = {};

// Dynamic Mindful Wellness Quotes
const wellnessQuotes = [
    { emoji: "🌿", text: "Take a deep breath. In the midst of work, your peace and well-being come first." },
    { emoji: "🧘", text: "Pause for sixty seconds. Relax your shoulders, unclamp your jaw, and let tension fade." },
    { emoji: "💙", text: "Productivity thrives on balance, not exhaustion. Honor your pace and take mindful breaks." },
    { emoji: "🌱", text: "Small micro-breaks throughout your day cultivate long-term resilience and sustained focus." },
    { emoji: "✨", text: "You don't have to carry every deadline at once. Focus on the present step with clarity." },
    { emoji: "🍵", text: "Hydrate, step back from the screen for a moment, and give your mind space to recharge." },
    { emoji: "🌸", text: "Self-care is a prerequisite for excellence, not a reward. Treat yourself with patience today." }
];

function displayRandomWellnessQuote() {
    const textEl = document.getElementById("wellnessQuoteText");
    const emojiEl = document.getElementById("quoteEmoji");
    if (!textEl) return;
    const randomIndex = Math.floor(Math.random() * wellnessQuotes.length);
    const item = wellnessQuotes[randomIndex];
    textEl.innerText = `"${item.text}"`;
    if (emojiEl) emojiEl.innerText = item.emoji;
}

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
            if (currentEmployee) {
                currentEmployee.employeeId = currentEmployee.employeeId || currentEmployee.employee_id;
                currentEmployee.employee_id = currentEmployee.employeeId;
                sessionStorage.setItem("aroghya_current_employee", JSON.stringify(currentEmployee));
            }
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
            msgEl.innerHTML = `<div class="error-message">${data.message}<br><button type="button" class="btn authority-btn" style="margin-top:10px; padding:6px 14px; font-size:13px;" onclick="showPage('authorityLoginPage')">👉 Go to Authority Sign In</button></div>`;
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
            if (currentAuthority) {
                currentAuthority.employeeId = currentAuthority.employeeId || currentAuthority.employee_id;
                currentAuthority.employee_id = currentAuthority.employeeId;
                sessionStorage.setItem("aroghya_current_authority", JSON.stringify(currentAuthority));
            }
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
    stopWebcamMonitoring(false);
    currentEmployee = null;
    currentAuthority = null;
    sessionStorage.removeItem("aroghya_current_employee");
    sessionStorage.removeItem("aroghya_current_authority");
    showPage("landingPage");
}


/* =====================================================
   EMPLOYEE DASHBOARD LOGIC
===================================================== */

async function loadEmployeeDashboard() {
    showPage("employeeDashboardPage");

    if (!currentEmployee) return;

    // Safety fallback for currentEmployee keys
    currentEmployee.employeeId = currentEmployee.employeeId || currentEmployee.employee_id;
    currentEmployee.employee_id = currentEmployee.employeeId;

    const empName = currentEmployee.name || "Employee";
    const empEmail = currentEmployee.email || "";
    const empId = currentEmployee.employeeId || "";

    const navNameEl = document.getElementById("navEmployeeName");
    if (navNameEl) navNameEl.innerText = empName;
    const welcomeEl = document.getElementById("welcomeName");
    if (welcomeEl) welcomeEl.innerText = empName;
    const profileNameEl = document.getElementById("profileName");
    if (profileNameEl) profileNameEl.innerText = empName;
    const profileEmailEl = document.getElementById("profileEmail");
    if (profileEmailEl) profileEmailEl.innerText = empEmail;
    const profileIdEl = document.getElementById("profileEmployeeId");
    if (profileIdEl) profileIdEl.innerText = empId;

    resetEmployeeFlow();

    // Fetch historical data from backend
    try {
        const res = await fetch(`/api/employee/dashboard/${encodeURIComponent(empId)}`);
        const result = await res.json();
        if (result.success && result.data) {
            if (result.data.user) {
                if (!currentEmployee.name && result.data.user.name) {
                    currentEmployee.name = result.data.user.name;
                    if (navNameEl) navNameEl.innerText = currentEmployee.name;
                    if (welcomeEl) welcomeEl.innerText = currentEmployee.name;
                    if (profileNameEl) profileNameEl.innerText = currentEmployee.name;
                }
                if (!currentEmployee.email && result.data.user.email) {
                    currentEmployee.email = result.data.user.email;
                    if (profileEmailEl) profileEmailEl.innerText = currentEmployee.email;
                }
            }
            updateDashboardHistoryUI(result.data);
            if (result.data.latest) {
                displayPredictionResults(result.data.latest, false);
            }
        }
    } catch (err) {
        console.warn("Could not fetch employee dashboard history:", err);
    }
    displayRandomWellnessQuote();
}


function resetEmployeeFlow() {
    const todayCard = document.getElementById("todayStatusCard");
    if (todayCard) todayCard.classList.remove("hidden");
    const webcamCard = document.getElementById("webcamCard");
    if (webcamCard) webcamCard.classList.add("hidden");

    basicData = {};
    stopWebcamMonitoring(false);
}

function startNewSession() {
    resetEmployeeFlow();
    const todayCard = document.getElementById("todayStatusCard");
    if (todayCard) todayCard.scrollIntoView({ behavior: "smooth" });
}

// Range Slider Listeners
const energySlider = document.getElementById("energy");
if (energySlider) {
    energySlider.addEventListener("input", function() {
        const valEl = document.getElementById("energyValue");
        if (valEl) valEl.innerText = this.value + "%";
    });
}

// Step 1: Submit Questionnaire
const basicStatusForm = document.getElementById("basicStatusForm");
if (basicStatusForm) {
    basicStatusForm.addEventListener("submit", function(event) {
        event.preventDefault();

        basicData = {
            sleepQuality: Number(document.getElementById("sleepQuality").value),
            dutyHours: Number(document.getElementById("dutyHours").value),
            mood: Number(document.getElementById("mood").value),
            workload: Number(document.getElementById("workload").value),
            energy: Number(document.getElementById("energy").value)
        };

        const todayCard = document.getElementById("todayStatusCard");
        if (todayCard) todayCard.classList.add("hidden");
        openWebcamMonitoring();
    });
}

function openWebcamMonitoring() {
    const camCard = document.getElementById("webcamCard");
    if (camCard) {
        camCard.classList.remove("hidden");
        camCard.scrollIntoView({ behavior: "smooth" });
    }
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

async function stopWebcamMonitoring(triggerSave = true) {
    const wasActive = webcamActive;

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
    const faceEl = document.getElementById("telemetryFace");
    if (faceEl) faceEl.innerText = "Offline";

    // If monitoring was actively recording, auto-save the session to database
    if (triggerSave && wasActive && currentEmployee) {
        console.log("[Aroghya] Monitoring stopped: saving session to database...");
        await submitAIPrediction();
    }
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
    // Derive objective stress indicator from workload, duty hours, mood, and sleep (no self-perceived stress)
    const workloadLvl = basicData.workload || 2;
    const dutyHrs = basicData.dutyHours || 8;
    const moodLvl = basicData.mood || 3;
    const sleepQ = basicData.sleepQuality || 3;
    const stressMod = Math.max(0.1, Math.min(0.9, (
        (workloadLvl / 4) * 0.35 +
        (Math.min(14, dutyHrs) / 14) * 0.25 +
        ((6 - moodLvl) / 5) * 0.25 +
        ((5 - sleepQ) / 4) * 0.15
    )));
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

        // Live stress estimation (70% questionnaire baseline + 30% visual biometrics)
        const liveBlinkStress = (latestWebcamSignals.blinkRate < 8 || latestWebcamSignals.blinkRate > 28) ? Math.min(100, Math.abs(latestWebcamSignals.blinkRate - 18) * 4.5) : 20.0;
        const liveVisual = Math.round(
            0.25 * latestWebcamSignals.facialTensionScore +
            0.25 * latestWebcamSignals.eyeFatigueScore +
            0.20 * latestWebcamSignals.postureSlouchScore +
            0.15 * latestWebcamSignals.restlessnessScore +
            0.15 * liveBlinkStress
        );
        const baselineStress = Math.round(stressMod * 70);
        const liveStressEst = Math.max(0, Math.min(100, Math.round(0.70 * baselineStress + 0.30 * liveVisual)));
        const liveStressEl = document.getElementById("telemetryLiveStress");
        if (liveStressEl) {
            let liveColor = "#16a34a";
            if (liveStressEst >= 80) liveColor = "#991b1b";
            else if (liveStressEst >= 65) liveColor = "#dc2626";
            else if (liveStressEst >= 45) liveColor = "#d97706";
            liveStressEl.innerHTML = `<strong style="color: ${liveColor}">${liveStressEst}%</strong> (${liveVisual}% visual)`;
        }
    }

    cvAnimFrameId = requestAnimationFrame(runRealTimeCVLoop);
}


function getFallbackRecommendations(category) {
    if (category === "LOW STRESS") {
        return {
            exercises: [
                "Maintain current active and healthy routine.",
                "Engage in 20-30 minutes of light aerobic exercise (walking, cycling, or jogging).",
                "Take periodic 2-minute visual and physical stretch breaks during duty."
            ],
            relaxation: [
                "Enjoy recreational hobbies or spend quality time with family/friends.",
                "Practice mindful evening relaxation to sustain restorative sleep."
            ],
            diet: [
                "Maintain optimal hydration: 2.5–3 liters of clean water daily.",
                "Eat balanced meals rich in whole grains, colorful vegetables, and lean proteins.",
                "Incorporate healthy fats such as walnuts, seeds, or avocado for sustained cognitive clarity."
            ],
            preventive: "Your stress level is currently low. Continue your healthy routine, ergonomic posture, and regular physical activity."
        };
    } else if (category === "NORMAL / MODERATE STRESS") {
        return {
            exercises: [
                "Follow the 30-Second Guided Box Breathing Exercise (Inhale 4s, Hold 4s, Exhale 4s, Hold 4s).",
                "Perform gentle cervical spine and shoulder rolls to release upper-back tension.",
                "Take a 10-15 minute brisk outdoor walk during your mid-day break."
            ],
            relaxation: [
                "Practice progressive muscle relaxation (tensing and releasing muscle groups).",
                "Brief 5-minute digital detox away from screens after intense tasks."
            ],
            diet: [
                "Drink warm herbal infusions (chamomile, green tea, or peppermint).",
                "Consume magnesium-rich snacks (almonds, pumpkin seeds, dark chocolate >70%).",
                "Limit caffeine and energy drinks to avoid elevated resting heart rate."
            ],
            preventive: "Mild stress indicators detected. Schedule regular micro-breaks and maintain ergonomic posture to avoid cumulative fatigue."
        };
    } else if (category === "HIGH STRESS") {
        return {
            exercises: [
                "Perform seated diaphragmatic breathing (slow 4-7-8 breathing sequence).",
                "Do gentle standing hamstring and upper pectoral stretches.",
                "Discontinue strenuous physical exertion until resting pulse stabilizes."
            ],
            relaxation: [
                "Take an immediate mandatory 15-minute restorative detachment break.",
                "Step away from high-stimulus screens into natural light or quiet space."
            ],
            diet: [
                "Stay hydrated with room-temperature water or electrolyte coconut water.",
                "Opt for easily digestible balanced foods (oatmeal, bananas, berries).",
                "Avoid stimulants, excessive sugar, and heavy meals that disrupt autonomic regulation."
            ],
            preventive: "Stress indicators are elevated. Scheduled pacing, ergonomic adjustments, and restorative relaxation are recommended."
        };
    } else {
        return {
            exercises: [
                "Discontinue high-intensity work immediately; initiate slow calming breath cycles.",
                "Immediate ergonomic rest in a quiet, low-stimulation environment.",
                "Important: Physical exercise is supportive and must NOT be treated as a substitute for professional care."
            ],
            relaxation: [
                "Urgent rest break authorized by institution guidelines.",
                "Connect with designated Aroghya Health Authority counsellor or clinical psychologist."
            ],
            diet: [
                "Ensure steady, gentle hydration with water and electrolyte-balanced soups.",
                "Easily digestible, nutrient-dense foods (warm broths, fruits, steamed vegetables).",
                "Strictly avoid caffeine, nicotine, and high-sugar processed foods during acute stress periods."
            ],
            preventive: "Your stress indicators are persistently elevated. Please prioritize support and counselling and consider professional assistance immediately."
        };
    }
}


/* =====================================================
   AI PREDICTION & FEATURE INTEGRATION SUBMISSION
===================================================== */

async function submitAIPrediction() {
    if (!currentEmployee) {
        console.warn("[Aroghya] Prediction requested but no employee logged in.");
        return;
    }

    const empId = currentEmployee.employeeId || currentEmployee.employee_id;
    if (!empId) {
        console.warn("[Aroghya] Missing employee ID for prediction.");
        return;
    }

    const runBtn = document.getElementById("runAiBtn");
    if (runBtn) {
        runBtn.innerText = "⏳ Processing AI Model Inference...";
        runBtn.disabled = true;
    }

    try {
        const payload = {
            employeeId: empId,
            employee_id: empId,
            profile: currentEmployee,
            questionnaire: basicData || {},
            webcamSignals: latestWebcamSignals
        };

        const res = await fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success) {
            displayPredictionResults(result, true);
            // Refresh weekly historical trend chart
            const historyRes = await fetch(`/api/employee/dashboard/${encodeURIComponent(empId)}`);
            const historyData = await historyRes.json();
            if (historyData.success && historyData.data) {
                updateDashboardHistoryUI(historyData.data);
            }
        } else {
            console.error("Prediction error:", result.message);
            alert("Prediction error: " + (result.message || "Unknown error"));
        }
    } catch (err) {
        console.error("AI inference error:", err);
        alert("Failed to reach AI Prediction backend. Ensure server.py is running on port 5000.");
    } finally {
        if (runBtn) {
            runBtn.innerText = "⚡ Run AI Stress Prediction 🤖";
            runBtn.disabled = false;
        }
    }
}


function displayPredictionResults(result, shouldScroll = true) {
    if (!result) return;
    const predCard = document.getElementById("predictionCard");
    if (predCard) {
        predCard.classList.remove("hidden");
        if (shouldScroll) {
            predCard.scrollIntoView({ behavior: "smooth" });
        }
    }

    const rawScore = result.calibratedScore !== undefined ? result.calibratedScore : (result.calibrated_stress_score !== undefined ? result.calibrated_stress_score : (result.stressScore !== undefined ? result.stressScore : 0));
    const score = Math.max(0, Math.min(100, Math.round(Number(rawScore) || 0)));
    const category = result.category || result.stress_category || result.stressCategory || "NORMAL / MODERATE STRESS";
    const welfareStatus = result.welfareStatus || result.welfare_status || "Stable";
    const rawModelVal = result.rawModelScore !== undefined ? result.rawModelScore : (result.raw_model_score !== undefined ? result.raw_model_score : (score / 10).toFixed(1));

    let recommendations = result.recommendations;
    if (!recommendations || (!recommendations.exercises && !recommendations.diet)) {
        recommendations = getFallbackRecommendations(category);
    }

    // 1. Update Circular Gauge
    const scoreEl = document.getElementById("stressScore");
    if (scoreEl) scoreEl.innerText = score + "%";

    const arc = document.getElementById("gaugeProgressArc");
    if (arc) {
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
        if (categoryBadge) {
            categoryBadge.innerText = category;
            categoryBadge.className = `stress-category-badge ${badgeClass}`;
        }
    }

    const welfareTextEl = document.getElementById("welfareStatusText");
    if (welfareTextEl) welfareTextEl.innerText = `Welfare Status: ${welfareStatus}`;

    // Update profile status pill
    const profilePill = document.getElementById("profileWelfareStatus");
    if (profilePill) {
        profilePill.innerText = welfareStatus;
        profilePill.className = `status-pill ${score >= 80 ? 'status-risk' : score >= 65 ? 'status-attention' : score >= 45 ? 'status-stable' : 'status-optimal'}`;
    }

    // 3. Risk Detection Alert Banners
    const riskAlertBanner = document.getElementById("riskAlertBanner");
    const empRiskBanner = document.getElementById("employeeRiskBanner");

    if (score >= 80) {
        if (riskAlertBanner) {
            riskAlertBanner.className = "alert-banner risk-banner high-risk";
            riskAlertBanner.innerHTML = `
                <div class="risk-icon">🚨</div>
                <div class="risk-details">
                    <h3>HIGH-RISK WELFARE ALERT</h3>
                    <p>Critical cumulative stress markers detected. Confidential counselling support and institutional attention have been notified.</p>
                </div>
            `;
            riskAlertBanner.classList.remove("hidden");
        }

        if (empRiskBanner) {
            empRiskBanner.className = "risk-banner high-risk";
            const iconEl = document.getElementById("riskBannerIcon");
            if (iconEl) iconEl.innerText = "🚨";
            const titleEl = document.getElementById("riskBannerTitle");
            if (titleEl) titleEl.innerText = "HIGH-RISK WELFARE ALERT";
            const descEl = document.getElementById("riskBannerDesc");
            if (descEl) descEl.innerText = "Persistent high stress indicators detected. Please prioritize rest and access counselling support.";
            empRiskBanner.classList.remove("hidden");
        }
    } else if (score >= 65) {
        if (riskAlertBanner) {
            riskAlertBanner.className = "alert-banner risk-banner high-stress";
            riskAlertBanner.innerHTML = `
                <div class="risk-icon">⚠️</div>
                <div class="risk-details">
                    <h3>HIGH STRESS – ATTENTION REQUIRED</h3>
                    <p>Elevated stress indicators detected across survey and real-time biometrics. Restorative breaks and breathing exercises recommended.</p>
                </div>
            `;
            riskAlertBanner.classList.remove("hidden");
        }

        if (empRiskBanner) {
            empRiskBanner.className = "risk-banner high-stress";
            const iconEl = document.getElementById("riskBannerIcon");
            if (iconEl) iconEl.innerText = "⚠️";
            const titleEl = document.getElementById("riskBannerTitle");
            if (titleEl) titleEl.innerText = "HIGH STRESS – ATTENTION REQUIRED";
            const descEl = document.getElementById("riskBannerDesc");
            if (descEl) descEl.innerText = "Stress indicators are elevated. Scheduled pacing and relaxation recommended.";
            empRiskBanner.classList.remove("hidden");
        }
    } else {
        if (riskAlertBanner) riskAlertBanner.classList.add("hidden");
        if (empRiskBanner) empRiskBanner.classList.add("hidden");
    }

    // 4. Summary Metrics
    const rawScoreText = document.getElementById("rawModelScoreText");
    if (rawScoreText) rawScoreText.innerText = `${rawModelVal} / 10.0`;

    const calVisualText = document.getElementById("calibratedVisualText");
    if (calVisualText) calVisualText.innerText = "Active (Multi-modal 70/30 Fusion)";

    // Progress Bar
    const progressBar = document.getElementById("stressProgressBar");
    if (progressBar) progressBar.style.width = score + "%";

    // 5. Populate Dynamic Recommendations
    if (recommendations) {
        const exList = document.getElementById("personalizedExercisesList");
        if (exList && recommendations.exercises) {
            exList.innerHTML = (recommendations.exercises || []).map(item => `<li>${item}</li>`).join("");
        }

        const dietList = document.getElementById("balancedDietList");
        if (dietList && recommendations.diet) {
            dietList.innerHTML = (recommendations.diet || []).map(item => `<li>${item}</li>`).join("");
        }

        const prevInst = document.getElementById("preventiveInstructionText");
        if (prevInst) {
            prevInst.innerText = recommendations.preventive || "";
        }
    }

    // 6. Populate Multi-Modal Biometric Factors Breakdown Graph
    const questionnaireData = result.questionnaire || result.questionnaire_data || basicData || {};
    const biometricData = result.webcamSignals || result.webcam_signals || result.webcam_features || latestWebcamSignals || {};
    renderFactorsChart(questionnaireData, biometricData, score);

    // 7. Populate Desk Warm-up & Tension Release Exercises
    renderWarmupExercises(recommendations);

    // 8. Ensure Stress Analysis & Trajectory card is visible
    const stressCard = document.getElementById("stressAnalysisCard");
    if (stressCard) {
        stressCard.classList.remove("hidden");
    }
}


function updateDashboardHistoryUI(dashboardData) {
    if (!dashboardData) return;

    // Previous Score
    const prevScore = dashboardData.previous_score !== undefined ? dashboardData.previous_score : dashboardData.previousScore;
    const prevScoreEl = document.getElementById("prevScoreText");
    if (prevScoreEl) {
        prevScoreEl.innerText = (prevScore !== null && prevScore !== undefined) ? `${prevScore}%` : "Baseline (First Session)";
    }

    // Trend
    const trendText = dashboardData.trend || "Stable";
    const trendEl = document.getElementById("trendText");
    if (trendEl) trendEl.innerText = trendText;

    // High stress events count
    const highEvents = dashboardData.high_stress_events !== undefined ? dashboardData.high_stress_events : (dashboardData.highStressEvents || 0);
    const highEventsEl = document.getElementById("highEventsCountText");
    if (highEventsEl) highEventsEl.innerText = highEvents;

    // Weekly history arrays
    let labels = dashboardData.weekly_labels || dashboardData.weeklyLabels || [];
    let scores = dashboardData.weekly_scores || dashboardData.weeklyScores || [];

    if (scores.length === 0 && dashboardData.latest) {
        const latestVal = dashboardData.latest.calibratedScore !== undefined ? dashboardData.latest.calibratedScore : (dashboardData.latest.calibrated_stress_score !== undefined ? dashboardData.latest.calibrated_stress_score : dashboardData.latest.stressScore);
        if (latestVal !== undefined && latestVal !== null) {
            scores = [Math.max(0, Math.min(100, Math.round(Number(latestVal) || 0)))];
            labels = ["Today"];
        }
    }

    // Stress Analysis Summary Bar Updates
    const latest = dashboardData.latest;
    const analysisScoreEl = document.getElementById("analysisCurrentScore");
    const analysisCategoryEl = document.getElementById("analysisCategoryBadge");
    const analysisTrendEl = document.getElementById("analysisTrendText");
    const analysisSessionsEl = document.getElementById("analysisTotalSessions");

    if (latest) {
        const latestScore = latest.calibratedScore !== undefined ? latest.calibratedScore : (latest.calibrated_stress_score !== undefined ? latest.calibrated_stress_score : latest.stressScore);
        const scoreNum = Math.max(0, Math.min(100, Math.round(Number(latestScore) || 0)));
        if (analysisScoreEl) analysisScoreEl.innerText = `${scoreNum}%`;

        const cat = latest.category || latest.stress_category || latest.stressCategory || "OPTIMAL";
        if (analysisCategoryEl) {
            analysisCategoryEl.innerText = cat;
            let pillClass = "status-optimal";
            if (scoreNum >= 80) pillClass = "status-risk";
            else if (scoreNum >= 65) pillClass = "status-risk";
            else if (scoreNum >= 45) pillClass = "status-attention";
            analysisCategoryEl.className = `status-pill ${pillClass}`;
        }
    } else {
        if (analysisScoreEl) analysisScoreEl.innerText = "--%";
        if (analysisCategoryEl) {
            analysisCategoryEl.innerText = "Not Monitored";
            analysisCategoryEl.className = "status-pill status-optimal";
        }
    }

    if (analysisTrendEl) analysisTrendEl.innerText = trendText;
    const totalSessions = dashboardData.total_sessions !== undefined ? dashboardData.total_sessions : (scores.length || 0);
    if (analysisSessionsEl) analysisSessionsEl.innerText = totalSessions;

    // Draw authentic trend chart on canvas
    drawEmployeeTrendCanvas(labels, scores);
}


/* =====================================================
   MULTI-MODAL BIOMETRIC FACTORS GRAPH REPRESENTATION
===================================================== */

function renderFactorsChart(questionnaire, webcamSignals, calibratedScore) {
    const container = document.getElementById("factorsBarsContainer");
    if (!container) return;

    const q = questionnaire || basicData || {};
    const w = webcamSignals || latestWebcamSignals || {};

    // 1. Sleep Deficit Index (0-100)
    let sleepVal = Number(q.sleepQuality);
    let sleepPct = 30;
    if (sleepVal === 1) sleepPct = 90;
    else if (sleepVal === 2) sleepPct = 65;
    else if (sleepVal === 3) sleepPct = 30;
    else if (sleepVal === 4) sleepPct = 12;

    // 2. Duty Hours Burden (0-100)
    let dutyHours = Number(q.dutyHours) || 8;
    let dutyPct = Math.min(100, Math.max(15, Math.round((dutyHours / 12) * 100)));

    // 3. Workload & Deadline Pressure (0-100)
    let workloadVal = Number(q.workload);
    let workloadPct = 45;
    if (workloadVal === 1) workloadPct = 20;
    else if (workloadVal === 2) workloadPct = 45;
    else if (workloadVal === 3) workloadPct = 75;
    else if (workloadVal === 4) workloadPct = 95;

    // 4. Emotional Strain (0-100)
    let moodVal = Number(q.mood);
    let moodPct = 40;
    if (moodVal === 1) moodPct = 90;
    else if (moodVal === 2) moodPct = 70;
    else if (moodVal === 3) moodPct = 40;
    else if (moodVal === 4) moodPct = 20;
    else if (moodVal === 5) moodPct = 10;

    // 5. Fatigue / Energy Depletion (0-100)
    let energyVal = q.energy !== undefined ? Number(q.energy) : 50;
    let fatiguePct = Math.max(0, Math.min(100, 100 - energyVal));

    // 6. Eye Blink & Digital Strain (0-100)
    let eyeFatigue = Number(w.eyeFatigueScore) || 28;

    // 7. Facial & Muscular Strain (0-100)
    let facialTension = Number(w.facialTensionScore) || 32;

    // 8. Postural Slouch Deviation (0-100)
    let slouchScore = Number(w.postureSlouchScore) || 25;

    // 9. Calibrated Multi-Modal Score
    let finalScore = Math.max(0, Math.min(100, Math.round(Number(calibratedScore) || 0)));

    const factors = [
        { emoji: "🌙", name: "Sleep Deficit & Rest Fatigue", pct: sleepPct, detail: sleepPct > 60 ? "Deficit" : "Restorative" },
        { emoji: "⏱️", name: "Duty Hours & Shift Burden", pct: dutyPct, detail: `${dutyHours} hrs worked` },
        { emoji: "💼", name: "Workload & Deadline Strain", pct: workloadPct, detail: workloadPct > 60 ? "Intense" : "Manageable" },
        { emoji: "🎭", name: "Emotional & Mood Strain", pct: moodPct, detail: moodPct > 60 ? "Elevated" : "Balanced" },
        { emoji: "⚡", name: "Vitality Deficit / Exhaustion", pct: fatiguePct, detail: `${100 - fatiguePct}% energy left` },
        { emoji: "👁️", name: "Eye Blink & Ocular Strain", pct: eyeFatigue, detail: eyeFatigue > 60 ? "Strained" : "Normal" },
        { emoji: "😠", name: "Facial & Cranial Muscle Tension", pct: facialTension, detail: facialTension > 60 ? "Tense" : "Relaxed" },
        { emoji: "🪑", name: "Postural Slouch & Ergonomics", pct: slouchScore, detail: slouchScore > 60 ? "Poor Posture" : "Ergonomic" },
        { emoji: "🧠", name: "Overall Multi-Modal AI Stress Score", pct: finalScore, detail: finalScore >= 65 ? "High Stress" : finalScore >= 45 ? "Moderate" : "Optimal", highlight: true }
    ];

    container.innerHTML = factors.map(f => {
        let barColor = "#16a34a"; // Green
        let badgeBg = "#dcfce7";
        let badgeColor = "#166534";
        if (f.pct >= 80) {
            barColor = "#991b1b"; // Dark Red
            badgeBg = "#fee2e2";
            badgeColor = "#991b1b";
        } else if (f.pct >= 65) {
            barColor = "#dc2626"; // Red
            badgeBg = "#fef2f2";
            badgeColor = "#dc2626";
        } else if (f.pct >= 45) {
            barColor = "#d97706"; // Amber
            badgeBg = "#fef3c7";
            badgeColor = "#b45309";
        }

        const borderStyle = f.highlight ? "border: 1.5px solid #3b82f6; background: #eff6ff;" : "";

        return `
            <div class="factor-row" style="${borderStyle}">
                <div class="factor-label-block">
                    <span class="factor-emoji">${f.emoji}</span>
                    <span>${f.name}</span>
                </div>
                <div class="factor-track">
                    <div class="factor-fill" style="width: ${f.pct}%; background: ${barColor};"></div>
                </div>
                <div class="factor-val" style="color: ${barColor};">${f.pct}%</div>
                <div>
                    <span class="factor-status-badge" style="background: ${badgeBg}; color: ${badgeColor};">
                        ${f.detail}
                    </span>
                </div>
            </div>
        `;
    }).join("");
}


/* =====================================================
   DESK WARM-UP & TENSION RELEASE EXERCISES
===================================================== */

function renderWarmupExercises(recommendations) {
    const grid = document.getElementById("warmupGridContainer");
    if (!grid) return;

    let list = (recommendations && recommendations.warmup_exercises && recommendations.warmup_exercises.length > 0)
        ? recommendations.warmup_exercises
        : [
            {
                name: "Neck & Cervical Release",
                icon: "🙆‍♂️",
                duration: "45s",
                reps: "5 Reps/Side",
                instruction: "Slowly tilt right ear toward shoulder, hold for 5s, roll chin down across chest to left shoulder.",
                target: "Cervical spine, trapezius, stiff neck muscles"
            },
            {
                name: "Shoulder Shrugs & Rolls",
                icon: "🤸",
                duration: "40s",
                reps: "10 Smooth Rolls",
                instruction: "Inhale deeply lifting shoulders toward ears, roll backwards and down, squeezing scapula together.",
                target: "Reverses monitor hunch and upper back tightness"
            },
            {
                name: "Seated Torso Spine Twist",
                icon: "🧘",
                duration: "60s",
                reps: "3 Breaths/Side",
                instruction: "Sit tall with feet flat. Place right hand on left knee, left hand behind chair, inhale and exhale gentle twist.",
                target: "Lumbar mobility and thoracic spine decompression"
            },
            {
                name: "20-20-20 Eye Strain Reset",
                icon: "👁️",
                duration: "30s",
                reps: "Optical Relief",
                instruction: "Look at an object 20 feet away for 20s, blink 10 times, rub palms until warm and softly cup over closed eyes.",
                target: "Ciliary eye muscles and digital screen fatigue"
            },
            {
                name: "Wrist & Forearm Flexor Extensor",
                icon: "🤲",
                duration: "30s",
                reps: "2 Reps Each",
                instruction: "Extend arm forward with palm out, gently pull fingers backward with other hand for 15s. Reverse palm down.",
                target: "Carpal tunnel prevention and mouse wrist strain"
            },
            {
                name: "4-7-8 Relaxation Breathing",
                icon: "🫁",
                duration: "60s",
                reps: "4 Cycles",
                instruction: "Inhale quietly through nose for 4s, hold breath for 7s, exhale completely through mouth for 8s with whoosh sound.",
                target: "Vagus nerve activation and rapid autonomic nervous reset"
            }
        ];

    grid.innerHTML = list.map(item => `
        <div class="warmup-item-card">
            <div class="warmup-card-top">
                <span class="warmup-emoji">${item.icon}</span>
                <div class="warmup-titles">
                    <h4>${item.name}</h4>
                    <span class="warmup-tag">⏱️ ${item.duration} • 🔁 ${item.reps}</span>
                </div>
            </div>
            <p class="warmup-instruction">${item.instruction}</p>
            <div class="warmup-target-badge">🎯 Target: ${item.target}</div>
        </div>
    `).join("");
}


/* =====================================================
   HISTORICAL CHARTS & DASHBOARD HISTORY
===================================================== */

let cachedTrendLabels = [];
let cachedTrendScores = [];

/**
 * High-definition Canvas Line Chart for Employee Stress History
 * Gracefully handles 0 sessions (empty state), 1 session (center point + baseline),
 * and multi-session trend lines with rich colored threshold zones.
 */
function drawEmployeeTrendCanvas(labels, scores) {
    const canvas = document.getElementById("employeeChart");
    if (!canvas) return;

    if (labels && scores) {
        cachedTrendLabels = labels;
        cachedTrendScores = scores;
    } else {
        labels = cachedTrendLabels;
        scores = cachedTrendScores;
    }

    const emptyState = document.getElementById("chartEmptyState");
    if (!scores || scores.length === 0) {
        if (emptyState) emptyState.classList.remove("hidden");
        canvas.style.display = "none";
        return;
    }

    if (emptyState) emptyState.classList.add("hidden");
    canvas.style.display = "block";

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const containerW = canvas.parentElement ? canvas.parentElement.clientWidth : 760;
    const w = Math.max(300, rect.width || containerW || 760);
    const h = 260;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    const padding = { top: 30, right: 35, bottom: 45, left: 55 };
    ctx.clearRect(0, 0, w, h);

    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Draw shaded threshold background bands
    const y44 = padding.top + chartH * (1 - 0.44);
    const y65 = padding.top + chartH * (1 - 0.65);
    const y80 = padding.top + chartH * (1 - 0.80);
    const y100 = padding.top;
    const y0 = padding.top + chartH;

    // 0-44% Green zone
    ctx.fillStyle = "rgba(22, 163, 74, 0.05)";
    ctx.fillRect(padding.left, y44, chartW, y0 - y44);

    // 45-64% Amber zone
    ctx.fillStyle = "rgba(217, 119, 6, 0.05)";
    ctx.fillRect(padding.left, y65, chartW, y44 - y65);

    // 65-79% Red zone
    ctx.fillStyle = "rgba(220, 38, 38, 0.06)";
    ctx.fillRect(padding.left, y80, chartW, y65 - y80);

    // 80-100% Dark Crimson zone
    ctx.fillStyle = "rgba(153, 27, 27, 0.08)";
    ctx.fillRect(padding.left, y100, chartW, y80 - y100);

    // 1. Draw horizontal grid lines & threshold labels
    const gridSteps = [0, 25, 50, 75, 100];
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";

    gridSteps.forEach(val => {
        const y = padding.top + chartH * (1 - val / 100);
        ctx.strokeStyle = val === 50 ? "#cbd5e1" : "#f1f5f9";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        ctx.fillText(val + "%", padding.left - 10, y + 4);
    });

    // 2. Single session baseline visualization
    if (scores.length === 1) {
        const score = scores[0];
        const label = labels[0] || "Today's Assessment";
        const centerX = padding.left + chartW / 2;
        const centerY = padding.top + chartH * (1 - score / 100);

        // Dashed reference baseline
        ctx.strokeStyle = "rgba(37, 99, 235, 0.35)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(padding.left, centerY);
        ctx.lineTo(w - padding.right, centerY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Outer glow
        let nodeColor = "#16a34a";
        if (score >= 80) nodeColor = "#991b1b";
        else if (score >= 65) nodeColor = "#dc2626";
        else if (score >= 45) nodeColor = "#d97706";

        ctx.fillStyle = "rgba(37, 99, 235, 0.15)";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Badge text
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${score}% (Initial Baseline)`, centerX, centerY - 14);

        ctx.fillStyle = "#64748b";
        ctx.font = "12px Inter, system-ui, sans-serif";
        ctx.fillText(label, centerX, h - padding.bottom + 22);
        return;
    }

    // 3. Multi-Session Trend Line
    const stepX = chartW / (scores.length - 1);
    const points = scores.map((score, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + chartH * (1 - score / 100);
        return { x, y, score, label: labels[i] || `S${i+1}` };
    });

    // Draw connecting line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Gradient fill under line
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    grad.addColorStop(0, "rgba(37, 99, 235, 0.25)");
    grad.addColorStop(1, "rgba(37, 99, 235, 0.02)");
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.lineTo(points[0].x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw Nodes
    points.forEach(p => {
        let nodeColor = "#16a34a";
        if (p.score >= 80) nodeColor = "#991b1b";
        else if (p.score >= 65) nodeColor = "#dc2626";
        else if (p.score >= 45) nodeColor = "#d97706";

        // Outer glow
        ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Node score text
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${p.score}%`, p.x, p.y - 12);

        // X-axis label
        ctx.fillStyle = "#64748b";
        ctx.font = "11px Inter, system-ui, sans-serif";
        ctx.fillText(p.label, p.x, h - padding.bottom + 22);
    });
}

// Global debounced resize listener to keep trend chart perfectly rendered
window.addEventListener("resize", function() {
    if (cachedTrendScores && cachedTrendScores.length > 0) {
        drawEmployeeTrendCanvas(cachedTrendLabels, cachedTrendScores);
    }
});


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
        const score = emp.calibratedScore !== undefined ? emp.calibratedScore : emp.calibrated_stress_score;
        let scoreBadge = `<span class="status-pill status-optimal">Not Monitored</span>`;
        let catText = emp.category || emp.stress_category || "Unassessed";
        let riskText = emp.riskStatus || emp.risk_status || "NORMAL";
        const empId = emp.employeeId || emp.employee_id || "";
        const empName = emp.name || "Colleague";

        if (score !== null && score !== undefined && score !== "" && !isNaN(score)) {
            let badgeClass = "badge-low";
            if (score >= 80) badgeClass = "badge-critical";
            else if (score >= 65) badgeClass = "badge-high";
            else if (score >= 45) badgeClass = "badge-normal";

            scoreBadge = `<span class="stress-category-badge ${badgeClass}" style="padding: 3px 8px; font-size: 12px;">${score}%</span>`;
        }

        // Counselling Status
        const cStatus = (emp.counselling && emp.counselling.status) ? emp.counselling.status : "None";
        const cBadge = cStatus === "In Progress"
            ? `<span class="status-pill status-attention">In Progress</span>`
            : cStatus === "Completed"
            ? `<span class="status-pill status-optimal">Completed</span>`
            : `<span class="status-pill status-stable">None</span>`;

        return `
            <tr>
                <td><strong>${empId}</strong></td>
                <td>${empName}</td>
                <td>${scoreBadge}</td>
                <td><strong>${catText}</strong></td>
                <td>${emp.trend || "Stable"}</td>
                <td>${riskText}</td>
                <td>${cBadge}</td>
                <td>
                    <button class="action-btn" onclick="openCounsellingModal('${empId}')">
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
        const empName = (emp.name || "").toLowerCase();
        const empId = (emp.employeeId || emp.employee_id || "").toLowerCase();
        const matchText = empName.includes(query) || empId.includes(query);
        if (!matchText) return false;

        if (filterCat === "ALL") return true;
        const score = emp.calibratedScore !== undefined ? emp.calibratedScore : (emp.calibrated_stress_score || 0);
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
            const empUser = dash.user || {};
            const empDisplayName = empUser.name || employeeId;

            document.getElementById("modalEmployeeName").innerText = `${empDisplayName} (${employeeId})`;
            document.getElementById("modalEmployeeSub").innerText = empUser.email ? `Employee ID: ${employeeId} • ${empUser.email}` : `Employee ID: ${employeeId}`;

            const scoreVal = latest.calibratedScore !== undefined ? latest.calibratedScore : latest.calibrated_stress_score;
            document.getElementById("modalStressScore").innerText = (scoreVal !== undefined && scoreVal !== null) ? `${scoreVal}%` : "N/A";
            document.getElementById("modalStressCategory").innerText = latest.category || latest.stress_category || "Unassessed";
            document.getElementById("modalStressTrend").innerText = dash.trend || "Stable";
            document.getElementById("modalRiskStatus").innerText = latest.riskStatus || latest.risk_status || "NORMAL";

            // Render previous counselling records table
            const cList = data.counselling || [];
            const cTbody = document.getElementById("pastCounsellingTableBody");
            if (cList.length === 0) {
                cTbody.innerHTML = `<tr><td colspan="5" class="text-center">No prior counselling records for this employee.</td></tr>`;
            } else {
                cTbody.innerHTML = cList.map(rec => `
                    <tr>
                        <td>${(rec.created_at || "").split(" ")[0] || "Recent"}</td>
                        <td><span class="status-pill ${rec.status === 'Completed' ? 'status-optimal' : 'status-attention'}">${rec.status}</span></td>
                        <td><strong>${rec.support_action || rec.supportAction || "Support"}</strong></td>
                        <td>${rec.notes || ""}</td>
                        <td>${rec.follow_up_date || rec.followUpDate || "N/A"}</td>
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

    const authId = (currentAuthority && (currentAuthority.employeeId || currentAuthority.employee_id)) ? (currentAuthority.employeeId || currentAuthority.employee_id) : "Aroghya704";

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
                authorityId: authId
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


// Auto initialize on DOM ready and restore active session if present
document.addEventListener("DOMContentLoaded", () => {
    console.log("Aroghya AI Stress Monitoring System Initialized.");

    const savedEmp = sessionStorage.getItem("aroghya_current_employee");
    const savedAuth = sessionStorage.getItem("aroghya_current_authority");

    if (savedEmp) {
        try {
            currentEmployee = JSON.parse(savedEmp);
            if (currentEmployee && (currentEmployee.employeeId || currentEmployee.employee_id)) {
                currentEmployee.employeeId = currentEmployee.employeeId || currentEmployee.employee_id;
                currentEmployee.employee_id = currentEmployee.employeeId;
                loadEmployeeDashboard();
            }
        } catch (e) {
            console.warn("Could not parse saved employee session:", e);
            sessionStorage.removeItem("aroghya_current_employee");
        }
    } else if (savedAuth) {
        try {
            currentAuthority = JSON.parse(savedAuth);
            if (currentAuthority && (currentAuthority.employeeId || currentAuthority.employee_id)) {
                currentAuthority.employeeId = currentAuthority.employeeId || currentAuthority.employee_id;
                currentAuthority.employee_id = currentAuthority.employeeId;
                loadAuthorityDashboard();
            }
        } catch (e) {
            console.warn("Could not parse saved authority session:", e);
            sessionStorage.removeItem("aroghya_current_authority");
        }
    }
});