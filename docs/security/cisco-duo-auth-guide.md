# Cisco Duo Dual Authentication & Cloudflare Tunnel Implementation Guide

This guide provides the complete end-to-end architecture, dashboard workflows, implementation steps, and agent/computer use prompts for setting up **Cisco Duo Multi-Factor Authentication (MFA)** with **Username and Password Login** for the SongNodes frontend, exposed via **Cloudflare Tunnel (`cloudflared`)** on the target domain:
`https://song.aiwfe.com`.

---

## 1. Architectural Architecture Analysis

### Approach Comparison

| Criteria | Approach 1: Cloudflare Access + Duo SSO (Zero Trust Perimeter) | Approach 2: Native In-App Duo Universal Prompt (Web SDK v4 OIDC) | Approach 3: Two-Tier Defense-in-Depth (Access + App Auth) |
| :--- | :--- | :--- | :--- |
| **How it works** | Cloudflare Zero Trust intercepts requests to `song.aiwfe.com` and delegates auth to Cisco Duo Single Sign-On before traffic reaches the server. | SongNodes backend handles password verification + Duo Universal Prompt redirect; `cloudflared` acts as a pure ingress proxy. | Cloudflare Access acts as outer perimeter gatekeeper; internal SongNodes session manages app-specific permissions. |
| **Attack Surface** | **Zero open attack surface**. Unauthenticated traffic never touches your web server or API. | Moderate. Login API and public assets are reachable by any IP discovering the tunnel domain. | **Zero open attack surface** + granular in-app RBAC. |
| **Implementation Effort** | **Low / No code**. Configured purely through Duo Admin and Cloudflare dashboards. | **Moderate / High**. Requires backend session management, database migrations, and frontend auth views. | **Moderate**. Fast setup with Cloudflare Access identity headers forwarded to frontend. |
| **User Experience** | Single sign-on portal with Duo push / hardware token -> immediate redirection to app. | Custom in-app login page -> Duo Universal Prompt redirect -> return to app. | Outer SSO gate -> automatic seamless sign-in to app workspace. |
| **Recommended For** | Initial release, remote DJ security, internal dashboards, zero-maintenance setups. | Public multi-tenant SaaS where end-users manage individual SongNodes accounts independently. | **Production enterprise standard for `song.aiwfe.com`**. |

---

## 2. Approach 1: Cloudflare Zero Trust + Cisco Duo SSO (Recommended)

### High-Level Flow
1. User requests `https://song.aiwfe.com`.
2. Cloudflare Edge intercepts the request and checks for a valid `CF_Authorization` cookie.
3. If absent or expired, Cloudflare redirects user to **Cisco Duo Single Sign-On**.
4. Duo displays the login prompt (primary username/password) and then triggers Duo 2FA (Push, Passcode, or FIDO2/WebAuthn key).
5. Upon successful verification, Duo redirects back to Cloudflare Access with SAML assertions / OIDC claims.
6. Cloudflare Access sets the `CF_Authorization` signed JWT cookie and proxies the traffic via `cloudflared` to the local SongNodes frontend (`http://localhost:3006` or Docker `http://frontend:8080`).
7. SongNodes frontend and API read the identity header `Cf-Access-Authenticated-User-Email` to identify the user without requiring another password prompt.

---

## 3. Approach 2: In-App Duo Web SDK v4 (Universal Prompt) + Local Database Credentials

### High-Level Flow
1. User visits `https://song.aiwfe.com/login`.
2. User submits Username/Email + Password to `POST /api/v1/auth/login`.
3. Backend validates credentials against PostgreSQL (using Argon2id).
4. If valid, backend initializes an OIDC authorization session with Cisco Duo using the Duo Client ID, Client Secret, and API Hostname.
5. User is redirected to Duo Universal Prompt (`https://api-XXXX.duosecurity.com/oauth/v1/authorize?...`).
6. User completes 2FA via Duo Mobile push, phone call, or hardware key.
7. Duo redirects to `https://song.aiwfe.com/api/v1/auth/duo/callback?code=...&state=...`.
8. Backend exchanges authorization code for tokens, creates an HTTP-only secure JWT session cookie, and redirects user to `/library` or `/camelot`.

---

## 4. Cisco Duo Dashboard Online Setup (Human & Computer Use Guide)

