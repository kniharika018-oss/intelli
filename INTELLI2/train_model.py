import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score


# =========================
# 1. Load dataset
# =========================

df = pd.read_csv("tech_mental_health_burnout.csv")

print("Dataset shape:", df.shape)


# =========================
# 2. Remove duplicates
# =========================

df = df.drop_duplicates()


# =========================
# 3. Remove missing values
# =========================

df = df.dropna()

print("Shape after cleaning:", df.shape)


# =========================
# 4. Target
# =========================

target = "stress_level"

X = df.drop(columns=[target])
y = df[target]


# =========================
# 5. Identify columns
# =========================

categorical_columns = X.select_dtypes(
    include=["object", "str"]
).columns.tolist()

numerical_columns = X.select_dtypes(
    include=["int64", "float64"]
).columns.tolist()

print("\nCategorical columns:")
print(categorical_columns)

print("\nNumerical columns:")
print(numerical_columns)


# =========================
# 6. Preprocessing
# =========================

preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(handle_unknown="ignore"),
            categorical_columns
        ),
        (
            "numerical",
            "passthrough",
            numerical_columns
        )
    ]
)


# =========================
# 7. Model
# =========================

model = RandomForestRegressor(
    n_estimators=100,
    random_state=42,
    n_jobs=-1
)


# =========================
# 8. Pipeline
# =========================

pipeline = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("model", model)
    ]
)


# =========================
# 9. Train/Test split
# =========================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)


# =========================
# 10. Train
# =========================

print("\nTraining model...")

pipeline.fit(X_train, y_train)


# =========================
# 11. Prediction
# =========================

y_pred = pipeline.predict(X_test)


# =========================
# 12. Evaluation
# =========================

mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print("\nModel Results")
print("-------------------------")
print("MAE:", mae)
print("R2 Score:", r2)


# =========================
# 13. Save model
# =========================

joblib.dump(
    pipeline,
    "stress_model.pkl"
)

print("\nModel saved as stress_model.pkl")