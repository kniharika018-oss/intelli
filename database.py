"""
Aroghya Database Layer
SQLite persistent storage for employee & authority accounts, monitoring sessions,
webcam telemetry, stress predictions, counselling records, and welfare tracking.
"""

import sqlite3
import json
import os
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aroghya.db")


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


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users table (employees and higher authority)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            employee_id TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('employee', 'authority')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Authority configuration: strictly enforces only ONE higher authority account
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS authority_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            user_id INTEGER UNIQUE NOT NULL,
            institution_name TEXT NOT NULL,
            institution_id TEXT UNIQUE NOT NULL,
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # 3. Monitoring sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS monitoring_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            raw_model_score REAL NOT NULL,
            calibrated_stress_score INTEGER NOT NULL,
            stress_category TEXT NOT NULL,
            welfare_status TEXT NOT NULL,
            risk_status TEXT NOT NULL,
            webcam_features_json TEXT,
            questionnaire_data_json TEXT,
            recommendations_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE
        )
    """)

    # 4. Counselling and support records
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS counselling_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            authority_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed')),
            notes TEXT NOT NULL,
            support_action TEXT NOT NULL,
            follow_up_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES users(employee_id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()

    # Always strictly guarantee exactly ONE Higher Authority account exists and is valid
    ensure_authority_account()

    # Seed demo data if fresh
    seed_demo_data()


def ensure_authority_account():
    """
    Strictly guarantees that exactly ONE Higher Authority account exists in the database.
    Credentials enforced:
      Institution ID: Aroghya704 (also accepts Arogya704)
      Email: arogya@gmail.com (also accepts aroghya@gmail.com)
      Password: 123456 (also accepts Aroghya@2026)
    Self-heals or initializes without touching employee accounts, monitoring history, or counselling records.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Find existing authority record by employee_id, email, or role
    cursor.execute("""
        SELECT id, name, email, employee_id, password_hash, role
        FROM users
        WHERE employee_id IN ('Aroghya704', 'Arogya704') 
           OR LOWER(email) IN ('arogya@gmail.com', 'aroghya@gmail.com') 
           OR role = 'authority'
        ORDER BY id ASC
    """)
    auth_rows = cursor.fetchall()
    auth_pass = generate_password_hash("123456")

    if not auth_rows:
        # Create single authority account
        cursor.execute(
            "INSERT INTO users (name, email, employee_id, password_hash, role) VALUES (?, ?, ?, ?, 'authority')",
            ("Aroghya Health Authority", "arogya@gmail.com", "Aroghya704", auth_pass)
        )
        auth_user_id = cursor.lastrowid
        cursor.execute(
            "INSERT OR REPLACE INTO authority_config (id, user_id, institution_name, institution_id) VALUES (1, ?, ?, ?)",
            (auth_user_id, "Aroghya Health Authority", "Aroghya704")
        )
    else:
        # Primary authority record
        primary = dict(auth_rows[0])
        auth_user_id = primary["id"]

        # If duplicate authority rows exist, remove extra authority accounts (never delete employees!)
        if len(auth_rows) > 1:
            for extra in auth_rows[1:]:
                cursor.execute("DELETE FROM users WHERE id = ? AND role = 'authority'", (extra["id"],))

        # Check if password or fields need repair
        needs_update = (
            primary.get("employee_id") not in ("Aroghya704", "Arogya704") or
            primary.get("email") not in ("arogya@gmail.com", "aroghya@gmail.com") or
            primary.get("role") != "authority" or
            not check_password_hash(primary.get("password_hash", ""), "123456")
        )

        if needs_update:
            cursor.execute("""
                UPDATE users
                SET name = 'Aroghya Health Authority',
                    email = 'arogya@gmail.com',
                    employee_id = 'Aroghya704',
                    password_hash = ?,
                    role = 'authority'
                WHERE id = ?
            """, (auth_pass, auth_user_id))

        # Ensure authority_config (id=1) links to this user_id
        cursor.execute(
            "INSERT OR REPLACE INTO authority_config (id, user_id, institution_name, institution_id) VALUES (1, ?, ?, ?)",
            (auth_user_id, "Aroghya Health Authority", "Aroghya704")
        )

    conn.commit()
    conn.close()


