"""
Aroghya AI Stress & Welfare Monitoring System - Backend Server
Flask REST API integrating:
- Existing trained Random Forest AI model (stress_model.pkl)
- Multi-modal Feature-Integration Layer (Dataset inputs + Real-time Webcam signals)
- Persistent SQLite Database (Aroghya.db)
- Dynamic Employee & Single Higher Authority Dashboards
"""

import os
import json
import joblib
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
import database

app = Flask(__name__, static_folder=".", static_url_path="")

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
    return response

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "INTELLI2", "stress_model.pkl")


def safe_float(val, default=0.0):
    if val is None or val == "" or str(val).strip().lower() in ("undefined", "null", "none"):
        return float(default)
    try:
        return float(val)
    except (ValueError, TypeError):
        return float(default)


def safe_int(val, default=0):
    if val is None or val == "" or str(val).strip().lower() in ("undefined", "null", "none"):
        return int(default)
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return int(default)


# Load trained AI Model Pipeline
print(f"[AI] Loading trained model from {MODEL_PATH}...")
try:
    AI_MODEL = joblib.load(MODEL_PATH)
    print("[AI] Trained Random Forest model loaded successfully.")
except Exception as e:
    print(f"[AI ERROR] Could not load model: {e}")
    AI_MODEL = None

# Initialize database
database.init_db()


# =====================================================
# STATIC FRONTEND ROUTES
# =====================================================

@app.route("/")
def serve_index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(BASE_DIR, filename)


# =====================================================
# AUTHENTICATION ENDPOINTS
# =====================================================

@app.route("/api/auth/register-employee", methods=["POST"])
def api_register_employee():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    employee_id = (data.get("employeeId") or data.get("employee_id") or "").strip()
    password = data.get("password", "")

    if not name or not email or not employee_id or not password:
        return jsonify({"success": False, "message": "All fields are required."}), 400

    result = database.register_employee(name, email, employee_id, password)
    status_code = 200 if result["success"] else 400
    if result.get("success") and "user" in result:
        result["user"]["employeeId"] = result["user"].get("employee_id")
    return jsonify(result), status_code


@app.route("/api/auth/register-authority", methods=["POST"])
def api_register_authority():
    data = request.get_json() or {}
    institution_name = data.get("institutionName", "").strip()
    email = data.get("institutionEmail", "").strip()
    institution_id = (data.get("institutionId") or data.get("institution_id") or "").strip()
    password = data.get("password", "")

    if not institution_name or not email or not institution_id or not password:
        return jsonify({"success": False, "message": "All fields are required."}), 400

    result = database.register_authority(institution_name, email, institution_id, password)
    status_code = 200 if result["success"] else 400
    if result.get("success") and "user" in result:
        result["user"]["employeeId"] = result["user"].get("employee_id")
    return jsonify(result), status_code


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    login_id = (data.get("loginId") or data.get("login_id") or "").strip()
    password = data.get("password", "")
    role = data.get("role", "employee")

    if not login_id or not password:
        return jsonify({"success": False, "message": "Email/ID and Password are required."}), 400

    result = database.authenticate_user(login_id, password, expected_role=role)
    status_code = 200 if result["success"] else 401
    if result.get("success") and "user" in result:
        u = result["user"]
        u["employeeId"] = u.get("employee_id")
        u["employee_id"] = u.get("employee_id")
        if u.get("role") == "authority":
            u["institutionId"] = u.get("employee_id")
            u["institution_id"] = u.get("employee_id")
            u["institutionName"] = u.get("name")
            u["institution_name"] = u.get("name")
    return jsonify(result), status_code


# =====================================================
# AI PREDICTION & FEATURE-INTEGRATION PIPELINE
# =====================================================

