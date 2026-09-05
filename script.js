/* =====================================================
   AROGHYA
   AI STRESS & WELFARE MONITORING SYSTEM
===================================================== */


/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let currentEmployee = null;

let basicData = {};

let smartwatchData = null;

let breathingTimer = null;


/* =====================================================
   PAGE NAVIGATION
===================================================== */

function showPage(pageId) {

    document.querySelectorAll(".page").forEach(page => {
        page.classList.add("hidden");
    });

    document.getElementById(pageId).classList.remove("hidden");
}


/* =====================================================
   INITIALIZE DATABASE
===================================================== */

function initializeDatabase() {

    if (!localStorage.getItem("employees")) {

        localStorage.setItem(
            "employees",
            JSON.stringify([])
        );

    }


    if (!localStorage.getItem("authorities")) {

        localStorage.setItem(
            "authorities",
            JSON.stringify([])
        );

    }
}


/* =====================================================
   EMPLOYEE REGISTRATION
===================================================== */

document
    .getElementById("employeeRegisterForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();


        const name =
            document
                .getElementById("employeeName")
                .value
                .trim();


        const email =
            document
                .getElementById("employeeEmail")
                .value
                .trim();


        const employeeId =
            document
                .getElementById("employeeId")
                .value
                .trim();


        const password =
            document
                .getElementById("employeePassword")
                .value;


        const confirmPassword =
            document
                .getElementById("employeeConfirmPassword")
                .value;


        const message =
            document.getElementById(
                "employeeRegisterMessage"
            );


        /* Password validation */

        if (password !== confirmPassword) {

            message.innerHTML = `
                <div class="error-message">
                    Passwords do not match.
                </div>
            `;

            return;
        }


        let employees =
            JSON.parse(
                localStorage.getItem("employees")
            );


        /* Check duplicate account */

        const existing =
            employees.find(employee =>

                employee.email.toLowerCase() ===
                email.toLowerCase()

                ||

                employee.employeeId.toLowerCase() ===
                employeeId.toLowerCase()

            );


        if (existing) {

            message.innerHTML = `
                <div class="error-message">
                    Account already exists.
                    Please Sign In.
                </div>
            `;

            return;
        }


        /* Create account */

        const newEmployee = {

            name: name,

            email: email,

            employeeId: employeeId,

            password: password,

            latestScore: null,

            latestLevel: null,

            weeklyScores: [
                32,
                40,
                55,
                48,
                67,
                38,
                null
            ]

        };


        employees.push(newEmployee);


        localStorage.setItem(
            "employees",
            JSON.stringify(employees)
        );


        message.innerHTML = `
            <div class="success-message">
                Account created successfully!
                Redirecting to Sign In...
            </div>
        `;


        setTimeout(() => {

            document
                .getElementById("employeeRegisterForm")
                .reset();

            showPage("employeeLoginPage");

        }, 1200);

    });


/* =====================================================
   EMPLOYEE LOGIN
===================================================== */

document
    .getElementById("employeeLoginForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();


        const identifier =
            document
                .getElementById("employeeLoginId")
                .value
                .trim()
                .toLowerCase();


        const password =
            document
                .getElementById("employeeLoginPassword")
                .value;


        const message =
            document.getElementById(
                "employeeLoginMessage"
            );


        const employees =
            JSON.parse(
                localStorage.getItem("employees")
            ) || [];


        const employee =
            employees.find(user =>

                (
                    user.email.toLowerCase() === identifier

                    ||

                    user.employeeId.toLowerCase() === identifier

                )

                &&

                user.password === password

            );


        if (!employee) {

            message.innerHTML = `
                <div class="error-message">
                    Invalid Email/Employee ID or Password.
                </div>
            `;

            return;
        }


        currentEmployee = employee;


        localStorage.setItem(
            "loggedEmployee",
            employee.employeeId
        );


        loadEmployeeDashboard();

    });


/* =====================================================
   EMPLOYEE DASHBOARD
===================================================== */

function loadEmployeeDashboard() {

    showPage("employeeDashboardPage");


    document.getElementById(
        "navEmployeeName"
    ).innerText = currentEmployee.name;


    document.getElementById(
        "welcomeName"
    ).innerText = currentEmployee.name;


    document.getElementById(
        "profileName"
    ).innerText = currentEmployee.name;


    document.getElementById(
        "profileEmail"
    ).innerText = currentEmployee.email;


    document.getElementById(
        "profileEmployeeId"
    ).innerText = currentEmployee.employeeId;


    resetEmployeeFlow();


    drawEmployeeChart();

}


