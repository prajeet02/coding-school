# 1. Clean up
docker rm -f leetcode-db
docker container prune  
<!-- To stop all the stopped containers -->


# 3. Try again
docker run --name leetcode-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=leetcode \
  -e POSTGRES_DB=leetcode_db \
  -p 5433:5432 \
  -d postgres

# 4. Confirm
docker ps