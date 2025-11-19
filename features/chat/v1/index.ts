import { Server, Socket } from "socket.io";
import logger from "@/configs/logger";

export default function registerChatNamespace(io: Server) {
    const chatNamespace = io.of("/chat");

    chatNamespace.on("connection", (socket: Socket) => {
        // The user is attached to the request object by the auth middleware
        const user = socket.request.User;
        
        socket.join(`user:${user?.id}`);

        socket.on("disconnect", () => {
            logger.info(`User disconnected from chat: ${user?.fullName}`);
        });
    });
}
