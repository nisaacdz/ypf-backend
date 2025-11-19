import registerChatNamespace from "@/features/chat/v1";
import { registerNotificationNamespace } from "@/features/notifications";
import { Server as SocketIOServer } from "socket.io";

class Ws {
    private ioServer: SocketIOServer | undefined = undefined;

    initialize(io: SocketIOServer) {
        this.ioServer = this.ioServer ?? io;
    }

    get io() {
        if (!this.ioServer) throw new Error("socketio server not initialized");
        return this.ioServer;
    }
    
    sendNotification(userId: string, title: string, message: string) {
        this.io.of("/notifications").to(`user:${userId}`).emit("notification", { title, message });
    }
}

const ws = new Ws();

export default ws;