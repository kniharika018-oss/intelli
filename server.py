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
    employee_id = data.get("employeeId", "").strip()
    password = data.get("password", "")

    if not name or not email or not employee_id or not password:
        return jsonify({"success": False, "message": "All fields are required."}), 400

    result = database.register_employee(name, email, employee_id, password)
    status_code = 200 if result["success"] else 400
    return jsonify(result), status_code


@app.route("/api/auth/register-authority", methods=["POST"])
def api_register_authority():
    data = request.get_json() or {}
    institution_name = data.get("institutionName", "").strip()
    email = data.get("institutionEmail", "").strip()
    institution_id = data.get("institutionId", "").strip()
    password = data.get("password", "")

    if not institution_name or not email or not institution_id or not password:
        return jsonify({"success": False, "message": "All fields are required."}), 400

    result = database.register_authority(institution_name, email, institution_id, password)
    status_code = 200 if result["success"] else 400
    return jsonify(result), status_code


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    login_id = data.get("loginId", "").strip()
    password = data.get("password", "")
    role = data.get("role", "employee")

    if not login_id or not password:
        return jsonify({"success": False, "message": "Email/ID and Password are required."}), 400

    result = database.authenticate_user(login_id, password, expected_role=role)
    status_code = 200 if result["success"] else 401
    return jsonify(result), status_code


# =====================================================
# AI PREDICTION & FEATURE-INTEGRATION PIPELINE
# =====================================================

def prepare_model_features(questionnaire, smartwatch, profile):
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
    # 1. Questionnaire inputs
    sleep_quality = float(questionnaire.get("sleepQuality", 3))   # 1 to 4
    duty_hours = float(questionnaire.get("dutyHours", 8.0))       # 0 to 24
    mood = float(questionnaire.get("mood", 3))                     # 1 to 5
    energy = float(questionnaire.get("energy", 50))                # 0 to 100
    workload = float(questionnaire.get("workload", 2))             # 1 to 4
    self_stress = float(questionnaire.get("selfStress", 30))       # 0 to 100

    # 2. Smartwatch inputs if present
    if smartwatch:
        sleep_hours = float(smartwatch.get("sleepHours", 7.0))
        steps = float(smartwatch.get("steps", 6000))
        # Map steps to physical activity days (0 to 7)
        physical_activity_days = min(7, int(steps / 2500))
        heart_rate = float(smartwatch.get("heartRate", 75))
    else:
        # Infer sleep hours from sleep quality: 1->4.5h, 2->6.0h, 3->7.5h, 4->8.5h
        sleep_hours_map = {1: 4.5, 2: 6.0, 3: 7.5, 4: 8.5}
        sleep_hours = sleep_hours_map.get(int(sleep_quality), 7.0)
        physical_activity_days = 3
        heart_rate = 72.0

    # 3. Workload & schedule conversions
    work_hours_per_week = float(duty_hours * 5.0)
    overtime_hours = float(max(0.0, (duty_hours - 8.0) * 5.0))
    meetings_per_day = float(min(8.0, max(1.0, workload * 1.5)))
    deadlines_missed = int(max(0, int((workload - 2) * 1.2)))

    # 4. Psychological & welfare proxy scores (1.0 to 10.0 scale)
    job_satisfaction = float(round((mood / 5.0) * 10.0, 1))
    manager_support = 6.0
    # Work life balance: high hours and poor sleep reduce balance
    work_life_balance = float(round(max(1.0, 10.0 - (duty_hours - 6.0) - (4.0 - sleep_quality) * 1.5), 1))
    screen_time_hours = float(round(duty_hours * 0.9, 1))
    caffeine_intake = 2
    social_support_score = float(round(mood * 1.6, 1))
    has_therapy = 0

    # Anxiety and depression derived from self-stress and energy
    anxiety_score = float(round(min(10.0, max(1.0, (self_stress / 10.0))), 1))
    depression_score = float(round(min(10.0, max(1.0, ((100.0 - energy) / 10.0))), 1))
    burnout_score = float(round(min(10.0, max(1.0, (self_stress * 0.05 + workload * 1.25))), 1))

    if burnout_score < 4.0:
        burnout_level = "Low"
    elif burnout_score < 7.0:
        burnout_level = "Moderate"
    else:
        burnout_level = "High"

    seeks_professional_help = 1 if (self_stress >= 75.0 or anxiety_score >= 8.0) else 0

    # Demographic defaults
    age = 30
    gender = "Female" if "pranavi" in profile.get("name", "").lower() else "Male"
    job_role = "Backend Developer"
    experience_years = 4.5
    company_size = "Mid-size"
    work_mode = "Hybrid"

    # Assemble dictionary with exact feature names
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
    # Base model score mapped from 1.0-10.0 to 10%-100%
    base_model_pct = (raw_model_score / 10.0) * 100.0

    if webcam_signals:
        blink_rate = float(webcam_signals.get("blinkRate", 16))
        eye_fatigue = float(webcam_signals.get("eyeFatigueScore", 30))
        facial_tension = float(webcam_signals.get("facialTensionScore", 35))
        posture_slouch = float(webcam_signals.get("postureSlouchScore", 30))
        restlessness = float(webcam_signals.get("restlessnessScore", 25))

        # Blink stress calculation: normal is 12-22 bpm; elevated (>28) or strained (<8) indicates stress
        if blink_rate < 8 or blink_rate > 28:
            blink_stress = min(100.0, abs(blink_rate - 18) * 4.5)
        else:
            blink_stress = 20.0

        # Weighted visual stress biometric index
        visual_biometric_score = (
            0.25 * facial_tension +
            0.25 * eye_fatigue +
            0.20 * posture_slouch +
            0.15 * restlessness +
            0.15 * blink_stress
        )

        # Multi-modal fusion: 70% Trained AI Model + 30% Real-time Visual Signals
        calibrated_score = round(0.70 * base_model_pct + 0.30 * visual_biometric_score)
    else:
        # Fallback if webcam was not engaged
        calibrated_score = round(base_model_pct)

    # Secure clamp between 0 and 100
    calibrated_score = int(max(0, min(100, calibrated_score)))

    # Determine Stress Category
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

    # Generate Dynamic Recommendations
    recommendations = generate_recommendations(category)

    return calibrated_score, category, welfare_status, risk_status, recommendations


