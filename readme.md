# 👥 Work Management System (WSM)

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

## 📌 Overview

The **Attendance Management System** is a comprehensive, full-stack solution designed to streamline HR workflows, digitize time tracking, and simplify leave request management. Built with modern web technologies, it provides secure, role-based access control with tailored features for **Admins**, **Managers**, and **Employees**.

## ✨ Key Features

- **Role-Based Access Control (RBAC):** Distinct portals and capabilities for different user roles.
- **Real-Time Attendance Tracking:** Secure check-in/check-out mechanisms.
- **Leave Management Workflow:** Multi-tier approval system for leave requests (Employee ➡️ Manager ➡️ Admin).
- **Automated Leave Accrual:** Scheduled cron jobs automatically calculate and allocate leave days.
- **Internal Announcements:** Admins can publish news and updates directly to employee dashboards.

## 🛠 Tech Stack

- **Frontend:** ReactJS, Tailwind CSS
- **Backend:** Express.js (Node.js)
- **Database:** MongoDB
- **Infrastructure:** Docker & Docker Compose

---

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing purposes.

### Prerequisites

Ensure you have the following installed on your local machine:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Required to run the containerized environment)
- [MongoDB Compass](https://www.mongodb.com/products/tools/compass) (Optional, but recommended for visually managing the database)

### Installation & Setup

**1. Boot up the environment**  
Start the application and its database using Docker Compose:
```bash
docker compose up --build
```
*The frontend, backend, and database will be orchestrated automatically.*

---

## ⚙️ Administrative Scripts

The system comes with several utility scripts to ease setup and testing. Run these from your terminal while the Docker containers are active.

### Initialize Admin Account
Setup the default system administrator.
- **Username:** `admin`
- **Password:** `123123`

```bash
docker compose exec server node src/utils/setupAdmin.js
```

### Manual Leave Days Calculation
While the system features an automated cron job for leave management, you can trigger the calculation manually at any time:

```bash
docker compose exec server node src/utils/calculateLeaveDays.js
```

### Seed Mock Attendance Data
Populate the database with mock attendance records for non-admin employees (spanning from June 2025 to the present day) to facilitate testing.

```bash
docker compose exec server node src/utils/seedAttendance.js
```

---

## 📝 User Testing Flows

If you are testing the system, follow these standard operational procedures:

### 1. Master Setup
1. Log in with the **Admin** account.
2. Navigate to **Department Management** to create organizational units (e.g., Board of Directors, Engineering Division).
3. Navigate to **Employee Management** to onboard new users and assign them to their respective departments.
4. Assign managers to these departments to enable the approval hierarchy.

### 2. Leave Request Cycle
1. **Employee:** Logs in and submits a leave request.
2. **Manager:** Logs in, reviews, and initially approves the subordinate's request.
3. **Executive/Admin:** Logs in for the final approval.

### 3. Daily Attendance
1. Employees use the **Check-in** and **Check-out** actions from their Dashboard.
2. Users can review their personal logs in the **Work Schedule** tab.
3. Admins have global visibility over all attendance records.
