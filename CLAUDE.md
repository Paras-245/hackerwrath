# Antigravity Development Prompt — Reboot

## 1. Project Overview

Build **Reboot**, a minimal, self-hosted web dashboard that gives old hardware a second life by turning it into useful infrastructure.

**Tagline:** *Old hardware. New purpose.*

Reboot is a hackathon MVP, not a production infrastructure platform. It should demonstrate how multiple existing devices can work together as a small, distributed home lab.

### Existing hardware setup

1. **PS4 running Linux**
   - Used as a lightweight VPS.
   - Intended for hosting applications, websites, and other self-hosted services.

2. **Debian laptop**
   - Runs Frigate NVR.
   - Processes camera footage locally.
   - Can also host the Reboot dashboard.

3. **Rooted Android phone running Kali NetHunter**
   - Has a broken screen.
   - Repurposed as a camera connected to Frigate.
   - Acts as an example of otherwise discarded hardware being put to use.

These devices are initially configured separately. Reboot should provide one central interface for accessing and using them.

## 2. Core Requirements

Implement only these three features.

### Feature A: Deploy an application from GitHub

Create a simple deployment page where a user can provide:

- GitHub repository URL.
- Target device, selected from the devices configured in Reboot.
- Build or deployment command.

Example input:

Repository URL:
`https://github.com/example/my-app`

Target:
`PS4 Linux`

Build command:
`npm install && npm run build`

When the user clicks **Deploy**, the backend must:

1. Validate the repository URL.
2. Clone the repository into a temporary or dedicated deployment workspace.
3. Execute the provided command inside the cloned repository directory.
4. Run the command on the selected target device.
5. Stream command output and errors to the web interface.
6. Display deployment status: Queued, Running, Successful, or Failed.
7. Display the exit code and relevant error output when execution fails.
8. Allow the user to stop a running deployment where technically possible.

Use Git for repository cloning. Use SSH to execute deployment commands on remote devices. If the selected target is the machine running Reboot, local execution is allowed.

**Important distinction:** A build command does not necessarily deploy an application. For example, `npm run build` generates build artifacts but does not automatically start a web server. Make this clear in the interface. Allow commands such as `npm install && npm run build`, or `npm install && npm run build && npm run start`, depending on the user's intended workflow.

Do not implement a full deployment platform.

#### Deployment constraints

- Do not add authentication or user accounts.
- Do not add a database.
- Do not build a CI/CD pipeline.
- Do not implement automatic GitHub webhooks.
- Do not add deployment history persistence.
- Do not implement container orchestration.
- Do not invent a custom package manager.
- Do not attempt to deploy a repository just by opening its URL; explicitly execute the user's supplied command.
- Do not automatically expose deployed applications to the public internet.
- Do not automatically run `sudo` or execute commands as root.

Use temporary directories for deployment workspaces. Clearly indicate that deployment records and state are in-memory and may disappear after a restart.

### Feature B: Unified device dashboard

Create a page named **Devices** showing all configured hardware in one place.

Each device must have:

- Device name.
- IP address or hostname.
- Device type or operating system.
- Optional role or description.
- Connection status.
- A button to test connectivity.
- A button to open the device's web interface, when configured.

The user should be able to add a device using a small form containing:

- Device name.
- IP address or hostname.
- Device type.
- Optional SSH port.
- Optional web interface URL.
- Optional description.

Allow devices to be removed and edited during the current session.

#### Device status

Implement a basic connectivity check.

- For devices with SSH configured, attempt an SSH connection using the configured credentials or SSH keys.
- For devices with a web interface URL, perform an HTTP health check.
- For devices without SSH or HTTP, provide a basic network reachability check when supported by the operating system.
- Display `Online`, `Offline`, or `Unknown` as appropriate.

Do not claim a device is offline simply because it blocks ICMP ping. Use the available connection checks and report when connectivity could not be verified.

Refresh status periodically while the dashboard is open, and allow manual refresh.

The device list must work with arbitrary hardware, not only the three devices listed in this prompt.

#### Initial demo devices

Make it easy to configure these devices:

