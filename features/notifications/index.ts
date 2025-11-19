import { Server as SocketIOServer } from "socket.io";

export function registerNotificationNamespace(io: SocketIOServer) {
  const notifNsp = io.of("/notifications");

  notifNsp.use((socket, next) => {
    if (!socket.request.User) {
      return next(new Error("Guests cannot subscribe to notifications"));
    }
    next();
  });

  notifNsp.on("connection", (socket) => {
    socket.join(`user:${socket.request.User!.id}`);
  });
}