### Step 1: Sign In & Access Application Management
1. Navigate to: `https://admin.duosecurity.com`
2. Enter Duo Admin email and master password, then approve the Duo Push on your administrator mobile device.
3. In the left navigation menu, click **Applications**.

### Step 2A (For Cloudflare Zero Trust SSO / SAML):
1. Click **Protect an Application**.
2. In the search box, search for `Cloudflare Access` (or `Generic SAML Service Provider` if Cloudflare Access template is not listed).
3. Click **Protect** next to the application.
4. Note down:
   - **Single Sign-On URL / Identity Provider Single Sign-On URL**
   - **Identity Provider Issuer (Entity ID)**
   - **X.509 Certificate** (Download the `.crt` or `.pem` file).
5. Under **Service Provider details**:
   - **Entity ID**: `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback`
   - **Assertion Consumer Service (ACS) URL**: `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback`
6. Under **Settings**:
   - Set **Name**: `SongNodes Cloudflare Access`
7. Click **Save Changes**.

### Step 2B (For In-App Web SDK v4 Universal Prompt):
1. In Duo Admin Dashboard, navigate to **Applications** -> **Protect an Application**.
2. In the search bar, search for: `Web SDK`.
3. Click **Protect**.
4. In the Application Details page, record the following credentials securely:
   - **Client ID** (Integration Key / `ikey` format: 20 characters alphanumeric)
   - **Client Secret** (Secret Key / `skey` format: 40 characters)
   - **API Hostname** (e.g. `api-XXXXXXXX.duosecurity.com`)
5. Scroll down to **Settings**:
   - **Name**: `SongNodes Web Client`
   - **Redirect URLs**: Add `https://song.aiwfe.com/api/v1/auth/duo/callback` and `http://127.0.0.1:8082/api/v1/auth/duo/callback` (for local dev).
6. Under **Universal Prompt**, verify status displays: **Universal Prompt ready**.
7. Click **Save Changes**.

### Step 3: Enroll Users
1. In the left sidebar, click **Users**.
2. Click **Add User**.
3. Enter Username (e.g., `admin` or DJ email address `dj@aiwfe.com`).
4. Click **Add User**.
5. Under **Phones**, click **Add Phone**, input phone number, and click **Send Enrollment SMS** or copy the Duo Mobile activation link to bind the phone.

---

## 5. Cloudflare Dashboard & `cloudflared` Setup (Human & Computer Use Guide)

### Step 1: Create Cloudflare Tunnel for `song.aiwfe.com`
1. Navigate to: `https://one.dash.cloudflare.com` (Cloudflare Zero Trust).
2. Go to **Networks** -> **Tunnels** (or **Access** -> **Tunnels**).
3. Click **Create a tunnel**.
4. Select **Cloudflared** connector -> Click **Next**.
5. Name the tunnel: `songnodes-tunnel` -> Click **Save tunnel**.
6. Under **Install and run a connector**, select your environment (Docker or Windows).
   - Copy the Tunnel Token (e.g. `eyJhIjoi...`).
7. Click **Next** to proceed to the **Public Hostnames** tab.
8. Click **Add a public hostname**:
   - **Subdomain**: `song`
   - **Domain**: `aiwfe.com`
   - **Path**: leave empty (root `/`)
   - **Service Type**: `HTTP`
   - **URL**: `localhost:3006` (for Vite dev) or `127.0.0.1:8080` (for frontend container), or `frontend:8080` (if running inside Docker network).
   - Under **Additional application settings** -> **TLS**: Enable `No TLS Verify` if connecting to an internal HTTPS endpoint.
9. Click **Save hostname**.

### Step 2: Configure Cloudflare Access with Duo MFA
1. In Cloudflare Zero Trust, go to **Settings** -> **Authentication**.
2. Under **Login methods**, click **Add new**.
3. Select **SAML** (or **OIDC**).
4. Fill in Duo identity details from Step 2A:
   - **Name**: `Cisco Duo SSO`
   - **Single sign-on URL**: Duo SSO URL from Duo dashboard.
   - **IdP Entity ID / Issuer**: Duo Entity ID.
   - **Signing certificate**: Paste the content of the X.509 `.crt` downloaded from Duo.
5. Click **Save**.
6. Go to **Access** -> **Applications** -> Click **Add an application**.
7. Choose **Self-hosted**.
8. Set Application Settings:
   - **Application name**: `SongNodes Production`
   - **Session Duration**: `24 hours`
   - **Application domain**: Subdomain `song`, Domain `aiwfe.com`.