def prepare_model_features(questionnaire, profile):
    """
    Constructs a DataFrame with the EXACT 24 features and order
    expected by the trained Random Forest Pipeline.
    Categorical: ['gender', 'job_role', 'company_size', 'work_mode', 'burnout_level']
    Numerical:   ['age', 'experience_years', 'work_hours_per_week', 'overtime_hours',
                  'meetings_per_day', 'deadlines_missed', 'job_satisfaction',
                  'manager_support', 'work_life_balance', 'sleep_hours',
                  'physical_activity_days', 'screen_time_hours', 'caffeine_intake',
                  'social_support_score', 'has_therapy', 'anxiety_score',
                  'depression_score', 'burnout_score', 'seeks_professional_help']
    """
    if not questionnaire or not isinstance(questionnaire, dict):
        questionnaire = {}
    if not profile or not isinstance(profile, dict):
        profile = {}

    # 1. Questionnaire inputs with safe type conversion (self-perceived stress removed)
    sleep_quality = safe_float(questionnaire.get("sleepQuality"), 3.0)   # 1 to 4
    duty_hours = safe_float(questionnaire.get("dutyHours"), 8.0)         # 0 to 24
    mood = safe_float(questionnaire.get("mood"), 3.0)                   # 1 to 5
    energy = safe_float(questionnaire.get("energy"), 50.0)              # 0 to 100
    workload = safe_float(questionnaire.get("workload"), 2.0)           # 1 to 4

    # 2. Objective sleep & physical activity parameters
    sleep_hours_map = {1: 4.5, 2: 6.0, 3: 7.5, 4: 8.5}
    sleep_hours = sleep_hours_map.get(int(sleep_quality), 7.0)
    physical_activity_days = 3

    # 3. Workload & schedule conversions
    work_hours_per_week = float(duty_hours * 5.0)
    overtime_hours = float(max(0.0, (duty_hours - 8.0) * 5.0))
    meetings_per_day = float(min(8.0, max(1.0, workload * 1.5)))
    deadlines_missed = int(max(0, int((workload - 2.0) * 1.2)))

    # 4. Psychological & welfare proxy scores (1.0 to 10.0 scale) derived objectively
    job_satisfaction = float(round((mood / 5.0) * 10.0, 1))
    manager_support = 6.0
    work_life_balance = float(round(max(1.0, 10.0 - (duty_hours - 6.0) - (4.0 - sleep_quality) * 1.5), 1))
    screen_time_hours = float(round(duty_hours * 0.9, 1))
    caffeine_intake = 2
    social_support_score = float(round(mood * 1.6, 1))
    has_therapy = 0

    # Anxiety, depression, and burnout objectively synthesized without self-perceived stress
    anxiety_score = float(round(min(10.0, max(1.0, (5.0 - mood) * 1.5 + workload * 1.25)), 1))
    depression_score = float(round(min(10.0, max(1.0, ((100.0 - energy) / 10.0))), 1))
    burnout_score = float(round(min(10.0, max(1.0, (workload * 1.8 + (duty_hours - 6.0) * 0.4 + (4.0 - sleep_quality) * 0.75))), 1))

    if burnout_score < 4.0:
        burnout_level = "Low"
    elif burnout_score < 7.0:
        burnout_level = "Moderate"
    else:
        burnout_level = "High"

    seeks_professional_help = 1 if (anxiety_score >= 7.5 or burnout_score >= 7.5) else 0

    age = 30
    gender = "Female" if "pranavi" in str(profile.get("name", "")).lower() else "Male"
    job_role = "Backend Developer"
    experience_years = 4.5
    company_size = "Mid-size"
    work_mode = "Hybrid"

    features = {
        "age": [age],
        "gender": [gender],
        "job_role": [job_role],
        "experience_years": [experience_years],
        "company_size": [company_size],
        "work_mode": [work_mode],
        "work_hours_per_week": [work_hours_per_week],
        "overtime_hours": [overtime_hours],
        "meetings_per_day": [meetings_per_day],
        "deadlines_missed": [deadlines_missed],
        "job_satisfaction": [job_satisfaction],
        "manager_support": [manager_support],
        "work_life_balance": [work_life_balance],
        "sleep_hours": [sleep_hours],
        "physical_activity_days": [physical_activity_days],
        "screen_time_hours": [screen_time_hours],
        "caffeine_intake": [caffeine_intake],
        "social_support_score": [social_support_score],
        "has_therapy": [has_therapy],
        "anxiety_score": [anxiety_score],
        "depression_score": [depression_score],
        "burnout_score": [burnout_score],
        "burnout_level": [burnout_level],
        "seeks_professional_help": [seeks_professional_help]
    }

    df = pd.DataFrame(features)
    return df