def generate_recommendations(category):
    """Generates personalized exercises, balanced diet, and preventive instructions."""
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
            "preventive": "Your stress level is currently low. Continue your healthy routine, ergonomic posture, and regular physical activity."
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
            "preventive": "Your stress level is within a manageable range. Continue regular breaks, sleep, exercise, and healthy eating."
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
            "preventive": "Your stress level is elevated. Consider relaxation activities, adequate rest, exercise, and speaking with a trusted support person."
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
            "preventive": "Your stress indicators are persistently elevated. Please prioritize support and counselling and consider professional assistance immediately."
        }


@app.route("/api/predict", methods=["POST"])
def api_predict():
    data = request.get_json() or {}
    employee_id = data.get("employeeId", "").strip()
    profile = data.get("profile", {})
    questionnaire = data.get("questionnaire", {})
    smartwatch = data.get("smartwatch")
    webcam_signals = data.get("webcamSignals")

    if not employee_id:
        return jsonify({"success": False, "message": "Employee ID is required."}), 400

    # 1. Prepare exact features expected by existing trained AI model
    df_features = prepare_model_features(questionnaire, smartwatch, profile)

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
        "category": category,
        "welfareStatus": welfare_status,
        "riskStatus": risk_status,
        "rawModelScore": round(raw_model_score, 2),
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
    employee_id = data.get("employeeId", "").strip()
    authority_id = data.get("authorityId", "Aroghya704").strip()
    notes = data.get("notes", "").strip()
    support_action = data.get("supportAction", "").strip()
    follow_up_date = data.get("followUpDate", "")
    status = data.get("status", "In Progress")

    if not employee_id or not notes or not support_action:
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
