# User Directory: Frontend + Node.js API + MySQL

A simple three-component CRUD project intended for local Docker learning and as a base for later Kubernetes manifests.

## Components

- `frontend/`: plain HTML, CSS and JavaScript served by Nginx. It contains Home, DeleteUser, UpdateUser, AddUser, and GetUser navigation.
- `backend/`: Express API with validation and parameterized MySQL queries.
- `database/init.sql`: schema for the `cruddb.users` table.
- `docker-compose.yml`: runs all three services on one private Compose network.

## Run it

Run these commands from the project root:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f frontend backend mysql
```

Open the UI at **http://localhost:8080**.

The frontend Nginx service proxies `/app/...` API requests to the backend service. That means the backend and MySQL don't need host-published ports for normal UI use.

## API routes

All request fields are required strings:

```json
{
  "name": "Asha",
  "fathername": "Ravi",
  "address": "Delhi",
  "pincode": "011001"
}
```

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health/readiness check including database connectivity |
| GET | `/app/home` | Return all users for Home |
| GET | `/app/getUser` | Fetch users |
| POST | `/app/addUser` | Add a user |
| PUT | `/app/updateUser/:id` | Update user fields |
| DELETE | `/app/deleteUser/:id` | Delete a user |

You can test the API through Nginx, for example: `http://localhost:8080/app/getUser`.

## Stop and resume

```bash
docker compose stop
docker compose start
```

To remove the containers and network while keeping the named database volume:

```bash
docker compose down
```

Do not use `docker compose down -v` unless you intend to delete the MySQL data volume.

## Important notes

- The initial MySQL script runs only when MySQL initializes an empty data directory. Updating `database/init.sql` does not rerun it against an existing `mysql_data` volume.
- The example credentials in Compose are for learning only. Use environment-specific secrets before deploying outside a local test environment.
- For Kubernetes, the frontend can become a Deployment/Service, the backend another Deployment/Service, and the database should use persistent storage and appropriate secret handling.