def calculate_feature_integration(raw_model_score, webcam_signals):
    """
    Combines the trained AI model prediction (1.0 to 10.0 scale)
    with real-time webcam biometrics (blink rate, eye fatigue, facial tension,
    posture slouch, restlessness) into a calibrated dynamic 0-100% stress score.
    """
    raw_model_score = safe_float(raw_model_score, 5.5)
    base_model_pct = (raw_model_score / 10.0) * 100.0

    if webcam_signals and isinstance(webcam_signals, dict):
        blink_rate = safe_float(webcam_signals.get("blinkRate") or webcam_signals.get("blink_rate"), 16.0)
        eye_fatigue = safe_float(webcam_signals.get("eyeFatigueScore") or webcam_signals.get("eye_fatigue_score"), 30.0)
        facial_tension = safe_float(webcam_signals.get("facialTensionScore") or webcam_signals.get("facial_tension_score"), 35.0)
        posture_slouch = safe_float(webcam_signals.get("postureSlouchScore") or webcam_signals.get("posture_slouch_score"), 30.0)
        restlessness = safe_float(webcam_signals.get("restlessnessScore") or webcam_signals.get("restlessness_score"), 25.0)

        if blink_rate < 8 or blink_rate > 28:
            blink_stress = min(100.0, abs(blink_rate - 18) * 4.5)
        else:
            blink_stress = 20.0

        visual_biometric_score = (
            0.25 * facial_tension +
            0.25 * eye_fatigue +
            0.20 * posture_slouch +
            0.15 * restlessness +
            0.15 * blink_stress
        )

        calibrated_score = round(0.70 * base_model_pct + 0.30 * visual_biometric_score)
    else:
        calibrated_score = round(base_model_pct)

    calibrated_score = int(max(0, min(100, calibrated_score)))

    if calibrated_score < 45:
        category = "LOW STRESS"
        welfare_status = "Optimal"
        risk_status = "LOW RISK"
    elif calibrated_score < 65:
        category = "NORMAL / MODERATE STRESS"
        welfare_status = "Stable"
        risk_status = "MODERATE RISK"
    elif calibrated_score < 80:
        category = "HIGH STRESS"
        welfare_status = "Attention Required"
        risk_status = "HIGH STRESS – ATTENTION REQUIRED"
    else:
        category = "CRITICAL / HIGH-RISK STRESS"
        welfare_status = "High-Risk Alert"
        risk_status = "HIGH-RISK WELFARE ALERT"

    recommendations = generate_recommendations(category)

    return calibrated_score, category, welfare_status, risk_status, recommendations


