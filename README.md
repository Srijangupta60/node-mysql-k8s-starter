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



## Kubernetes Deployment

This project uses Kubernetes to deploy the three-tier CRUD application consisting of:

1. **Frontend:** HTML, CSS, and JavaScript served using Nginx.
2. **Backend:** Node.js and Express REST API.
3. **Database:** MySQL 8.0.

### Kubernetes Directory Structure

All Kubernetes deployment and configuration manifests are maintained inside the `kubernetes/` directory.

```text
kubernetes/
├── namespace.yaml
├── database/
│   ├── secret.yaml
│   ├── configmap.yaml
│   ├── pvc.yaml
│   ├── statefulset.yaml
│   └── service.yaml
├── backend/
│   ├── deployment.yaml
│   └── service.yaml
└── frontend/
    ├── deployment.yaml
    └── service.yaml
```

### Namespace Configuration

**File:** `kubernetes/namespace.yaml`

A dedicated Kubernetes namespace named `crud-app` is created to isolate all resources belonging to this application.

The following resources will be deployed inside this namespace:

- Frontend Deployment and Service.
- Backend Deployment and Service.
- MySQL StatefulSet and Service.
- MySQL Secret, ConfigMap, and PersistentVolumeClaim.

Using a dedicated namespace makes application resources easier to manage, monitor, and troubleshoot.

### Kubernetes Resource Management

The application uses the following Kubernetes resources:

| Resource | Purpose |
|---|---|
| Namespace | Isolates application resources |
| Deployment | Manages frontend and backend Pods |
| StatefulSet | Manages the MySQL database Pod |
| Service | Enables communication between components |
| Secret | Stores database credentials |
| ConfigMap | Provides MySQL initialization SQL |
| PersistentVolumeClaim | Requests persistent database storage |

### Database Deployment

**Directory:** `kubernetes/database/`

This directory contains all Kubernetes manifests required to deploy and manage the MySQL database.

#### 1. Secret — `secret.yaml`

Creates a Kubernetes Secret named `mysql-secret` to store database credentials.

- Uses `Opaque` Secret type.
- Uses the `data` field, which requires Base64-encoded values.
- Provides MySQL root and application-user credentials.
- Credentials are consumed by the MySQL StatefulSet and backend Deployment.

**Security consideration:** Base64 is an encoding mechanism, not encryption. Real credentials must not be committed to a public Git repository. For production deployments, use a secure secret-management solution such as Azure Key Vault.

#### 2. ConfigMap — `configmap.yaml`

Creates a ConfigMap containing the MySQL initialization SQL script.

The script:
- Selects the `cruddb` database.
- Creates the `users` table if it does not already exist.
- Defines the columns `id`, `name`, `fathername`, `address`, and `pincode`.
- Includes `created_at` and `updated_at` timestamps.

The ConfigMap is mounted inside the MySQL container at:

`/docker-entrypoint-initdb.d/init.sql`

**Important:** The official MySQL container executes initialization scripts when initializing an empty database data directory. These scripts are not automatically executed again when an existing database is mounted from persistent storage.

#### 3. PersistentVolumeClaim — `pvc.yaml`

Creates a PersistentVolumeClaim named `mysql-pvc`.

Storage configuration:

- Requested storage: `8Gi`
- Access mode: `ReadWriteOnce`

The PVC provides persistent storage for MySQL database files.

It is mounted inside the MySQL container at:

`/var/lib/mysql`

This allows database data to survive MySQL Pod replacement, as long as the underlying persistent volume is retained.

The actual storage provisioning depends on the StorageClass configured in the Kubernetes cluster.

#### 4. StatefulSet — `statefulset.yaml`

Deploys MySQL using a Kubernetes StatefulSet.

Configuration:

- StatefulSet name: `mysql`
- Replicas: `1`
- Image: `mysql:8.0`
- Container port: `3306`
- Database: `cruddb`
- Persistent storage: `mysql-pvc`
- Storage mount: `/var/lib/mysql`

Additional configuration:

- Retrieves credentials from `mysql-secret`.
- Mounts the initialization SQL from the ConfigMap.
- Defines startup, readiness, and liveness probes.
- Configures CPU and memory requests and limits.

A StatefulSet is used because databases benefit from stable network identity and persistent storage associations.

This project uses a single MySQL instance. Database replication and high availability are outside the scope of this starter deployment.

#### 5. Service — `service.yaml`

Creates a headless Kubernetes Service named `mysql`.

Configuration:

- Service type: Headless (`clusterIP: None`)
- Port: `3306`
- Target: MySQL Pod