| Device | Role | Purpose |
|---|---|---|
| PS4 Linux | Compute node | Host applications and websites |
| Debian Laptop | NVR / Management | Runs Frigate and potentially Reboot |
| Android NetHunter | Camera node | Supplies video to Frigate |

Do not hardcode fictional IP addresses or show fake online statuses. If these devices have not been configured, show a helpful empty state or setup instructions.

The initial devices may be offered as optional demo presets, but the user must supply their actual addresses.

### Feature C: Frigate integration

Create a dedicated **Frigate** page or navigation tab.

Its purpose is to open the existing Frigate interface, not recreate it.

Requirements:

- Allow the user to configure a Frigate base URL, such as `http://192.168.1.50:5000`.
- Provide an obvious **Open Frigate** button.
- Display the configured URL.
- If practical, show a simple availability indicator using an HTTP health check.
- Open the Frigate interface in a new browser tab.

Do not build another camera viewer.
Do not proxy or process camera streams.
Do not duplicate Frigate's recordings, events, detection settings, or live-view interface.
Do not build another NVR.

Frigate already has its own dedicated interface. Reboot simply provides a unified entry point.

If an embedded iframe is attempted, retain the external-link fallback because browser security policies may prevent embedding Frigate.

## 3. User Interface and Design

Use the design workflow requested by the project owner:

`npx getdesign@latest add mobbin`

Run this command as directed by the installed tool's documentation, inspect its output, and use the resulting design resources or components where appropriate.

Do not blindly overwrite the project configuration. If the command fails or requires an interactive choice, inspect the error and resolve it appropriately. Do not invent APIs or assume the package provides a specific component library.

### Visual direction

Build a clean, modern, understated dashboard inspired by high-quality developer tools and infrastructure dashboards.

The UI should communicate that Reboot is a unified control panel for repurposed hardware.

Design characteristics:

- Dark-first interface with a restrained neutral palette.
- Clear typography and generous spacing.
- Minimal borders and subtle card backgrounds.
- Small, consistent status indicators.
- Clean navigation and obvious primary actions.
- Responsive layout for desktop and mobile.
- Avoid excessive gradients, glow effects, oversized headings, and decorative animations.
- Avoid excessive charts, statistics, and empty dashboard cards.
- Use icons consistently and avoid emojis as primary interface icons.

### Application layout

Use a simple persistent sidebar on desktop.

Sidebar:

- Reboot logo and name.
- Overview.
- Devices.
- Deployments.
- Frigate.
- Small footer label: `Self-hosted · Local-first`.

On mobile, collapse the sidebar into a simple navigation drawer or compact navigation bar.

### Overview page

The landing page should immediately explain the state of the setup.

Include:

1. A concise heading: `Your hardware, working together.`
2. A short subtitle explaining that Reboot brings repurposed devices into one manageable system.
3. A device summary showing configured, online, and offline/unknown counts.
4. A compact list of configured devices.
5. A Frigate shortcut.
6. A primary action to deploy an application.

Do not display fake CPU usage, RAM usage, uptime, storage consumption, or other telemetry that the backend does not collect.

If actual telemetry is not implemented, do not show it.

### Devices page

Display devices as compact cards or rows.

Each item should show its name, IP address, role, operating system/type, status, and relevant actions.

Provide an `Add device` button that opens a small modal or form.

Include useful empty states, form validation, and error messages.

### Deployments page

Keep the deployment interface straightforward.

Include:

- Repository URL input.
- Target device selector.
- Command input.
- Deploy button.
- Live log output in a terminal-like panel.
- Current execution status.
- Exit code and error details when applicable.

Use a monospaced font for terminal output. Automatically scroll to new log lines unless the user has manually scrolled upward.

Disable duplicate submissions while a deployment is running.

Make the command and target explicit before execution. Do not hide potentially destructive commands behind ambiguous buttons.

### Frigate page

Display a compact Frigate service card with its configured URL, optional availability status, and `Open Frigate` action.

Keep this page intentionally simple.

## 4. Recommended Technical Architecture

Use a small full-stack application.

### Frontend

Preferred stack:

- React.
- TypeScript.
- Vite.
- Tailwind CSS, if compatible with the design setup.
- A lightweight icon library such as Lucide.

Use a small number of reusable components.