/* =====================================================
   RESET EMPLOYEE FLOW
===================================================== */

function resetEmployeeFlow() {

    document
        .getElementById("todayStatusCard")
        .classList.remove("hidden");


    document
        .getElementById("smartwatchCard")
        .classList.add("hidden");


    document
        .getElementById("permissionCard")
        .classList.add("hidden");


    document
        .getElementById("watchDataCard")
        .classList.add("hidden");


    document
        .getElementById("predictionCard")
        .classList.add("hidden");


    document
        .getElementById("breathingCard")
        .classList.add("hidden");


    basicData = {};

    smartwatchData = null;

}


/* =====================================================
   RANGE VALUES
===================================================== */

document
    .getElementById("energy")
    .addEventListener("input", function() {

        document
            .getElementById("energyValue")
            .innerText = this.value + "%";

    });


document
    .getElementById("selfStress")
    .addEventListener("input", function() {

        document
            .getElementById("stressValue")
            .innerText = this.value + "%";

    });


/* =====================================================
   BASIC STATUS SUBMISSION
===================================================== */

document
    .getElementById("basicStatusForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();


        basicData = {

            sleepQuality:
                Number(
                    document.getElementById(
                        "sleepQuality"
                    ).value
                ),


            dutyHours:
                Number(
                    document.getElementById(
                        "dutyHours"
                    ).value
                ),


            mood:
                Number(
                    document.getElementById(
                        "mood"
                    ).value
                ),


            energy:
                Number(
                    document.getElementById(
                        "energy"
                    ).value
                ),


            workload:
                Number(
                    document.getElementById(
                        "workload"
                    ).value
                ),


            selfStress:
                Number(
                    document.getElementById(
                        "selfStress"
                    ).value
                )

        };


        document
            .getElementById("todayStatusCard")
            .classList.add("hidden");


        document
            .getElementById("smartwatchCard")
            .classList.remove("hidden");

    });


/* =====================================================
   SMARTWATCH PERMISSION
===================================================== */

function showPermission() {

    document
        .getElementById("smartwatchCard")
        .classList.add("hidden");


    document
        .getElementById("permissionCard")
        .classList.remove("hidden");

}


function continueWatch() {

    document
        .getElementById("permissionCard")
        .classList.add("hidden");


    document
        .getElementById("watchDataCard")
        .classList.remove("hidden");

}


function skipWatch() {

    smartwatchData = null;


    document
        .getElementById("smartwatchCard")
        .classList.add("hidden");


    document
        .getElementById("permissionCard")
        .classList.add("hidden");


    document
        .getElementById("watchDataCard")
        .classList.add("hidden");


    runAIPrediction();

}


/* =====================================================
   SMARTWATCH DATA
===================================================== */

document
    .getElementById("watchDataForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();


        smartwatchData = {

            heartRate:
                Number(
                    document.getElementById(
                        "heartRate"
                    ).value
                ),


            steps:
                Number(
                    document.getElementById(
                        "steps"
                    ).value
                ),


            sleepHours:
                Number(
                    document.getElementById(
                        "sleepHours"
                    ).value
                ),


            wearableStress:
                Number(
                    document.getElementById(
                        "wearableStress"
                    ).value
                )

        };


        document
            .getElementById("watchDataCard")
            .classList.add("hidden");


        runAIPrediction();

    });


/* =====================================================
   AI STRESS PREDICTION
===================================================== */

