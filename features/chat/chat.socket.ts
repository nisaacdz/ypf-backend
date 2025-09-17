import { Server as SocketIOServer, Socket } from "socket.io";
import { Content } from "@google/generative-ai";
import llmConfig from "../../configs/llm";

export const initializeChat = (io: SocketIOServer) => {
  io.on("connection", async (socket: Socket) => {
    console.log("Client connected. ID:", socket.id);

    let currentDebounceTimer: NodeJS.Timeout | undefined;
    let messageBuffer: string[] = [];

    const messagesQueries = socket.handshake.query.messages;

    let messages: Content[] = [];
    if (typeof messagesQueries === "string" && messagesQueries.length > 0) {
      try {
        const parsedMessages = JSON.parse(messagesQueries);
        if (Array.isArray(parsedMessages)) {
          messages = parsedMessages;
        } else {
          console.warn(
            "Parsed messages from handshake query is not an array:",
            parsedMessages,
          );
        }
      } catch (error) {
        console.error(
          "Failed to parse messages from handshake query:",
          messagesQueries,
          error,
        );
      }
    }

    const chatHistoryWithContext = [...llmConfig.initialContext, ...messages];

    const chat = llmConfig.model.startChat({
      generationConfig: llmConfig.generationConfig,
      safetySettings: llmConfig.safetySettings,
      history: chatHistoryWithContext,
    });

    const isSilentBotResponse = (responseText: string): boolean => {
      const trimmedText = responseText.trim();
      if (trimmedText.length === 0) {
        return true;
      }
      if (trimmedText.startsWith("/*") && trimmedText.endsWith("*/")) {
        return true;
      }
      return false;
    };

    const initialResponse = await chat.sendMessage(
      `Infer if it is your turn to respond from the chat history.`,
    );
    const initialResponseText = initialResponse.response.text();

    if (!isSilentBotResponse(initialResponseText)) {
      socket.emit("botMessage", { message: initialResponseText });
    }

    socket.on("sendMessage", async (data: { message: string }) => {
      const incomingMessage = data.message.trim();
      messageBuffer.push(incomingMessage);

      if (incomingMessage.length === 0) {
        return;
      }

      if (currentDebounceTimer) {
        clearTimeout(currentDebounceTimer);
      }

      currentDebounceTimer = setTimeout(async () => {
        if (messageBuffer.length === 0) {
          currentDebounceTimer = undefined;
          return;
        }

        try {
          socket.emit("botReplying", { replying: true });

          const result = await chat.sendMessage(messageBuffer.splice(0));
          const response = result.response;
          const botMessageText = response.text();

          if (!isSilentBotResponse(botMessageText)) {
            socket.emit("botMessage", { message: botMessageText });
          }
        } catch (error) {
          console.error(
            "Error calling Gemini API for socket",
            socket.id,
            ":",
            error,
          );
          let errorMessage = "Sorry, I encountered an error.";
          if (error instanceof Error) {
            const gError = error as any;
            if (
              gError.message &&
              gError.message.includes("API key not valid")
            ) {
              errorMessage =
                "Sorry, there seems to be an issue with the bot configuration.";
            } else if (gError.message && gError.message.includes("quota")) {
              errorMessage =
                "Sorry, the bot is currently experiencing high demand. Please try again later.";
            }
          }
          socket.emit("botMessage", { message: errorMessage });
        } finally {
          currentDebounceTimer = undefined;
          socket.emit("botReplying", { replying: false });
        }
      }, llmConfig.interactionDelay);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected. ID:", socket.id);
      if (currentDebounceTimer) {
        clearTimeout(currentDebounceTimer);
        currentDebounceTimer = undefined;
      }
      messageBuffer = [];
    });
  });
};