def register_employee(name, email, employee_id, password):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check duplicate
    cursor.execute(
        "SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(employee_id) = LOWER(?)",
        (email.strip(), employee_id.strip())
    )
    if cursor.fetchone():
        conn.close()
        return {"success": False, "message": "An account with this Email or Employee ID already exists. Please Sign In."}

    password_hash = generate_password_hash(password)
    try:
        cursor.execute(
            "INSERT INTO users (name, email, employee_id, password_hash, role) VALUES (?, ?, ?, ?, 'employee')",
            (name.strip(), email.strip().lower(), employee_id.strip(), password_hash)
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "Employee registered successfully."}
    except Exception as e:
        conn.close()
        return {"success": False, "message": f"Registration failed: {str(e)}"}


def register_authority(institution_name, email, institution_id, password):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Requirement 2: There should be only ONE authorized higher-authority account
    cursor.execute("SELECT id FROM authority_config WHERE id = 1")
    if cursor.fetchone():
        conn.close()
        return {
            "success": False,
            "message": "Registration restricted: An authorized Higher Authority account already exists for this system. Please Sign In."
        }

    # Check duplicate email/ID in users
    cursor.execute(
        "SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(employee_id) = LOWER(?)",
        (email.strip(), institution_id.strip())
    )
    if cursor.fetchone():
        conn.close()
        return {"success": False, "message": "An account with this Email or Institution ID already exists."}

    password_hash = generate_password_hash(password)
    try:
        cursor.execute(
            "INSERT INTO users (name, email, employee_id, password_hash, role) VALUES (?, ?, ?, ?, 'authority')",
            (institution_name.strip(), email.strip().lower(), institution_id.strip(), password_hash)
        )
        user_id = cursor.lastrowid

        cursor.execute(
            "INSERT INTO authority_config (id, user_id, institution_name, institution_id) VALUES (1, ?, ?, ?)",
            (user_id, institution_name.strip(), institution_id.strip())
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "Higher Authority registered successfully."}
    except Exception as e:
        conn.close()
        return {"success": False, "message": f"Authority registration failed: {str(e)}"}


def authenticate_user(login_id, password, expected_role=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    clean_id = login_id.strip()
    clean_id_lower = clean_id.lower()

    # Authority aliases: both arogya and aroghya, both 704 IDs
    authority_aliases = {"arogya@gmail.com", "aroghya@gmail.com", "aroghya704", "arogya704"}

    if (expected_role == "authority") or (clean_id_lower in authority_aliases):
        cursor.execute("SELECT id, name, email, employee_id, password_hash, role FROM users WHERE role = 'authority' LIMIT 1")
        row = cursor.fetchone()
        if not row:
            query = """
                SELECT id, name, email, employee_id, password_hash, role
                FROM users
                WHERE LOWER(email) = LOWER(?) OR LOWER(employee_id) = LOWER(?)
            """
            cursor.execute(query, (clean_id, clean_id))
            row = cursor.fetchone()
        conn.close()

        if not row:
            return {"success": False, "message": "Account not found. Please check your credentials or register."}

        user = dict(row)
        # Check password against stored hash, or dual-support 123456 and Aroghya@2026
        valid_password = (
            check_password_hash(user["password_hash"], password) or 
            password in ("123456", "Aroghya@2026")
        )
        if not valid_password:
            return {"success": False, "message": "Incorrect password. Please try again."}

        if expected_role and user["role"] != expected_role:
            return {
                "success": False,
                "message": f"Access denied. Please log in through the {user['role'].capitalize()} portal."
            }

        user.pop("password_hash")
        user["employeeId"] = user["employee_id"]
        return {"success": True, "user": user}

    # Standard authentication for employees
    query = """
        SELECT id, name, email, employee_id, password_hash, role
        FROM users
        WHERE LOWER(email) = LOWER(?) OR LOWER(employee_id) = LOWER(?)
    """
    cursor.execute(query, (clean_id, clean_id))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"success": False, "message": "Account not found. Please check your credentials or register."}

    user = dict(row)
    if not check_password_hash(user["password_hash"], password):
        return {"success": False, "message": "Incorrect password. Please try again."}

    if expected_role and user["role"] != expected_role:
        return {
            "success": False,
            "message": f"Access denied. Please log in through the {user['role'].capitalize()} portal."
        }

    user.pop("password_hash")
    user["employeeId"] = user["employee_id"]
    return {"success": True, "user": user}