function runAIPrediction() {

    let score = 0;


    /*
       Self-reported stress
       Maximum contribution = 35
    */

    score +=
        basicData.selfStress * 0.35;


    /*
       Workload
    */

    score +=
        basicData.workload * 6;


    /*
       Long duty hours
    */

    if (basicData.dutyHours > 8) {

        score +=
            (basicData.dutyHours - 8) * 4;

    }


    /*
       Poor sleep quality
    */

    score +=
        (4 - basicData.sleepQuality) * 5;


    /*
       Low mood
    */

    score +=
        (5 - basicData.mood) * 4;


    /*
       Low energy
    */

    score +=
        (100 - basicData.energy) * 0.10;


    /*
       Smartwatch data
    */

    if (smartwatchData !== null) {


        /*
           Heart rate signal
        */

        if (smartwatchData.heartRate > 90) {

            score += Math.min(

                (smartwatchData.heartRate - 90)
                * 0.5,

                10

            );

        }


        /*
           Low physical activity
        */

        if (smartwatchData.steps < 5000) {

            score += 5;

        }


        /*
           Sleep duration
        */

        if (smartwatchData.sleepHours < 7) {

            score +=
                (7 - smartwatchData.sleepHours)
                * 4;

        }


        /*
           Wearable stress
        */

        score +=
            smartwatchData.wearableStress * 0.15;

    }


    /*
       Keep score between 0 and 100
    */

    score = Math.round(
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        )
    );


    let level;


    /*
       Requested thresholds:

       0-45   LOW
       45-75  MEDIUM
       75-100 RISKY
    */

    if (score < 45) {

        level = "LOW";

    }

    else if (score < 75) {

        level = "MEDIUM";

    }

    else {

        level = "RISKY";

    }


    savePrediction(score, level);

    showPrediction(score, level);

}


/* =====================================================
   SAVE PREDICTION
===================================================== */

function savePrediction(score, level) {

    let employees =
        JSON.parse(
            localStorage.getItem("employees")
        ) || [];


    const index =
        employees.findIndex(
            employee =>
                employee.employeeId ===
                currentEmployee.employeeId
        );


    if (index === -1) {
        return;
    }


    employees[index].latestScore = score;

    employees[index].latestLevel = level;


    /*
       Store today's score
    */

    if (!employees[index].weeklyScores) {

        employees[index].weeklyScores =
            [null,null,null,null,null,null,null];

    }


    employees[index].weeklyScores[6] = score;


    localStorage.setItem(
        "employees",
        JSON.stringify(employees)
    );


    currentEmployee = employees[index];

}


/* =====================================================
   SHOW PREDICTION
===================================================== */

function showPrediction(score, level) {

    const predictionCard =
        document.getElementById(
            "predictionCard"
        );


    const scoreElement =
        document.getElementById(
            "stressScore"
        );


    const levelElement =
        document.getElementById(
            "stressLevel"
        );


    const textElement =
        document.getElementById(
            "predictionText"
        );


    const adviceList =
        document.getElementById(
            "adviceList"
        );


    predictionCard.classList.remove(
        "hidden"
    );


    scoreElement.innerText =
        score + "%";


    levelElement.innerText =
        level;


    levelElement.className =
        "stress-level " +
        level.toLowerCase();


    adviceList.innerHTML = "";


    /*
       LOW
    */

    if (level === "LOW") {

        textElement.innerText =
            "Your current stress-risk level appears to be low. Continue maintaining healthy habits.";


        addAdvice(
            "Stay hydrated throughout the day."
        );

        addAdvice(
            "Continue regular physical activities."
        );

        addAdvice(
            "Practice relaxation or deep breathing."
        );

        addAdvice(
            "Maintain a healthy sleep routine."
        );


        document
            .getElementById(
                "breathingCard"
            )
            .classList.add("hidden");

    }


    /*
       MEDIUM
    */

    else if (level === "MEDIUM") {

        textElement.innerText =
            "Your stress level is moderate. Keep monitoring yourself and maintain a balanced routine.";


        addAdvice(
            "Monitor your stress levels regularly."
        );

        addAdvice(
            "Keep up the good work."
        );

        addAdvice(
            "Stay balanced and keep stress under control."
        );

        addAdvice(
            "Practice relaxation or deep breathing."
        );

        addAdvice(
            "Take sufficient rest whenever possible."
        );

        addAdvice(
            "Stay connected with family and friends."
        );


        document
            .getElementById(
                "breathingCard"
            )
            .classList.add("hidden");

    }


    /*
       RISKY
    */

    else {

        textElement.innerText =
            "Your current stress-risk score is high. Please take time to care for yourself and consider appropriate support if needed.";


        addAdvice(
            "Do yoga regularly."
        );

        addAdvice(
            "Practice meditation for at least 10 minutes a day."
        );

        addAdvice(
            "Stay hydrated throughout the day."
        );

        addAdvice(
            "Talk with family and friends."
        );

        addAdvice(
            "Take adequate rest whenever possible."
        );

        addAdvice(
            "Practice the 30-second breathing exercise."
        );

        addAdvice(
            "If stress remains high, consider contacting an appropriate health/welfare professional."
        );


        document
            .getElementById(
                "breathingCard"
            )
            .classList.remove("hidden");

    }


    drawEmployeeChart();

}


