# Notification Feature Guide

This guide explains how to integrate with the Real-time Notification system using Socket.IO.

## Overview

The backend exposes a Socket.IO server that allows authenticated users to receive real-time notifications. The system uses the same authentication mechanism (HTTP-only cookies) as the REST API.

## Connection Details

- **Namespace**: `/notifications`
- **Authentication**: Automatic via HTTP-only cookies (`access_token`).

### Critical Requirements

To successfully connect and authenticate, your Socket.IO client **MUST** be configured with the following options:

1.  **Transports**: You must explicitly set the transports to `['polling', 'websocket', 'webtransport']` (or at least start with `polling`).
    - _Reason_: The authentication middleware runs on the HTTP handshake request. Starting with `polling` ensures the browser sends the cookies with the initial request. Pure `websocket` transport might not send cookies in the same way depending on the client/browser environment, or might bypass the middleware chain if not configured correctly on the server (though our server handles it, polling is the most reliable way to establish the session).
2.  **Credentials**: You must set `withCredentials: true` (or `credentials: true` depending on the client version).
    - _Reason_: This tells the browser to include cookies in the cross-origin request (if your frontend is on a different domain/port).

## Client-Side Example (Socket.IO Client)

```javascript
import { io } from "socket.io-client";

// Replace with your backend URL
const BACKEND_URL = "http://localhost:3000";

const socket = io(`${BACKEND_URL}/notifications`, {
  // 1. Force polling first to ensure cookies are sent in the handshake
  transports: ["polling", "websocket"],

  // 2. Include cookies in the request
  withCredentials: true,

  // Optional: Auto-connect settings
  autoConnect: true,
});

socket.on("connect", () => {
  console.log("Connected to notifications!");
});

socket.on("connect_error", (err) => {
  console.error("Connection failed:", err.message);
  // Common errors:
  // - "xhr poll error": CORS or Network issue
  // - "Please log in to get access": Auth cookie missing or invalid
});

// Listen for notifications
socket.on("notification", (data) => {
  console.log("New Notification:", data);
  // data structure: { id: string, type: string, title: string, message: string, createdAt: Date, isRead: boolean }
});
```