def save_monitoring_session(employee_id, raw_model_score, calibrated_stress_score,
                           stress_category, welfare_status, risk_status,
                           webcam_features, questionnaire_data, recommendations):
    if not employee_id or str(employee_id).strip().lower() in ("undefined", "null", ""):
        raise ValueError("Invalid employee_id: cannot save session for undefined or empty employee_id")

    calibrated_stress_score = safe_int(calibrated_stress_score, 50)
    raw_model_score = safe_float(raw_model_score, 5.5)

    if not stress_category or str(stress_category).strip().lower() in ("undefined", "null", ""):
        if calibrated_stress_score < 45:
            stress_category = "LOW STRESS"
        elif calibrated_stress_score < 65:
            stress_category = "NORMAL / MODERATE STRESS"
        elif calibrated_stress_score < 80:
            stress_category = "HIGH STRESS"
        else:
            stress_category = "CRITICAL / HIGH-RISK STRESS"

    if not welfare_status or str(welfare_status).strip().lower() in ("undefined", "null", ""):
        if calibrated_stress_score < 45:
            welfare_status = "Optimal"
        elif calibrated_stress_score < 65:
            welfare_status = "Stable"
        elif calibrated_stress_score < 80:
            welfare_status = "Attention Required"
        else:
            welfare_status = "High-Risk Alert"

    if not risk_status or str(risk_status).strip().lower() in ("undefined", "null", ""):
        if calibrated_stress_score < 45:
            risk_status = "LOW RISK"
        elif calibrated_stress_score < 65:
            risk_status = "MODERATE RISK"
        elif calibrated_stress_score < 80:
            risk_status = "HIGH STRESS – ATTENTION REQUIRED"
        else:
            risk_status = "HIGH-RISK WELFARE ALERT"

    conn = get_db_connection()
    cursor = conn.cursor()

    now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO monitoring_sessions (
            employee_id, raw_model_score, calibrated_stress_score,
            stress_category, welfare_status, risk_status,
            webcam_features_json, questionnaire_data_json, recommendations_json,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(employee_id).strip(),
        raw_model_score,
        calibrated_stress_score,
        stress_category,
        welfare_status,
        risk_status,
        json.dumps(webcam_features) if webcam_features else None,
        json.dumps(questionnaire_data) if questionnaire_data else None,
        json.dumps(recommendations) if recommendations else None,
        now_ts
    ))

    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return session_id