def generate_recommendations(category):
    """Generates personalized exercises, balanced diet, and preventive instructions."""
    common_warmups = [
        {
            "name": "Neck & Cervical Release",
            "icon": "🙆‍♂️",
            "duration": "45s",
            "reps": "5 Reps/Side",
            "instruction": "Slowly tilt ear toward shoulder, hold 5s, gently roll chin across chest to opposite shoulder.",
            "target": "Cervical spine, trapezius, and stiff neck muscles"
        },
        {
            "name": "Shoulder Shrugs & Scapular Squeeze",
            "icon": "🤸",
            "duration": "40s",
            "reps": "10 Smooth Rolls",
            "instruction": "Inhale deeply lifting shoulders toward ears, roll backwards and down, squeezing shoulder blades.",
            "target": "Reverses monitor hunching and upper back tightness"
        },
        {
            "name": "Seated Torso Spine Twist",
            "icon": "🧘",
            "duration": "60s",
            "reps": "3 Breaths/Side",
            "instruction": "Sit tall with feet flat. Place right hand on left knee, left hand behind chair, inhale and exhale gentle twist.",
            "target": "Thoracic spine mobility and lumbar decompression"
        },
        {
            "name": "20-20-20 Eye Strain Reset",
            "icon": "👁️",
            "duration": "30s",
            "reps": "Optical Relief",
            "instruction": "Look at an object 20 feet away for 20s, blink 10 times, rub palms until warm and softly cup over closed eyes.",
            "target": "Ciliary eye muscles and digital screen fatigue"
        },
        {
            "name": "Wrist & Forearm Flexor Extensor",
            "icon": "🤲",
            "duration": "30s",
            "reps": "2 Reps Each",
            "instruction": "Extend arm forward with palm facing out, gently pull fingers backward with other hand for 15s. Reverse palm down.",
            "target": "Carpal tunnel prevention and mouse wrist strain"
        },
        {
            "name": "4-7-8 Relaxation Breathing Pacer",
            "icon": "🫁",
            "duration": "60s",
            "reps": "4 Cycles",
            "instruction": "Inhale quietly through nose for 4s, hold breath for 7s, exhale slowly through mouth for 8s making a whoosh sound.",
            "target": "Vagus nerve activation and rapid autonomic nervous reset"
        }
    ]

    if category == "LOW STRESS":
        return {
            "exercises": [
                "Maintain current active and healthy routine.",
                "Engage in 20-30 minutes of light aerobic exercise (walking, cycling, or jogging).",
                "Take periodic 2-minute visual and physical stretch breaks during duty."
            ],
            "relaxation": [
                "Enjoy recreational hobbies or spend quality time with family/friends.",
                "Practice mindful evening relaxation to sustain restorative sleep."
            ],
            "diet": [
                "Maintain optimal hydration: 2.5–3 liters of clean water daily.",
                "Eat balanced meals rich in whole grains, colorful vegetables, and lean proteins.",
                "Incorporate healthy fats such as walnuts, seeds, or avocado for sustained cognitive clarity.",
                "Note: These are general wellness suggestions, not clinical dietary prescriptions."
            ],
            "preventive": "Your stress level is currently low. Continue your healthy routine, ergonomic posture, and regular physical activity.",
            "warmup_exercises": common_warmups
        }
    elif category == "NORMAL / MODERATE STRESS":
        return {
            "exercises": [
                "Follow the 30-Second Guided Box Breathing Exercise (Inhale 4s, Hold 4s, Exhale 4s, Hold 4s).",
                "Perform gentle cervical spine and shoulder rolls to release upper-back tension.",
                "Take a 10-15 minute brisk outdoor walk during your mid-day break.",
                "Ensure a consistent sleep schedule aiming for 7-8 hours per night."
            ],
            "relaxation": [
                "Brief 5-minute progressive muscle relaxation or calming audio.",
                "Scheduled screen-free micro-breaks every 60 minutes."
            ],
            "diet": [
                "Drink water regularly; mild dehydration increases stress hormones.",
                "Include magnesium-rich foods such as spinach, almonds, and bananas to ease muscle tension.",
                "Limit excessive caffeine (keep below 2 cups daily) and avoid energy drinks.",
                "Note: These are general wellness suggestions, not clinical dietary prescriptions."
            ],
            "preventive": "Your stress level is within a manageable range. Continue regular breaks, sleep, exercise, and healthy eating.",
            "warmup_exercises": common_warmups
        }
    elif category == "HIGH STRESS":
        return {
            "exercises": [
                "Guided 4-7-8 Breathing Technique to immediately modulate autonomic nervous arousal.",
                "Perform light postural stretching: chest openers, shoulder shrugs, and hamstring stretches.",
                "Take a compulsory 15-minute quiet walk away from all workstations and monitors.",
                "Implement strict work-rest pacing: 45 minutes focused duty followed by 10 minutes restorative pause."
            ],
            "relaxation": [
                "Practice 10-minute guided mindfulness or calming breath meditation.",
                "Consider confidential peer support or booking an informal welfare consultation."
            ],
            "diet": [
                "Prioritize warm herbal infusions (chamomile, peppermint) over caffeinated beverages.",
                "Consume complex carbohydrates (oats, brown rice, lentils) to support steady serotonin synthesis.",
                "Avoid skipping meals and minimize high-sugar snacks that cause glycemic crashes and anxiety.",
                "Note: These are general wellness suggestions, not clinical dietary prescriptions."
            ],
            "preventive": "Your stress level is elevated. Consider relaxation activities, adequate rest, exercise, and speaking with a trusted support person.",
            "warmup_exercises": common_warmups
        }
    else:  # CRITICAL / HIGH-RISK STRESS
        return {
            "exercises": [
                "PRIORITY: Discontinue high-intensity tasks and schedule immediate professional welfare counselling.",
                "Gentle diaphragmatic breathing only if comfortable; do not force strenuous exercise.",
                "Immediate ergonomic rest in a quiet, low-stimulation environment.",
                "Important: Physical exercise is supportive and must NOT be treated as a substitute for professional care."
            ],
            "relaxation": [
                "Urgent rest break authorized by institution guidelines.",
                "Connect with designated Aroghya Health Authority counsellor or clinical psychologist."
            ],
            "diet": [
                "Ensure steady, gentle hydration with water and electrolyte-balanced soups.",
                "Easily digestible, nutrient-dense foods (warm broths, fruits, steamed vegetables).",
                "Strictly avoid caffeine, nicotine, and high-sugar processed foods during acute stress periods.",
                "Note: These are general wellness suggestions, not clinical dietary prescriptions."
            ],
            "preventive": "Your stress indicators are persistently elevated. Please prioritize support and counselling and consider professional assistance immediately.",
            "warmup_exercises": common_warmups
        }