/* =====================================================
   ADD ADVICE
===================================================== */

function addAdvice(text) {

    const list =
        document.getElementById(
            "adviceList"
        );


    const item =
        document.createElement("li");


    item.innerText = text;


    list.appendChild(item);

}


/* =====================================================
   30 SECOND BREATHING EXERCISE
===================================================== */

function startBreathing() {

    const circle =
        document.getElementById(
            "breathingCircle"
        );


    const instruction =
        document.getElementById(
            "breathingInstruction"
        );


    let elapsed = 0;


    if (breathingTimer) {

        clearInterval(
            breathingTimer
        );

    }


    breathingTimer =
        setInterval(function() {

            elapsed++;


            /*
               0 - 4 seconds
               Breathe In
            */

            if (elapsed <= 4) {

                circle.innerText =
                    "BREATHE IN";

                instruction.innerText =
                    "Breathe In — " +
                    (5 - elapsed) +
                    " sec";

                circle.classList.add(
                    "expand"
                );

            }


            /*
               5 - 6 seconds
               Hold
            */

            else if (elapsed <= 6) {

                circle.innerText =
                    "HOLD";

                instruction.innerText =
                    "Hold — " +
                    (7 - elapsed) +
                    " sec";

            }


            /*
               7 - 12 seconds
               Breathe Out
            */

            else if (elapsed <= 12) {

                circle.innerText =
                    "BREATHE OUT";

                instruction.innerText =
                    "Breathe Out — " +
                    (13 - elapsed) +
                    " sec";

                circle.classList.remove(
                    "expand"
                );

            }


            /*
               Repeat until 30 seconds
            */

            else if (elapsed < 30) {

                const cycle =
                    elapsed % 12;


                if (cycle <= 4) {

                    circle.innerText =
                        "BREATHE IN";

                    instruction.innerText =
                        "Breathe In";

                    circle.classList.add(
                        "expand"
                    );

                }

                else if (cycle <= 6) {

                    circle.innerText =
                        "HOLD";

                    instruction.innerText =
                        "Hold";

                }

                else {

                    circle.innerText =
                        "BREATHE OUT";

                    instruction.innerText =
                        "Breathe Out";

                    circle.classList.remove(
                        "expand"
                    );

                }

            }


            /*
               Completed
            */

            else {

                clearInterval(
                    breathingTimer
                );

                breathingTimer = null;


                circle.innerText =
                    "DONE";


                instruction.innerText =
                    "30-second exercise completed. Well done!";


                circle.classList.remove(
                    "expand"
                );

            }

        }, 1000);

}


/* =====================================================
   EMPLOYEE WEEKLY CHART
===================================================== */