def get_employee_sessions(employee_id, limit=20):
    if not employee_id or str(employee_id).strip().lower() in ("undefined", "null", ""):
        return []

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, employee_id, raw_model_score, calibrated_stress_score,
               stress_category, welfare_status, risk_status,
               webcam_features_json, questionnaire_data_json, recommendations_json,
               created_at
        FROM monitoring_sessions
        WHERE employee_id = ?
        ORDER BY id DESC
        LIMIT ?
    """, (str(employee_id).strip(), limit))

    rows = cursor.fetchall()
    conn.close()

    sessions = []
    for r in rows:
        d = dict(r)
        d["webcam_features"] = json.loads(d["webcam_features_json"]) if d["webcam_features_json"] else {}
        d["questionnaire_data"] = json.loads(d["questionnaire_data_json"]) if d["questionnaire_data_json"] else {}
        d["recommendations"] = json.loads(d["recommendations_json"]) if d["recommendations_json"] else {}

        # Provide dual snake_case and camelCase aliases to avoid undefined errors
        d["calibratedScore"] = d["calibrated_stress_score"]
        d["stressScore"] = d["calibrated_stress_score"]
        d["category"] = d["stress_category"]
        d["stressCategory"] = d["stress_category"]
        d["welfareStatus"] = d["welfare_status"]
        d["riskStatus"] = d["risk_status"]
        d["rawModelScore"] = d["raw_model_score"]
        d["createdAt"] = d["created_at"]
        d["employeeId"] = d["employee_id"]
        sessions.append(d)
    return sessions


def get_employee_dashboard_data(employee_id):
    if not employee_id or str(employee_id).strip().lower() in ("undefined", "null", ""):
        return {
            "latest": None,
            "previous_score": None,
            "previousScore": None,
            "trend": "STABLE",
            "high_stress_events": 0,
            "highStressEvents": 0,
            "total_sessions": 0,
            "totalSessions": 0,
            "weekly_labels": [],
            "weeklyLabels": [],
            "weekly_scores": [],
            "weeklyScores": [],
            "all_sessions": [],
            "allSessions": [],
            "user": None
        }

    clean_emp_id = str(employee_id).strip()

    # Query employee profile
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, employee_id, role, created_at FROM users WHERE employee_id = ?", (clean_emp_id,))
    u_row = cursor.fetchone()
    conn.close()

    user_info = dict(u_row) if u_row else None
    if user_info:
        user_info["employeeId"] = user_info["employee_id"]

    sessions = get_employee_sessions(clean_emp_id, limit=14)
    latest = sessions[0] if sessions else None

    # Trend calculation
    trend = "STABLE"
    prev_score = None
    if len(sessions) > 1 and latest:
        prev_score = sessions[1]["calibrated_stress_score"]
        diff = latest["calibrated_stress_score"] - prev_score
        if diff >= 5:
            trend = "INCREASING (Worsening)"
        elif diff <= -5:
            trend = "DECREASING (Improving)"
        else:
            trend = "STABLE"

    # Count high stress events in history
    high_stress_events = sum(
        1 for s in sessions if s["calibrated_stress_score"] >= 65
    )

    # Weekly history array (last 7 data points)
    recent_chronological = list(reversed(sessions[:7]))
    weekly_labels = []
    weekly_scores = []
    for s in recent_chronological:
        created_str = str(s.get("created_at") or "")
        try:
            dt = datetime.strptime(created_str, "%Y-%m-%d %H:%M:%S")
            lbl = dt.strftime("%b %d, %H:%M")
        except Exception:
            try:
                dt = datetime.fromisoformat(created_str)
                lbl = dt.strftime("%b %d, %H:%M")
            except Exception:
                lbl = created_str.split(" ")[0] if " " in created_str else created_str
        weekly_labels.append(lbl)
        weekly_scores.append(s["calibrated_stress_score"])

    return {
        "latest": latest,
        "previous_score": prev_score,
        "previousScore": prev_score,
        "trend": trend,
        "high_stress_events": high_stress_events,
        "highStressEvents": high_stress_events,
        "total_sessions": len(sessions),
        "totalSessions": len(sessions),
        "weekly_labels": weekly_labels,
        "weeklyLabels": weekly_labels,
        "weekly_scores": weekly_scores,
        "weeklyScores": weekly_scores,
        "all_sessions": sessions,
        "allSessions": sessions,
        "user": user_info
    }


def get_authority_overview():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Total registered employees
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'employee'")
    total_employees = cursor.fetchone()["count"]

    # Latest session for each employee
    cursor.execute("""
        SELECT u.employee_id, u.name, u.email,
               m.calibrated_stress_score, m.stress_category, m.risk_status,
               m.created_at
        FROM users u
        LEFT JOIN (
            SELECT employee_id, calibrated_stress_score, stress_category, risk_status, created_at,
                   ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY created_at DESC) as rn
            FROM monitoring_sessions
        ) m ON u.employee_id = m.employee_id AND m.rn = 1
        WHERE u.role = 'employee'
    """)
    records = [dict(r) for r in cursor.fetchall()]

    low_count = 0
    normal_count = 0
    high_count = 0
    critical_count = 0

    for r in records:
        score = r["calibrated_stress_score"]
        if score is None:
            continue
        if score < 45:
            low_count += 1
        elif score < 65:
            normal_count += 1
        elif score < 80:
            high_count += 1
        else:
            critical_count += 1

    # Active counselling records
    cursor.execute("SELECT COUNT(*) as count FROM counselling_records WHERE status != 'Completed'")
    pending_counselling = cursor.fetchone()["count"]

    # High-risk employees requiring immediate attention
    attention_required = high_count + critical_count

    # Historical average stress per day for workforce chart
    cursor.execute("""
        SELECT DATE(created_at) as session_date,
               AVG(calibrated_stress_score) as avg_score,
               COUNT(*) as session_count
        FROM monitoring_sessions
        GROUP BY DATE(created_at)
        ORDER BY session_date DESC
        LIMIT 7
    """)
    workforce_trend_rows = cursor.fetchall()
    conn.close()

    trend_labels = []
    trend_averages = []
    for r in reversed(workforce_trend_rows):
        trend_labels.append(r["session_date"])
        trend_averages.append(round(r["avg_score"], 1))

    return {
        "total_employees": total_employees,
        "low_count": low_count,
        "normal_count": normal_count,
        "high_count": high_count,
        "critical_count": critical_count,
        "attention_required": attention_required,
        "pending_counselling": pending_counselling,
        "workforce_labels": trend_labels,
        "workforce_scores": trend_averages
    }


def get_authority_employee_table():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT u.employee_id, u.name, u.email,
               m.calibrated_stress_score, m.stress_category, m.risk_status,
               m.created_at as last_monitored
        FROM users u
        LEFT JOIN (
            SELECT employee_id, calibrated_stress_score, stress_category, risk_status, created_at,
                   ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY created_at DESC) as rn
            FROM monitoring_sessions
        ) m ON u.employee_id = m.employee_id AND m.rn = 1
        WHERE u.role = 'employee'
        ORDER BY
            CASE
                WHEN m.calibrated_stress_score >= 80 THEN 1
                WHEN m.calibrated_stress_score >= 65 THEN 2
                WHEN m.calibrated_stress_score IS NOT NULL THEN 3
                ELSE 4
            END,
            m.calibrated_stress_score DESC
    """)
    employees = [dict(r) for r in cursor.fetchall()]

    # Fetch counselling status for each
    for emp in employees:
        emp["employeeId"] = emp["employee_id"]
        emp["calibratedScore"] = emp["calibrated_stress_score"]
        emp["stressCategory"] = emp["stress_category"]
        emp["riskStatus"] = emp["risk_status"]

        cursor.execute("""
            SELECT status, follow_up_date, notes, support_action
            FROM counselling_records
            WHERE employee_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        """, (emp["employee_id"],))
        c_row = cursor.fetchone()
        if c_row:
            c_dict = dict(c_row)
            c_dict["followUpDate"] = c_dict["follow_up_date"]
            c_dict["supportAction"] = c_dict["support_action"]
            emp["counselling"] = c_dict
        else:
            emp["counselling"] = None

        # Calculate trend
        cursor.execute("""
            SELECT calibrated_stress_score
            FROM monitoring_sessions
            WHERE employee_id = ?
            ORDER BY created_at DESC
            LIMIT 2
        """, (emp["employee_id"],))
        score_rows = cursor.fetchall()
        if len(score_rows) >= 2:
            curr = score_rows[0]["calibrated_stress_score"]
            prev = score_rows[1]["calibrated_stress_score"]
            diff = curr - prev
            if diff >= 5:
                emp["trend"] = "Increasing ↗"
            elif diff <= -5:
                emp["trend"] = "Decreasing ↘"
            else:
                emp["trend"] = "Stable →"
        elif len(score_rows) == 1:
            emp["trend"] = "Baseline"
        else:
            emp["trend"] = "No Data"

    conn.close()
    return employees


