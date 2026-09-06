"""
End-to-End Test and Verification Script for Aroghya System
Validates all requirements of Tasks 3, 4, and 5.
"""

import urllib.request
import urllib.parse
import json
import sqlite3
import os
import sys

BASE_URL = "http://127.0.0.1:5000"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aroghya.db")

def make_request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body)
    except urllib.error.HTTPError as e:
        res_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(res_body)
        except Exception:
            return e.code, {"error": res_body}
    except Exception as e:
        return 0, {"error": str(e)}

def run_tests():
    print("=" * 60)
    print("AROGHYA E2E VERIFICATION TEST SUITE")
    print("=" * 60)

    # 1. API Status Check
    status, body = make_request("/api/status")
    assert status == 200 and body.get("modelLoaded") is True, f"Status check failed: {body}"
    print("[PASS] 1. System Online & AI Model Loaded")

    # 2. Employee Authentication Tests
    # A. Login with Employee ID
    status, body = make_request("/api/auth/login", "POST", {
        "loginId": "pranaviR8",
        "password": "password123",
        "role": "employee"
    })
    assert status == 200 and body.get("success") is True, f"Login by ID failed: {body}"
    user = body.get("user")
    assert user.get("employeeId") == "pranaviR8", f"Missing employeeId in response: {user}"
    assert user.get("employee_id") == "pranaviR8", f"Missing employee_id in response: {user}"
    print("[PASS] 2A. Employee Login with Employee ID (Dual keys verified)")

    # B. Login with Email
    status, body = make_request("/api/auth/login", "POST", {
        "loginId": "pranavi@gmail.com",
        "password": "password123",
        "role": "employee"
    })
    assert status == 200 and body.get("success") is True, f"Login by email failed: {body}"
    print("[PASS] 2B. Employee Login with Email")

    # C. Login with incorrect password
    status, body = make_request("/api/auth/login", "POST", {
        "loginId": "pranaviR8",
        "password": "wrongpassword!",
        "role": "employee"
    })
    assert status == 401 and body.get("success") is False, f"Incorrect password check failed: {body}"
    print("[PASS] 2C. Correct rejection for invalid password (HTTP 401)")

    # 3. Monitoring Session Prediction & Persistence
    # Test submission with webcam telemetry and objective assessment (no self-stress, no smartwatch)
    webcam_payload = {
        "employeeId": "pranaviR8",
        "profile": {"name": "Zinka Pranavi", "employeeId": "pranaviR8"},
        "questionnaire": {
            "sleepQuality": 3,
            "dutyHours": 8.0,
            "mood": 4,
            "workload": 2,
            "energy": 70
        },
        "webcamSignals": {
            "blinkRate": 16,
            "eyeFatigueScore": 25,
            "facialTensionScore": 30,
            "headMovementScore": 20,
            "postureSlouchScore": 22,
            "restlessnessScore": 18
        }
    }

    status, pred_res = make_request("/api/predict", "POST", webcam_payload)
    assert status == 200 and pred_res.get("success") is True, f"Prediction API failed: {pred_res}"
    
    # Check that keys are returned without undefined
    assert "calibratedScore" in pred_res and "calibrated_stress_score" in pred_res
    assert "category" in pred_res and "stress_category" in pred_res
    assert "welfareStatus" in pred_res and "welfare_status" in pred_res
    assert "recommendations" in pred_res and pred_res["recommendations"] is not None
    session_id = pred_res.get("sessionId")
    assert session_id is not None, "Missing sessionId in prediction response"
    print(f"[PASS] 3. AI Prediction Inference & Multi-Modal Fusion (Session #{session_id}, Score: {pred_res['calibratedScore']}%)")

    # 4. Database Verification (Direct SQLite Check)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM monitoring_sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    assert row is not None, f"Session {session_id} not found in aroghya.db"
    
    d_row = dict(row)
    assert d_row["employee_id"] == "pranaviR8"
    assert d_row["calibrated_stress_score"] == pred_res["calibratedScore"]
    assert d_row["stress_category"] == pred_res["category"]
    assert d_row["welfare_status"] == pred_res["welfareStatus"]
    assert "undefined" not in str(d_row["webcam_features_json"]).lower(), "Literal 'undefined' found in DB!"
    assert "undefined" not in str(d_row["questionnaire_data_json"]).lower(), "Literal 'undefined' found in DB!"
    assert "undefined" not in str(d_row["recommendations_json"]).lower(), "Literal 'undefined' found in DB!"
    
    # Check recommendations JSON structure
    rec_data = json.loads(d_row["recommendations_json"])
    assert "exercises" in rec_data and len(rec_data["exercises"]) > 0
    assert "diet" in rec_data
    assert "preventive" in rec_data
    assert "warmup_exercises" in rec_data and len(rec_data["warmup_exercises"]) >= 6, "Warmup exercises missing from recommendations!"
    conn.close()
    print("[PASS] 4. Database Persistence Verification (Zero undefined strings, clean JSON, warmup exercises saved)")

    # 5. Employee Dashboard API Consistency
    status, dash_res = make_request("/api/employee/dashboard/pranaviR8")
    assert status == 200 and dash_res.get("success") is True, f"Dashboard fetch failed: {dash_res}"
    dash_data = dash_res.get("data", {})
    assert dash_data.get("latest") is not None, "Latest session missing from dashboard"
    assert dash_data["latest"]["calibratedScore"] == pred_res["calibratedScore"]
    assert dash_data["latest"]["calibrated_stress_score"] == pred_res["calibratedScore"]
    assert "user" in dash_data and dash_data["user"] is not None
    assert dash_data["user"]["name"] == "Zinka Pranavi"
    assert dash_data["user"]["employeeId"] == "pranaviR8"
    print("[PASS] 5. Employee Dashboard API Consistency (User profile, latest session, dual-key aliases)")

    # 6. Higher Authority Authentication & Restriction
    # 6A. Login with requested email arogya@gmail.com and password 123456
    status, auth_login_req = make_request("/api/auth/login", "POST", {
        "loginId": "arogya@gmail.com",
        "password": "123456",
        "role": "authority"
    })
    assert status == 200 and auth_login_req.get("success") is True, f"Authority login with arogya@gmail.com / 123456 failed: {auth_login_req}"
    assert auth_login_req["user"]["role"] == "authority"
    print("[PASS] 6A. Higher Authority Login with requested credentials (arogya@gmail.com / 123456)")

    # 6B. Login with Institution ID Aroghya704 and password 123456
    status, auth_login_id = make_request("/api/auth/login", "POST", {
        "loginId": "Aroghya704",
        "password": "123456",
        "role": "authority"
    })
    assert status == 200 and auth_login_id.get("success") is True, f"Authority login by ID failed: {auth_login_id}"
    print("[PASS] 6B. Higher Authority Login with Institution ID (Aroghya704 / 123456)")

    # 6C. Login with legacy credentials aroghya@gmail.com / Aroghya@2026
    status, auth_legacy = make_request("/api/auth/login", "POST", {
        "loginId": "aroghya@gmail.com",
        "password": "Aroghya@2026",
        "role": "authority"
    })
    assert status == 200 and auth_legacy.get("success") is True, f"Legacy authority login failed: {auth_legacy}"
    print("[PASS] 6C. Higher Authority Login with legacy credentials (aroghya@gmail.com / Aroghya@2026)")

    # 6D. Login with Arogya704 alias
    status, auth_alias = make_request("/api/auth/login", "POST", {
        "loginId": "Arogya704",
        "password": "123456",
        "role": "authority"
    })
    assert status == 200 and auth_alias.get("success") is True, f"Authority login with Arogya704 alias failed: {auth_alias}"
    print("[PASS] 6D. Higher Authority Login with Arogya704 alias")

    # 6E. Authority login with incorrect password
    status, auth_bad_pw = make_request("/api/auth/login", "POST", {
        "loginId": "arogya@gmail.com",
        "password": "WrongPassword999!",
        "role": "authority"
    })
    assert status == 401 and auth_bad_pw.get("success") is False, f"Invalid password not rejected: {auth_bad_pw}"
    print("[PASS] 6E. Higher Authority rejected on incorrect password (HTTP 401)")

    # 6F. Verify strictly ONE authority restriction (Reject duplicate registration)
    status, reg_auth = make_request("/api/auth/register-authority", "POST", {
        "institutionName": "Duplicate Hospital",
        "institutionEmail": "second_auth@example.com",
        "institutionId": "AUTH999",
        "password": "password123"
    })
    assert status == 400 and "already exists" in reg_auth.get("message", "").lower(), f"Duplicate authority not rejected: {reg_auth}"
    print("[PASS] 6F. Exactly ONE Higher Authority account restriction enforced (HTTP 400 rejection)")

    # 7. Higher Authority Dashboard Overview & Employee Table
    status, ov_res = make_request("/api/authority/overview")
    assert status == 200 and ov_res.get("success") is True
    ov = ov_res.get("overview", {})
    assert ov.get("total_employees", 0) > 0
    assert "workforce_labels" in ov and "workforce_scores" in ov
    print(f"[PASS] 7A. Authority Overview ({ov['total_employees']} registered employees, {ov.get('critical_count', 0)} critical)")

    status, emps_res = make_request("/api/authority/employees")
    assert status == 200 and emps_res.get("success") is True
    emp_list = emps_res.get("employees", [])
    assert len(emp_list) > 0
    for e in emp_list:
        assert "employeeId" in e and "employee_id" in e
        assert "calibratedScore" in e and "calibrated_stress_score" in e
    print(f"[PASS] 7B. Authority Employee Table ({len(emp_list)} employee records verified with dual keys)")

    # 8. Counselling & Support Logging Workflow
    counselling_payload = {
        "employeeId": "pranaviR8",
        "authorityId": "Aroghya704",
        "status": "In Progress",
        "supportAction": "Scheduled ergonomic workstation review and mindfulness coaching.",
        "notes": "Follow-up required after 3 days to assess impact of workload adjustments.",
        "followUpDate": "2026-09-09"
    }
    status, c_save_res = make_request("/api/authority/counselling", "POST", counselling_payload)
    assert status == 200 and c_save_res.get("success") is True, f"Counselling save failed: {c_save_res}"
    c_id = c_save_res.get("counsellingId")
    assert c_id is not None
    print(f"[PASS] 8A. Counselling Action Logged (Record #{c_id})")

    # Verify counselling record persistence and retrieval
    status, c_hist_res = make_request("/api/authority/counselling/pranaviR8")
    assert status == 200 and c_hist_res.get("success") is True
    records = c_hist_res.get("records", [])
    assert len(records) > 0
    assert records[0]["support_action"] == counselling_payload["supportAction"]
    assert records[0]["supportAction"] == counselling_payload["supportAction"]
    print(f"[PASS] 8B. Counselling Record Retrieved & Persisted (Confirmed in database)")

    # 9. Pure Webcam + Objective Assessment Verification & SQLite Persistence
    telemetry_payload = {
        "employeeId": "pranaviR8",
        "profile": {"name": "Zinka Pranavi", "employeeId": "pranaviR8"},
        "questionnaire": {"sleepQuality": 3, "dutyHours": 8.0, "mood": 4, "workload": 2, "energy": 70},
        "webcamSignals": {
            "blinkRate": 18,
            "eyeFatigueScore": 32,
            "facialTensionScore": 35,
            "headMovementScore": 22,
            "postureSlouchScore": 28,
            "restlessnessScore": 20
        }
    }
    status, t_pred = make_request("/api/predict", "POST", telemetry_payload)
    assert status == 200 and t_pred.get("success") is True, f"Telemetry prediction failed: {t_pred}"
    assert "smartwatch" not in t_pred, "smartwatch key should not be present in prediction response"
    assert "calibratedScore" in t_pred
    assert "category" in t_pred
    t_session_id = t_pred["sessionId"]

    # Verify persistence in SQLite
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT questionnaire_data_json, webcam_features_json FROM monitoring_sessions WHERE id = ?", (t_session_id,))
    t_row = c.fetchone()
    assert t_row is not None
    q_json = json.loads(t_row["questionnaire_data_json"])
    assert "smartwatch" not in q_json, "smartwatch should not be in questionnaire_data_json"
    assert q_json["workload"] == 2
    assert q_json["energy"] == 70

    # Verify employee dashboard retrieves the latest data
    status, d_check = make_request("/api/employee/dashboard/pranaviR8")
    assert status == 200 and d_check.get("success") is True
    latest_sess = d_check["data"]["latest"]
    assert latest_sess is not None
    assert "calibratedScore" in latest_sess or "calibrated_stress_score" in latest_sess

    # Verify Database Integrity
    # Exactly ONE authority
    c.execute("SELECT COUNT(*) FROM users WHERE role = 'authority'")
    auth_count = c.fetchone()[0]
    assert auth_count == 1, f"Expected exactly 1 authority, found {auth_count}"

    # Verify authority record credentials
    c.execute("SELECT employee_id, email, password_hash, role FROM users WHERE role = 'authority'")
    auth_user = c.fetchone()
    assert auth_user["employee_id"] in ("Aroghya704", "Arogya704")
    assert auth_user["email"] in ("arogya@gmail.com", "aroghya@gmail.com")

    # Employee accounts preserved
    c.execute("SELECT COUNT(*) FROM users WHERE role = 'employee'")
    emp_count = c.fetchone()[0]
    assert emp_count > 0, f"Expected employees, found {emp_count}"

    # Monitoring sessions preserved
    c.execute("SELECT COUNT(*) FROM monitoring_sessions")
    session_count = c.fetchone()[0]
    assert session_count > 0, "No monitoring sessions found"

    # Counselling records preserved
    c.execute("SELECT COUNT(*) FROM counselling_records")
    c_count = c.fetchone()[0]
    assert c_count > 0, "No counselling records found"

    # Zero undefined in DB
    for table, col in [
        ("monitoring_sessions", "webcam_features_json"),
        ("monitoring_sessions", "questionnaire_data_json"),
        ("monitoring_sessions", "recommendations_json"),
        ("users", "email"),
        ("users", "employee_id"),
        ("users", "name")
    ]:
        c.execute(f"SELECT COUNT(*) FROM {table} WHERE {col} LIKE '%undefined%'")
        undef_count = c.fetchone()[0]
        assert undef_count == 0, f"Found {undef_count} 'undefined' occurrences in {table}.{col}"

    conn.close()
    print("[PASS] 9. Pure Webcam + Objective Telemetry & SQLite Persistence (Integrity verified, zero undefined)")

    # 10. Robustness Against Null/Empty Sensor Inputs
    sparse_payload = {
        "employeeId": "pranaviR8",
        "profile": {},
        "questionnaire": {},
        "webcamSignals": None
    }
    status, sparse_res = make_request("/api/predict", "POST", sparse_payload)
    assert status == 200 and sparse_res.get("success") is True, f"Sparse payload failed: {sparse_res}"
    print("[PASS] 10. Robustness Against Null/Empty Sensor Inputs (Safe fallbacks active)")

    print("=" * 60)
    print("ALL 12 VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