Avoid a large component framework if it adds unnecessary dependencies.

### Backend

Use Node.js with TypeScript and Express.

The backend is responsible for:

- Device configuration in memory.
- Connectivity checks.
- Deployment orchestration.
- Git repository cloning.
- Command execution.
- SSH connections to remote devices.
- Streaming logs to the frontend.
- Frigate URL configuration and health checks.

Use Server-Sent Events (SSE) for live deployment logs if practical. Otherwise, use a simple WebSocket implementation only if necessary.

### Persistence

There must be no database.

Do not add SQLite, PostgreSQL, MongoDB, Redis, or an ORM.

Keep devices, configuration, active deployment state, and deployment logs in memory. Configuration can reset when the backend restarts.

Temporary deployment files may exist on disk while a deployment runs, but should be cleaned up when safe.

Do not add localStorage or IndexedDB as an alternative persistence layer.

### Suggested project structure

Keep the structure compact:

```text
reboot/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.ts
│   └── package.json
├── package.json
├── README.md
└── .gitignore
```

Adjust the structure only when necessary. Do not generate unnecessary abstractions or dozens of tiny files.

## 5. Backend API

Create only the endpoints needed by the MVP.

Suggested endpoints:

```text
GET    /api/health

GET    /api/devices
POST   /api/devices
PATCH  /api/devices/:id
DELETE /api/devices/:id
POST   /api/devices/:id/check

POST   /api/deployments
GET    /api/deployments/:id
GET    /api/deployments/:id/logs
POST   /api/deployments/:id/stop

GET    /api/frigate
PUT    /api/frigate
GET    /api/frigate/status
```

Use SSE for the log endpoint if convenient.

Validate all input server-side. Return appropriate HTTP status codes and readable error messages.

Keep API responses simple and typed.

## 6. Deployment Implementation Details

Implement a working end-to-end deployment flow.

### Local target

When the target is the Reboot host:

1. Create a unique temporary workspace.
2. Clone the repository into that workspace.
3. Execute the supplied command with the repository directory as its working directory.
4. Stream stdout and stderr.
5. Capture the process exit code.
6. Report success or failure.
7. Clean up temporary files when safe.

### Remote target

When the target is another configured device:

1. Validate that the target has SSH deployment configured.
2. Connect using SSH keys or another explicitly configured SSH authentication method.
3. Clone the repository on the target device, or transfer the source if that is necessary for the implementation.
4. Execute the command on the target in the cloned repository directory.
5. Stream remote output to the browser.
6. Capture the exit code and report the final status.
7. Clean up temporary files when safe.

Prefer cloning directly on the target device to avoid unnecessarily transferring source files.

Do not assume that an IP address alone is enough to establish an SSH connection. The UI must explain how SSH access is configured.

Do not silently reuse the backend's local SSH credentials for every device without clearly defining the configuration.

If SSH is not configured, disable remote deployment for that device and explain what is missing.

### Security requirements

This is a trusted local-network hackathon MVP without user authentication. However, executing arbitrary commands creates significant risk.

Implement the minimum protections required for a safe demonstration:

- Bind the server to localhost by default, or clearly document the risks before exposing it to a network.
- Validate GitHub repository URLs and reject unsupported schemes.
- Prevent command execution through shell string interpolation of untrusted fields.
- Execute commands with explicit working directories and appropriate timeouts.
- Never run deployment commands as root by default.
- Never expose private SSH keys or environment variables in logs or API responses.
- Never allow arbitrary client-supplied filesystem paths.
- Limit deployment output and process lifetime.
- Provide a stop mechanism for active processes.
- Reject invalid device targets and prevent path traversal.
- Do not build a general-purpose remote shell or terminal.

The user-supplied build command is inherently powerful. Keep the application restricted to the intended trusted environment.

## 7. Device Management Details

Keep device management generic.

A device should have a stable in-memory ID and a small data structure containing its name, host, type, role, optional SSH settings, and optional web URL.

Do not hardcode credentials.

Do not automatically scan the entire local network.

Do not attempt to install agents or software on devices.

Do not assume all devices support SSH.

Use connectivity methods appropriate to the device and show the result honestly.

If the Net