function drawEmployeeChart() {

    const canvas =
        document.getElementById(
            "employeeChart"
        );


    if (!canvas || !currentEmployee) {
        return;
    }


    const ctx =
        canvas.getContext("2d");


    const width =
        canvas.parentElement.clientWidth;


    const height =
        canvas.parentElement.clientHeight;


    canvas.width = width;

    canvas.height = height;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const values =
        currentEmployee.weeklyScores ||
        [32,40,55,48,67,38,null];


    const days =
        [
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
            "Sun"
        ];


    const left = 50;

    const right = 20;

    const top = 20;

    const bottom = 45;


    const chartWidth =
        width -
        left -
        right;


    const chartHeight =
        height -
        top -
        bottom;


    /*
       Grid lines
    */

    ctx.strokeStyle =
        "#e5e7eb";

    ctx.lineWidth = 1;


    for (
        let i = 0;
        i <= 5;
        i++
    ) {

        const y =
            top +
            chartHeight *
            (i / 5);


        ctx.beginPath();

        ctx.moveTo(
            left,
            y
        );

        ctx.lineTo(
            width - right,
            y
        );

        ctx.stroke();


        ctx.fillStyle =
            "#64748b";

        ctx.font =
            "12px Arial";


        ctx.fillText(
            (100 - i * 20) + "%",
            5,
            y + 4
        );

    }


    /*
       Draw threshold zones
    */

    ctx.fillStyle =
        "rgba(34,197,94,0.07)";


    ctx.fillRect(
        left,
        top + chartHeight * 0.55,
        chartWidth,
        chartHeight * 0.45
    );


    ctx.fillStyle =
        "rgba(249,115,22,0.07)";


    ctx.fillRect(
        left,
        top + chartHeight * 0.25,
        chartWidth,
        chartHeight * 0.30
    );


    ctx.fillStyle =
        "rgba(220,38,38,0.07)";


    ctx.fillRect(
        left,
        top,
        chartWidth,
        chartHeight * 0.25
    );


    /*
       Points and line
    */

    let previous = null;


    values.forEach(
        (value, index) => {

            const x =
                left +
                (chartWidth / 6) *
                index;


            if (
                value === null ||
                value === undefined
            ) {

                return;

            }


            const y =
                top +
                chartHeight -
                (value / 100) *
                chartHeight;


            /*
               Connect points
            */

            if (previous) {

                ctx.beginPath();

                ctx.moveTo(
                    previous.x,
                    previous.y
                );

                ctx.lineTo(
                    x,
                    y
                );

                ctx.strokeStyle =
                    "#1769aa";

                ctx.lineWidth = 3;

                ctx.stroke();

            }


            /*
               Point colour
            */

            let pointColor;


            if (value < 45) {

                pointColor =
                    "#16a34a";

            }

            else if (value < 75) {

                pointColor =
                    "#f97316";

            }

            else {

                pointColor =
                    "#dc2626";

            }


            /*
               Point
            */

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                6,
                0,
                Math.PI * 2
            );


            ctx.fillStyle =
                pointColor;

            ctx.fill();


            /*
               Score
            */

            ctx.fillStyle =
                "#334155";

            ctx.font =
                "12px Arial";


            ctx.fillText(
                value + "%",
                x - 12,
                y - 12
            );


            /*
               Day
            */

            ctx.fillStyle =
                "#64748b";


            ctx.fillText(
                days[index],
                x - 10,
                height - 15
            );


            previous = {
                x: x,
                y: y
            };

        }
    );

}


/* =====================================================
   AUTHORITY REGISTRATION
===================================================== */

document
    .getElementById("authorityRegisterForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();


        const institutionName =
            document
                .getElementById(
                    "institutionName"
                )
                .value
                .trim();


        const institutionEmail =
            document
                .getElementById(
                    "institutionEmail"
                )
                .value
                .trim();


        const institutionId =
            document
                .getElementById(
                    "institutionId"
                )
                .value
                .trim();


        const password =
            document
                .getElementById(
                    "authorityPassword"
                )
                .value;


        const confirmPassword =
            document
                .getElementById(
                    "authorityConfirmPassword"
                )
                .value;


        const message =
            document.getElementById(
                "authorityRegisterMessage"
            );


        if (
            password !==
            confirmPassword
        ) {

            message.innerHTML = `
                <div class="error-message">
                    Passwords do not match.
                </div>
            `;

            return;
        }


        let authorities =
            JSON.parse(
                localStorage.getItem(
                    "authorities"
                )
            ) || [];


        const existing =
            authorities.find(authority =>

                authority.email.toLowerCase() ===
                institutionEmail.toLowerCase()

                ||

                authority.institutionId.toLowerCase() ===
                institutionId.toLowerCase()

            );


        if (existing) {

            message.innerHTML = `
                <div class="error-message">
                    Authority account already exists.
                    Please Sign In.
                </div>
            `;

            return;
        }


        const authority = {

            institutionName:
                institutionName,

            email:
                institutionEmail,

            institutionId:
                institutionId,

            password:
                password

        };


        authorities.push(
            authority
        );


        localStorage.setItem(
            "authorities",
            JSON.stringify(
                authorities
            )
        );


        message.innerHTML = `
            <div class="success-message">
                Authority account created successfully!
                Redirecting...
            </div>
        `;


        setTimeout(() => {

            document
                .getElementById(
                    "authorityRegisterForm"
                )
                .reset();


            showPage(
                "authorityLoginPage"
            );

        }, 1200);

    });


/* =====================================================
   AUTHORITY LOGIN
===================================================== */