The backend communicates with MySQL using the Kubernetes DNS name:

`mysql:3306`

The headless Service provides DNS-based discovery of the MySQL StatefulSet Pod without allocating a regular ClusterIP.




### Backend Deployment

**Directory:** `kubernetes/backend/`

This directory contains the Kubernetes manifests required to deploy and expose the Node.js backend application.

#### 1. Deployment — `deployment.yaml`

Creates a Kubernetes Deployment named `backend`.

Configuration:

- Replicas: `2`
- Container image: `YOUR_ACR_NAME.azurecr.io/crud-backend:v1`
- Container port: `5000`
- Namespace: `crud-app`

The Deployment maintains two backend Pod replicas to provide basic application availability.

**Environment variables**

The backend uses the following environment variables:

| Variable | Value / Source | Purpose |
|---|---|---|
| `PORT` | `5000` | Backend application port |
| `DB_HOST` | `mysql` | MySQL Service DNS name |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `cruddb` | Database name |
| `DB_USER` | `mysql-secret` | Retrieved from Kubernetes Secret |
| `DB_PASSWORD` | `mysql-secret` | Retrieved from Kubernetes Secret |

Database credentials are injected using `secretKeyRef`, avoiding hardcoded credentials in the Deployment manifest.

**Health checks**

The backend Deployment defines three health probes:

- **Startup probe:** Determines whether the application has started successfully.
- **Readiness probe:** Uses the `/health` endpoint on port `5000` to check application and database connectivity. Only ready Pods receive Service traffic.
- **Liveness probe:** Uses a TCP check on port `5000` to detect an unresponsive backend process.

**Resource allocation**

| Resource | Request | Limit |
|---|---:|---:|
| CPU | `100m` | `500m` |
| Memory | `128Mi` | `512Mi` |

#### 2. Service — `service.yaml`

Creates a Kubernetes Service named `backend`.

Configuration:

- Service type: `ClusterIP`
- Service port: `5000`
- Target port: `5000`
- Namespace: `crud-app`

The backend Service provides internal communication between the frontend and backend Pods.

The frontend Nginx configuration forwards API requests to:

`http://backend:5000`

Kubernetes DNS resolves the Service name `backend` to its ClusterIP address and distributes traffic across healthy backend Pods.

The backend is not directly exposed to the internet because external users access the application through the frontend.


### Frontend Deployment

**Directory:** `kubernetes/frontend/`

This directory contains the Kubernetes manifests required to deploy and expose the frontend application.

The frontend is a static HTML, CSS, and JavaScript application served using Nginx.

#### 1. Deployment — `deployment.yaml`

Creates a Kubernetes Deployment named `frontend`.

Configuration:

- Replicas: `2`
- Container image: `YOUR_ACR_NAME.azurecr.io/crud-frontend:v1`
- Container port: `80`
- Namespace: `crud-app`

Two frontend replicas are maintained to provide basic application availability.

**Nginx reverse proxy**

The frontend container uses Nginx to serve static files and forward API requests to the backend Service.

The existing Nginx configuration handles requests as follows:

| Request path | Behavior |
|---|---|
| `/` | Serves frontend static files |
| `/app/` | Proxies requests to `http://backend:5000` |
| `/health` | Proxies requests to the backend health endpoint |

The backend is accessed through its Kubernetes Service DNS name rather than a hardcoded Pod IP.

**Resource allocation**

| Resource | Request | Limit |
|---|---:|---:|
| CPU | `100m` | `300m` |
| Memory | `64Mi` | `256Mi` |

#### 2. Service — `service.yaml`

Creates a Kubernetes Service named `frontend`.

Configuration:

- Service type: `NodePort`
- Service port: `80`
- Target port: `80`
- NodePort: `30080`
- Namespace: `crud-app`

**Why NodePort?**

A LoadBalancer Service can provision an Azure Load Balancer and introduce additional cloud costs.

This project uses NodePort to expose the frontend without explicitly requesting an Azure Load Balancer.

When a node has a reachable public IP and the required network security rules permit TCP traffic on port `30080`, the application can be accessed using:

`http://<AKS-NODE-PUBLIC-IP>:30080`

NodePort does not automatically provision a public IP or guarantee external reachability. Network configuration and node accessibility must be verified.

**Alternative local access**

For testing without exposing the node publicly, Kubernetes port forwarding can be used:

```bash
kubectl port-forward service/frontend 8080:80 -n crud-app
```

The application can then be accessed locally at:

`http://localhost:8080`