def add_counselling_record(employee_id, authority_id, notes, support_action, follow_up_date, status="In Progress"):
    if not employee_id or str(employee_id).strip().lower() in ("undefined", "null", ""):
        raise ValueError("Invalid employee_id: cannot save counselling record for undefined or empty employee_id")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO counselling_records (
            employee_id, authority_id, status, notes, support_action, follow_up_date
        ) VALUES (?, ?, ?, ?, ?, ?)
    """, (str(employee_id).strip(), str(authority_id).strip(), status, notes.strip(), support_action.strip(), follow_up_date))

    rec_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return rec_id


def get_counselling_history(employee_id):
    if not employee_id or str(employee_id).strip().lower() in ("undefined", "null", ""):
        return []

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, employee_id, authority_id, status, notes, support_action,
               follow_up_date, created_at, updated_at
        FROM counselling_records
        WHERE employee_id = ?
        ORDER BY created_at DESC
    """, (str(employee_id).strip(),))

    records = []
    for r in cursor.fetchall():
        d = dict(r)
        d["employeeId"] = d["employee_id"]
        d["authorityId"] = d["authority_id"]
        d["supportAction"] = d["support_action"]
        d["followUpDate"] = d["follow_up_date"]
        d["createdAt"] = d["created_at"]
        records.append(d)

    conn.close()
    return records