document
    .getElementById("authorityLoginForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();


        const identifier =
            document
                .getElementById(
                    "authorityLoginId"
                )
                .value
                .trim()
                .toLowerCase();


        const password =
            document
                .getElementById(
                    "authorityLoginPassword"
                )
                .value;


        const message =
            document.getElementById(
                "authorityLoginMessage"
            );


        const authorities =
            JSON.parse(
                localStorage.getItem(
                    "authorities"
                )
            ) || [];


        const authority =
            authorities.find(user =>

                (
                    user.email.toLowerCase() ===
                    identifier

                    ||

                    user.institutionId.toLowerCase() ===
                    identifier

                )

                &&

                user.password ===
                password

            );


        if (!authority) {

            message.innerHTML = `
                <div class="error-message">
                    Invalid Institution Email/ID or Password.
                </div>
            `;

            return;
        }


        localStorage.setItem(
            "loggedAuthority",
            authority.institutionId
        );


        loadAuthorityDashboard();

    });


/* =====================================================
   AUTHORITY DASHBOARD
===================================================== */

function loadAuthorityDashboard() {

    showPage(
        "authorityDashboardPage"
    );


    loadEmployeeRecords();

    drawAuthorityChart();

}


/* =====================================================
   EMPLOYEE RECORDS
===================================================== */

