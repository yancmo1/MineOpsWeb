from fastapi.testclient import TestClient
from app.main import app


def test_health_and_manager_sync():
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        body = {"device_id": "device-a", "mutations": [{"id": "manager-a", "device_id": "device-a", "manager_key": "dr-nova", "level": 5, "rank": 1, "promoted": 0, "fragments": 12, "unlocked": True}]}
        response = client.post("/api/v1/sync/managers", json=body, headers={"Idempotency-Key": "test-manager-a"})
        assert response.status_code == 200
        assert response.json()[0]["revision"] == 1