9. Under **Identity providers**, check `Cisco Duo SSO` (and optionally uncheck default One-Time PIN).
10. Click **Next** to configure **Policies**:
    - **Policy name**: `Allow Authorized Users`
    - **Action**: `Allow`
    - **Configure rules**:
      - Selector: `Emails` (or `Email domain`)
      - Value: `your-email@aiwfe.com`
11. Click **Next** -> Click **Add application**.

---

## 6. Docker & Local Daemon Configuration

### Adding `cloudflared` to `compose.dev.yaml`
```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: songnodes-cloudflared
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      frontend: { condition: service_healthy }
    networks:
      - default
```

When running `cloudflared` inside the docker compose network, the Public Hostname service in the Cloudflare dashboard should point to:
`http://frontend:8080` (using Docker DNS resolution).

---

## 7. Computer Use Prompts for Autonomous Browser Agents

Below are copy-paste prompts designed for Computer Use agents (such as Claude Computer Use, Gemini Browser Agent, or browser-use) to automate both online portals.

### Prompt A: Duo Security Dashboard Automation Prompt
```text
Task: Configure a new Web SDK application and an authorized user in the Cisco Duo Admin Panel.

Target URL: https://admin.duosecurity.com
Credentials Needed: DUO_ADMIN_EMAIL, DUO_ADMIN_PASSWORD

Instructions:
1. Navigate to https://admin.duosecurity.com.
2. In the email field, enter {DUO_ADMIN_EMAIL}. In the password field, enter {DUO_ADMIN_PASSWORD}. Click "Log In".
3. Wait for the Duo Push prompt. Note to user: "Please approve the Duo 2FA push on your admin mobile device."
4. Once dashboard loads, locate the left sidebar navigation and click "Applications".
5. In the Applications view, click the blue button labeled "Protect an Application".
6. In the search box "Filter by application type", type "Web SDK".
7. Find the row labeled "Web SDK" (Two-factor authentication for web applications via Universal Prompt) and click the "Protect" button on the right.
8. On the application details page:
   a. Locate the "Details" card. Copy and securely record:
      - Client ID
      - Client secret
      - API hostname
   b. Scroll down to the "Settings" card:
      - In the "Name" input, set the value to "SongNodes Web App".
      - In "Redirect URLs", input:
        https://song.aiwfe.com/api/v1/auth/duo/callback
        http://127.0.0.1:8082/api/v1/auth/duo/callback
   c. Verify that the "Universal Prompt" status card shows "Universal Prompt ready" with a green indicator.
   d. Scroll to the bottom and click "Save Changes".
9. In the left sidebar, click "Users".
10. Click "Add User". Enter username "{DJ_USERNAME}" (e.g. markus) and click "Add User".
11. On the user profile page, click "Add Phone", enter phone number "{PHONE_NUMBER}", and select "Add Phone".
12. Click "Send Enrollment SMS" or copy the generated activation link.
13. Return output with Client ID, API hostname, and confirmation that Web SDK application is saved.
```

### Prompt B: Cloudflare Zero Trust Dashboard Automation Prompt
```text
Task: Set up Cloudflare Tunnel and Access Application for song.aiwfe.com.

Target URL: https://one.dash.cloudflare.com
Credentials Needed: CLOUDFLARE_EMAIL, CLOUDFLARE_PASSWORD, DUO_SSO_DETAILS

Instructions:
1. Navigate to https://one.dash.cloudflare.com.
2. Sign in with Cloudflare Zero Trust account. Select your Zero Trust organization/account.
3. In the left navigation menu, expand "Networks" and click "Tunnels".
4. Click "Create a tunnel" (or "Add a tunnel").
5. Choose "Cloudflared" as the connector type and click "Next".
6. Name the tunnel "songnodes-tunnel" and click "Save tunnel".
7. Under "Install and run a connector", choose "Docker". Copy the command string containing the token:
   --token <TUNNEL_TOKEN>
   Extract and record the TUNNEL_TOKEN.
8. Click "Next" to navigate to the "Public Hostnames" tab.
9. Click "Add a public hostname":
   - Subdomain: "song"
   - Domain: select "aiwfe.com" from the dropdown
   - Path: leave blank
   - Service Type: "HTTP"
   - URL: "frontend:8080" (if running containerized) or "localhost:3006" (if running host dev)
10. Click "Save hostname".
11. In the left sidebar, navigate to "Access" -> "Applications".
12. Click "Add an application" -> select "Self-hosted".
13. Configure Application:
    - Application name: "SongNodes Production"
    - Session Duration: "24 hours"
    - Subdomain: "song"
    - Domain: "aiwfe.com"
14. Click "Next". In the "Policies" step:
    - Policy name: "Allow Admins"
    - Action: "Allow"
    - Under "Configure rules" -> Selector: "Emails" -> enter "{AUTHORIZED_EMAIL}".
15. Click "Next" -> review summary -> click "Add application".
16. Return output confirming tunnel creation, tunnel token, and active Access application for song.aiwfe.com.
```