function loadEmployeeRecords() {

    const employees =
        JSON.parse(
            localStorage.getItem(
                "employees"
            )
        ) || [];


    let low = 0;

    let medium = 0;

    let risky = 0;


    const tableBody =
        document.getElementById(
            "employeeTableBody"
        );


    tableBody.innerHTML = "";


    employees.forEach(
        employee => {

            let score =
                employee.latestScore;


            let level =
                employee.latestLevel;


            /*
               Employee has not
               completed assessment
            */

            if (
                score === null ||
                score === undefined
            ) {

                score = "--";

                level =
                    "Not Available";

            }


            if (
                level === "LOW"
            ) {

                low++;

            }


            if (
                level === "MEDIUM"
            ) {

                medium++;

            }


            if (
                level === "RISKY"
            ) {

                risky++;

            }


            let badge = "";


            if (
                level === "LOW"
            ) {

                badge =
                    `<span class="status-badge status-low">
                        LOW
                    </span>`;

            }

            else if (
                level === "MEDIUM"
            ) {

                badge =
                    `<span class="status-badge status-medium">
                        MEDIUM
                    </span>`;

            }

            else if (
                level === "RISKY"
            ) {

                badge =
                    `<span class="status-badge status-risky">
                        RISKY
                    </span>`;

            }

            else {

                badge =
                    `<span>
                        Not Available
                    </span>`;

            }


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${escapeHTML(employee.employeeId)}
                </td>

                <td>
                    ${escapeHTML(employee.name)}
                </td>

                <td>
                    ${escapeHTML(employee.email)}
                </td>

                <td>
                    ${
                        score === "--"
                        ? "--"
                        : score + "%"
                    }
                </td>

                <td>
                    ${badge}
                </td>

            `;


            tableBody.appendChild(
                row
            );

        }
    );


    document.getElementById(
        "totalEmployees"
    ).innerText =
        employees.length;


    document.getElementById(
        "lowEmployees"
    ).innerText =
        low;


    document.getElementById(
        "mediumEmployees"
    ).innerText =
        medium;


    document.getElementById(
        "riskyEmployees"
    ).innerText =
        risky;

}


/* =====================================================
   SAFE HTML
===================================================== */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =====================================================
   AUTHORITY WORKFORCE CHART
===================================================== */

function drawAuthorityChart() {

    const canvas =
        document.getElementById(
            "authorityChart"
        );


    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext("2d");


    const width =
        canvas.parentElement.clientWidth;


    const height =
        canvas.parentElement.clientHeight;


    canvas.width =
        width;

    canvas.height =
        height;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const employees =
        JSON.parse(
            localStorage.getItem(
                "employees"
            )
        ) || [];


    let values =
        [
            42,
            48,
            55,
            62,
            58,
            51,
            47
        ];


    /*
       Use current average score
       for today's point.
    */

    const scores =
        employees
            .map(employee =>
                employee.latestScore
            )
            .filter(score =>
                score !== null &&
                score !== undefined
            );


    if (scores.length > 0) {

        const average =
            scores.reduce(
                (a,b) => a + b,
                0
            ) / scores.length;


        values[6] =
            Math.round(
                average
            );

    }


    drawLineChart(
        ctx,
        width,
        height,
        values
    );

}


/* =====================================================
   GENERIC LINE CHART
===================================================== */

function drawLineChart(
    ctx,
    width,
    height,
    values
) {

    const days =
        [
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
            "Sun"
        ];


    const left = 50;

    const right = 20;

    const top = 20;

    const bottom = 45;


    const chartWidth =
        width -
        left -
        right;


    const chartHeight =
        height -
        top -
        bottom;


    /*
       Grid
    */

    ctx.strokeStyle =
        "#e5e7eb";

    ctx.lineWidth = 1;


    for (
        let i = 0;
        i <= 5;
        i++
    ) {

        const y =
            top +
            chartHeight *
            (i / 5);


        ctx.beginPath();

        ctx.moveTo(
            left,
            y
        );

        ctx.lineTo(
            width - right,
            y
        );

        ctx.stroke();


        ctx.fillStyle =
            "#64748b";

        ctx.font =
            "12px Arial";


        ctx.fillText(
            (100 - i * 20) + "%",
            5,
            y + 4
        );

    }


    /*
       Draw points
    */

    let previous = null;


    values.forEach(
        (value,index) => {

            const x =
                left +
                (chartWidth / 6) *
                index;


            const y =
                top +
                chartHeight -
                (value / 100) *
                chartHeight;


            /*
               Connect
            */

            if (previous) {

                ctx.beginPath();

                ctx.moveTo(
                    previous.x,
                    previous.y
                );

                ctx.lineTo(
                    x,
                    y
                );

                ctx.strokeStyle =
                    "#1769aa";

                ctx.lineWidth = 3;

                ctx.stroke();

            }


            /*
               Determine colour
            */

            let color;


            if (value < 45) {

                color =
                    "#16a34a";

            }

            else if (value < 75) {

                color =
                    "#f97316";

            }

            else {

                color =
                    "#dc2626";

            }


            /*
               Point
            */

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                6,
                0,
                Math.PI * 2
            );


            ctx.fillStyle =
                color;

            ctx.fill();


            /*
               Value
            */

            ctx.fillStyle =
                "#334155";

            ctx.font =
                "12px Arial";


            ctx.fillText(
                value + "%",
                x - 12,
                y - 12
            );


            /*
               Day
            */

            ctx.fillStyle =
                "#64748b";


            ctx.fillText(
                days[index],
                x - 10,
                height - 15
            );


            previous = {
                x: x,
                y: y
            };

        }
    );

}


/* =====================================================
   LOGOUT
===================================================== */

function logout() {

    currentEmployee = null;

    basicData = {};

    smartwatchData = null;


    localStorage.removeItem(
        "loggedEmployee"
    );


    localStorage.removeItem(
        "loggedAuthority"
    );


    showPage(
        "landingPage"
    );

}


/* =====================================================
   AUTO LOGIN AFTER REFRESH
===================================================== */

function checkExistingLogin() {

    const employeeId =
        localStorage.getItem(
            "loggedEmployee"
        );


    const authorityId =
        localStorage.getItem(
            "loggedAuthority"
        );


    /*
       Employee
    */

    if (employeeId) {

        const employees =
            JSON.parse(
                localStorage.getItem(
                    "employees"
                )
            ) || [];


        const employee =
            employees.find(
                user =>
                    user.employeeId ===
                    employeeId
            );


        if (employee) {

            currentEmployee =
                employee;


            loadEmployeeDashboard();

            return;

        }

    }


    /*
       Authority
    */

    if (authorityId) {

        loadAuthorityDashboard();

        return;

    }


    showPage(
        "landingPage"
    );

}


/* =====================================================
   WINDOW RESIZE
===================================================== */

window.addEventListener(
    "resize",
    function() {

        if (
            currentEmployee &&
            !document
                .getElementById(
                    "employeeDashboardPage"
                )
                .classList.contains(
                    "hidden"
                )
        ) {

            drawEmployeeChart();

        }


        if (
            !document
                .getElementById(
                    "authorityDashboardPage"
                )
                .classList.contains(
                    "hidden"
                )
        ) {

            drawAuthorityChart();

        }

    }
);


/* =====================================================
   START APPLICATION
===================================================== */

initializeDatabase();

checkExistingLogin();