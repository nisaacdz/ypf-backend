// import {
//   GoogleGenerativeAI,
//   HarmCategory,
//   HarmBlockThreshold,
//   Content,
// } from "@google/generative-ai";
// import variables from "@/configs/var";
// import fs from "fs";
// import path from "path";

// const genAI = new GoogleGenerativeAI(variables.geminiApiKey);
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// const generationConfig = {
//   temperature: 0.9,
//   topK: 1,
//   topP: 1,
//   maxOutputTokens: 2048,
// };

// const safetySettings = [
//   {
//     category: HarmCategory.HARM_CATEGORY_HARASSMENT,
//     threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//   },
//   {
//     category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
//     threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//   },
//   {
//     category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
//     threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//   },
//   {
//     category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
//     threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//   },
// ];

// const contextFilePath = path.resolve(__dirname, "./context.md");
// const llmContextText = fs.readFileSync(contextFilePath, "utf-8");

// const initialFileContextHistory: Content[] = [
//   {
//     role: "user",
//     parts: [
//       {
//         text: `User enters the webpage. Do nothing`,
//       },
//     ],
//   },
// ];

// const INTERACTION_DELAY_MS = 3000;

// const llmConfig = {
//   model,
//   generationConfig,
//   safetySettings,
//   interactionDelay: INTERACTION_DELAY_MS,
//   initialContext: initialFileContextHistory,
// };

// export default llmConfig;
