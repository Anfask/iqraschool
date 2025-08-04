.PHONY: compose-up-build
compose-up-build:
	docker compose up -d --build

# Stop and remove all containers
.PHONY: compose-down
compose-down:
	docker compose down

# Rebuild setup
.PHONY: compose-rebuild
compose-rebuild:
	docker compose -f docker-compose.yml down
	docker compose -f docker-compose.yml up --build
