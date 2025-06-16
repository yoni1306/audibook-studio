echo "Queue status\n"
curl http://localhost:3333/api/queue/status
echo "\n"

echo "Waiting jobs\n"
curl http://localhost:3333/api/queue/jobs/waiting
echo "\n"

echo "Failed jobs\n"
curl http://localhost:3333/api/queue/jobs/failed
echo "\n"