# Launch dev databases (PostgreSQL + Redis) via Docker.
param(
    [switch]$Down
)

$compose = "..\docker-compose.yml"

if ($Down) {
    docker compose -f $compose down
} else {
    docker compose -f $compose up -d db redis
}