---

## 8. Coding Agent Prompts for Codebase Implementation

### Prompt C: Backend Agent (FastAPI / Duo Web SDK v4 Integration)
```text
Role: FastAPI & Security Engineer
Task: Implement User Authentication and Cisco Duo Web SDK v4 (OIDC) Universal Prompt flow in SongNodes rest_api.

Context:
SongNodes is a music intelligence web application. REST services are located in services/rest_api/.
We need a production-grade authentication router exposing:
- POST /api/v1/auth/login: Accepts email/username and password. Verifies Argon2 hash against database or secure credential store. Generates Duo OIDC state and returns authorization URL.
- GET /api/v1/auth/duo/callback: Validates state and authorization code against Duo Token endpoint using Duo Client ID, Client Secret, and API Hostname.
- GET /api/v1/auth/me: Returns authenticated user profile and session state from secure HTTP-only JWT cookie.
- POST /api/v1/auth/logout: Clears session cookie and invalidates session in Redis.

Requirements:
1. Create services/rest_api/routers/user_auth.py with router prefix "/api/v1/auth".
2. Expose register(app) conforming to SongNodes router_registry convention.
3. Read environment variables:
   - DUO_CLIENT_ID
   - DUO_CLIENT_SECRET
   - DUO_API_HOSTNAME
   - DUO_REDIRECT_URI (defaults to https://song.aiwfe.com/api/v1/auth/duo/callback)
   - JWT_SECRET_KEY
4. Use standard library or authlib/aiohttp for OIDC code exchange. Do not compromise security.
5. Provide unit tests under tests/rest_api/test_user_auth.py.
```

### Prompt D: Frontend Agent (SongNodes Design-System Login & Auth Provider)
```text
Role: Frontend React/TypeScript Engineer
Task: Implement Design-System Compliant Login Page and Auth Context in SongNodes frontend.

Context:
SongNodes frontend is Vite + React + TypeScript in frontend/src/.
Design System rules must be strictly adhered to:
- Tokens only (sn-* classes, semantic colors, var(--sn-space-*)).
- No raw hex values, no emoji, no px font sizes.
- Use <Card>, <Button>, <Title>, <Input> from design system components.

Requirements:
1. Create frontend/src/features/auth/AuthContext.tsx providing:
   - user: { email: string, name: string } | null
   - isAuthenticated: boolean
   - isLoading: boolean
   - login(credentials) -> redirects to Duo Universal Prompt
   - logout() -> clears session
2. Create frontend/src/features/auth/LoginPage.tsx using design system cards and inputs.
3. Create route registration in frontend/src/features/auth/route.tsx following the G2 auto-registration convention.
4. Support automatic detection of Cloudflare Access headers if running behind Cloudflare Zero Trust.
5. Provide unit tests in frontend/src/features/auth/LoginPage.test.tsx.
```

---

## 9. Verification & Pre-Flight Checklist

Before putting `https://song.aiwfe.com` into production:
- [ ] DNS for `aiwfe.com` is active on Cloudflare with proxy enabled (orange cloud).
- [ ] `cloudflared` tunnel connector is running and displays healthy status in Cloudflare Zero Trust dashboard.
- [ ] Cisco Duo Admin dashboard displays Web SDK / SSO application status as "Universal Prompt ready".
- [ ] Duo Mobile app is installed on phone and enrolled for the test user.
- [ ] Testing login flow:
  1. Open private browsing window and navigate to `https://song.aiwfe.com`.
  2. Verify redirect to Duo authentication prompt.
  3. Enter credentials and confirm push notification arrives on mobile device.
  4. Approve push notification and verify seamless redirection to SongNodes dashboard.
  5. Check network inspection tab to verify `CF_Authorization` cookie is set and secure.
