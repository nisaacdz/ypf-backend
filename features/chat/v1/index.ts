import { Server as SocketIOServer, Socket } from "socket.io";
import { Content } from "@google/generative-ai";
import llmConfig from "@/configs/llm";

export const initializeChat = (io: SocketIOServer) => {
  io.on("connection", async (socket: Socket) => {
    console.log("Client connected. ID:", socket.id);

    let messageBuffer: string[] = [];

    const messagesQueries = socket.handshake.query.messages;

    let messages: Content[] = [];

    const chatHistoryWithContext = [...llmConfig.initialContext, ...messages];

    const chat = llmConfig.model.startChat({
      generationConfig: llmConfig.generationConfig,
      safetySettings: llmConfig.safetySettings,
      history: chatHistoryWithContext,
    });

    const initialResponse = await chat.sendMessage(
      `Infer if it is your turn to respond from the chat history.`
    );
    const initialResponseText = initialResponse.response.text();

    // if (!isSilentBotResponse(initialResponseText)) {
    //   socket.emit("botMessage", { message: initialResponseText });
    // }

    socket.on("sendMessage", async (data: { message: string }) => {});

    socket.on("disconnect", () => {
      console.log("Client disconnected. ID:", socket.id);
      messageBuffer = [];
    });
  });
};