@app.route("/api/predict", methods=["POST"])
def api_predict():
    data = request.get_json() or {}
    employee_id = (data.get("employeeId") or data.get("employee_id") or "").strip()
    profile = data.get("profile") or {}
    questionnaire = data.get("questionnaire") or {}
    webcam_signals = data.get("webcamSignals") or data.get("webcam_signals") or {}

    if not employee_id or employee_id.lower() in ("undefined", "null", ""):
        return jsonify({"success": False, "message": "Valid Employee ID is required."}), 400

    # 1. Prepare exact features expected by existing trained AI model
    df_features = prepare_model_features(questionnaire, profile)

    # 2. Run existing trained AI Model
    if AI_MODEL is not None:
        try:
            raw_pred = AI_MODEL.predict(df_features)
            raw_model_score = float(raw_pred[0])
        except Exception as e:
            print(f"[PREDICTION ERROR] AI model predict failed: {e}")
            raw_model_score = 5.5
    else:
        raw_model_score = 5.5

    # 3. Apply Multi-modal Feature-Integration Layer
    calibrated_score, category, welfare_status, risk_status, recommendations = calculate_feature_integration(
        raw_model_score, webcam_signals
    )

    # 4. Save session to persistent SQLite database
    session_id = database.save_monitoring_session(
        employee_id=employee_id,
        raw_model_score=round(raw_model_score, 2),
        calibrated_stress_score=calibrated_score,
        stress_category=category,
        welfare_status=welfare_status,
        risk_status=risk_status,
        webcam_features=webcam_signals,
        questionnaire_data=questionnaire,
        recommendations=recommendations
    )

    return jsonify({
        "success": True,
        "sessionId": session_id,
        "calibratedScore": calibrated_score,
        "calibrated_stress_score": calibrated_score,
        "stressScore": calibrated_score,
        "category": category,
        "stress_category": category,
        "stressCategory": category,
        "welfareStatus": welfare_status,
        "welfare_status": welfare_status,
        "riskStatus": risk_status,
        "risk_status": risk_status,
        "rawModelScore": round(raw_model_score, 2),
        "raw_model_score": round(raw_model_score, 2),
        "recommendations": recommendations,
        "isHighRisk": calibrated_score >= 65
    })


# =====================================================
# EMPLOYEE DASHBOARD ENDPOINTS
# =====================================================

@app.route("/api/employee/dashboard/<employee_id>", methods=["GET"])
def api_employee_dashboard(employee_id):
    data = database.get_employee_dashboard_data(employee_id)
    return jsonify({"success": True, "data": data})


@app.route("/api/employee/history/<employee_id>", methods=["GET"])
def api_employee_history(employee_id):
    sessions = database.get_employee_sessions(employee_id, limit=30)
    return jsonify({"success": True, "sessions": sessions})


# =====================================================
# HIGHER AUTHORITY DASHBOARD ENDPOINTS
# =====================================================

@app.route("/api/authority/overview", methods=["GET"])
def api_authority_overview():
    overview = database.get_authority_overview()
    return jsonify({"success": True, "overview": overview})


@app.route("/api/authority/employees", methods=["GET"])
def api_authority_employees():
    employees = database.get_authority_employee_table()
    return jsonify({"success": True, "employees": employees})


@app.route("/api/authority/employee/<employee_id>", methods=["GET"])
def api_authority_employee_detail(employee_id):
    dashboard_data = database.get_employee_dashboard_data(employee_id)
    counselling = database.get_counselling_history(employee_id)
    return jsonify({
        "success": True,
        "dashboard": dashboard_data,
        "counselling": counselling
    })


@app.route("/api/authority/counselling", methods=["POST"])
def api_save_counselling():
    data = request.get_json() or {}
    employee_id = (data.get("employeeId") or data.get("employee_id") or "").strip()
    authority_id = (data.get("authorityId") or data.get("authority_id") or "Aroghya704").strip()
    notes = data.get("notes", "").strip()
    support_action = (data.get("supportAction") or data.get("support_action") or "").strip()
    follow_up_date = (data.get("followUpDate") or data.get("follow_up_date") or "").strip()
    status = data.get("status", "In Progress")

    if not employee_id or employee_id.lower() in ("undefined", "null", "") or not notes or not support_action:
        return jsonify({"success": False, "message": "Employee ID, Notes, and Support Action are required."}), 400

    rec_id = database.add_counselling_record(
        employee_id=employee_id,
        authority_id=authority_id,
        notes=notes,
        support_action=support_action,
        follow_up_date=follow_up_date,
        status=status
    )
    return jsonify({"success": True, "counsellingId": rec_id, "message": "Counselling record logged successfully."})


@app.route("/api/authority/counselling/<employee_id>", methods=["GET"])
def api_get_counselling(employee_id):
    records = database.get_counselling_history(employee_id)
    return jsonify({"success": True, "records": records})


# =====================================================
# SYSTEM HEALTH & STATUS
# =====================================================

@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({
        "status": "online",
        "system": "Aroghya AI Stress & Welfare Monitoring System",
        "modelLoaded": AI_MODEL is not None,
        "modelType": "RandomForestRegressor Pipeline (24 Features)"
    })


if __name__ == "__main__":
    print("[SERVER] Starting Aroghya System on http://127.0.0.1:5000 ...")
    app.run(host="0.0.0.0", port=5000, debug=False)
