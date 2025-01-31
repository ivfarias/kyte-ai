import { queryEmbeddings, getLastConversation, setLastConversation } from "../services/queryService.js";
import { sendMessageToWhatsApp, markMessageAsRead } from "../services/whatsappService.js";
import { collectFeedback } from "../services/feedbackService.js";
import { detectLanguage } from "../services/languageService.js";

// Use a Set to track processed message IDs
const processedMessages = new Set();

/**
 * Sends a feedback request to the user after a delay.
 * @param {string} userId - The user's ID.
 * @param {string} language - The user's language.
 */
function sendFeedbackRequestAfterDelay(userId, language) {
  setTimeout(async () => {
    try {
      console.log(`Attempting to send feedback request to user: ${userId}`);
      await collectFeedback(userId, language);
      console.log(`Feedback request sent successfully to user: ${userId}`);
    } catch (error) {
      console.error("Error sending feedback request:", error);
    }
  }, 10 * 60 * 1000); // 10 minutes delay
}

/**
 * Handles incoming WhatsApp messages.
 * @param {object} body - The incoming request body from WhatsApp.
 */
export async function handleIncomingMessage(body) {
  console.log("Entering handleIncomingMessage");
  try {
    // Check if this is a status update
    if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
      handleStatusUpdate(body);
      return;
    }

    // Validate incoming message structure
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || message.type !== "text") {
      console.error("Invalid or unsupported message format");
      return;
    }

    const messageId = message.id;
    const userMessage = message.text.body;
    const userId = message.from;

    console.log(`Processing message: ${messageId} from user: ${userId}`);

    // Check if the message has already been processed
    if (processedMessages.has(messageId)) {
      console.log(`Message ${messageId} has already been processed. Skipping.`);
      return;
    }

    // Add the message ID to the set of processed messages
    processedMessages.add(messageId);

    console.log(`Received message: "${userMessage}"`);

    let userLanguage, lastConversation;
    try {
      userLanguage = await detectLanguage(userMessage);
      console.log(`Detected user language: ${userLanguage}`);
      lastConversation = getLastConversation(userId); // Get last conversation from cache
      console.log(`Retrieved last conversation for user: ${userId}`);
    } catch (error) {
      console.error("Error in language detection or getting last conversation:", error);
      userLanguage = 'pt'; // Default to Portuguese
      lastConversation = null;
    }

    try {
      // Query the AI embeddings for a response (with conversation history)
      const aiResponse = await queryEmbeddings(userMessage, {
        language: userLanguage,
        context: lastConversation // Pass last conversation as context
      });
      console.log(`AI Response: "${aiResponse.answer}"`);

      // Send the AI response to WhatsApp
      await sendMessageToWhatsApp(userId, aiResponse.answer);
      console.log(`Message sent to user: ${userId}`);

      // Mark the message as read
      await markMessageAsRead(messageId);
      console.log(`Message marked as read: ${messageId}`);

      // Update the last conversation for this user in the cache
      setLastConversation(userId, {
        query: userMessage,
        response: aiResponse.answer
      });
      console.log(`Updated last conversation for user: ${userId}`);

      // Send feedback request after delay
      sendFeedbackRequestAfterDelay(userId, userLanguage);
      console.log(`Scheduled feedback request for user: ${userId}`);

      // Remove the message ID from the set after processing
      processedMessages.delete(messageId);
      console.log(`Message ${messageId} removed from processed messages set.`);
    } catch (error) {
      console.error("Error processing WhatsApp message:", error);
      await sendMessageToWhatsApp(
        userId,
        "I'm experiencing technical difficulties. Please try again later."
      );
      console.log(`Error message sent to user: ${userId}`);

      // Remove the message ID from the set in case of error
      processedMessages.delete(messageId);
      console.log(`Message ${messageId} removed from processed messages set due to error.`);
    }
  } catch (error) {
    console.error("Unexpected error in handleIncomingMessage:", error);
  }
  console.log("Exiting handleIncomingMessage");
}

/**
 * Handles WhatsApp message status updates.
 * @param {object} body - The incoming request body from WhatsApp.
 */
function handleStatusUpdate(body) {
  const status = body.entry[0].changes[0].value.statuses[0];
  console.log(`Message status update: ${status.id} - ${status.status}`);
}