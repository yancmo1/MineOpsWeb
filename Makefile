.PHONY: dev dev-up dev-down dev-logs up down logs build test lint
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
dev-up:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
dev-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down
dev-logs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
up:
	docker compose up -d --build
down:
	docker compose down
logs:
	docker compose logs -f
build:
	docker compose build
test:
	cd frontend && npm test
lint:
	cd frontend && npm run lint