def seed_demo_data():
    """Seeds default authority and sample employees if database is brand new."""
    ensure_authority_account()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'employee'")
    if cursor.fetchone()["count"] > 0:
        conn.close()
        return

    print("[DB] Seeding demo employees and baseline monitoring...")

    # Demo Employees with realistic stress profiles
    demo_employees = [
        ("Zinka Pranavi", "pranavi@gmail.com", "pranaviR8", "password123"),
        ("Rahul Sharma", "rahul.s@aroghya.org", "EMP102", "password123"),
        ("Ananya Patel", "ananya.p@aroghya.org", "EMP103", "password123"),
        ("Vikram Singh", "vikram.s@aroghya.org", "EMP104", "password123"),
        ("Neha Deshmukh", "neha.d@aroghya.org", "EMP105", "password123")
    ]

    for name, email, emp_id, pwd in demo_employees:
        pwd_hash = generate_password_hash(pwd)
        cursor.execute(
            "INSERT INTO users (name, email, employee_id, password_hash, role) VALUES (?, ?, ?, ?, 'employee')",
            (name, email, emp_id, pwd_hash)
        )

    # Seed baseline monitoring sessions over past days
    sample_sessions = [
        # (emp_id, days_ago, score, cat, status, risk)
        ("pranaviR8", 4, 38, "LOW STRESS", "Optimal", "LOW RISK"),
        ("pranaviR8", 3, 44, "LOW STRESS", "Optimal", "LOW RISK"),
        ("pranaviR8", 2, 52, "NORMAL / MODERATE STRESS", "Stable", "MODERATE RISK"),
        ("pranaviR8", 1, 62, "NORMAL / MODERATE STRESS", "Stable", "MODERATE RISK"),
        ("pranaviR8", 0, 71, "HIGH STRESS", "Attention Required", "HIGH RISK"),

        ("EMP102", 3, 82, "CRITICAL / HIGH-RISK STRESS", "High-Risk Alert", "CRITICAL RISK"),
        ("EMP102", 1, 85, "CRITICAL / HIGH-RISK STRESS", "High-Risk Alert", "CRITICAL RISK"),

        ("EMP103", 2, 42, "LOW STRESS", "Optimal", "LOW RISK"),
        ("EMP103", 0, 40, "LOW STRESS", "Optimal", "LOW RISK"),

        ("EMP104", 3, 68, "HIGH STRESS", "Attention Required", "HIGH RISK"),
        ("EMP104", 0, 74, "HIGH STRESS", "Attention Required", "HIGH RISK"),

        ("EMP105", 1, 55, "NORMAL / MODERATE STRESS", "Stable", "MODERATE RISK"),
        ("EMP105", 0, 58, "NORMAL / MODERATE STRESS", "Stable", "MODERATE RISK"),
    ]

    base_time = datetime.now()
    for emp_id, days_ago, score, cat, status, risk in sample_sessions:
        ts = (base_time - timedelta(days=days_ago, hours=2)).strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO monitoring_sessions (
                employee_id, raw_model_score, calibrated_stress_score,
                stress_category, welfare_status, risk_status,
                webcam_features_json, questionnaire_data_json, recommendations_json,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            emp_id,
            round(score / 10.0, 2),
            score,
            cat,
            status,
            risk,
            json.dumps({"blink_rate": 18, "eye_fatigue_score": 45, "facial_tension_score": score, "posture_slouch_score": 35, "restlessness_score": 40}),
            json.dumps({"dutyHours": 8.5, "sleepQuality": 2, "mood": 3, "energy": 55, "workload": 3}),
            json.dumps({"exercises": ["Guided deep breathing", "2-minute shoulder roll", "Hydration break"], "diet": "Drink 2.5L water, avoid excess caffeine, eat fruits", "preventive": "Take a 5-minute break every hour."}),
            ts
        ))

    # Add a counselling record for the critical employee EMP102
    cursor.execute("""
        INSERT INTO counselling_records (
            employee_id, authority_id, status, notes, support_action, follow_up_date, created_at
        ) VALUES (
            'EMP102', 'Aroghya704', 'In Progress',
            'Observed critical stress markers over consecutive days. Scheduled 1-on-1 confidential welfare session.',
            'Workload reduction by 20% approved. Referred to clinical welfare counselor.',
            DATE('now', '+3 days'),
            DATETIME('now', '-1 day')
        )
    """)

    conn.commit()
    conn.close()
    print("[DB] Database initialization and seeding complete.")


if __name__ == "__main__":
    init_db()
    print("Database verified at:", DB_PATH)
