/**
 * Simulated Email Service
 * 
 * In a real application, this would send emails via SMTP or an API.
 * This implementation includes a realistic delay to simulate network latency.
 */

const sendConfirmation = async ({ orderId, to, subject, order }) => {
    const delay = 300 + Math.random() * 500;
    await new Promise(resolve => setTimeout(resolve, delay));

    console.log(`[Email Service] Sent order confirmation for #${orderId} to ${to} (${Math.round(delay)}ms)`);
    return true;
};

module.exports = {
    sendConfirmation
};
