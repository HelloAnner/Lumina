COMPOSE_PROJECT_NAME=lumina
PORT?=20261

.PHONY: prepare-data dev start stop logs build ps down

build:
	docker compose -p $(COMPOSE_PROJECT_NAME) build

prepare-data:
	mkdir -p data/app data/postgres data/redis data/minio data/minio-config
	@if [ -d .lumina-data ] && [ ! -f data/app/lumina.json ]; then cp -R .lumina-data/* data/app/ 2>/dev/null || true; fi

dev: prepare-data
	docker compose -p $(COMPOSE_PROJECT_NAME) up -d lumina-postgres lumina-redis lumina-minio
	@echo "Lumina dev server is starting at http://localhost:$(PORT)"
	PORT=$(PORT) npx tsx scripts/dev.ts

start: prepare-data
	PORT=$(PORT) docker compose -p $(COMPOSE_PROJECT_NAME) up -d --build
	@echo "Lumina is running at http://localhost:$(PORT)"

stop:
	docker compose -p $(COMPOSE_PROJECT_NAME) stop

down:
	docker compose -p $(COMPOSE_PROJECT_NAME) down

logs:
	docker compose -p $(COMPOSE_PROJECT_NAME) logs -f

ps:
	docker compose -p $(COMPOSE_PROJECT_NAME) ps
