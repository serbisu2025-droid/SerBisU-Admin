"use server";

const SEMAPHORE_API_KEY = "19d2c681c1cde2ba78bb39a8174e444a";

export async function sendSMSAction(numbers: string, message: string) {
    try {
        if (!numbers || !message) {
            return { error: 'Missing numbers or message' };
        }

        const response = await fetch("https://semaphore.co/api/v4/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                apikey: SEMAPHORE_API_KEY,
                number: numbers,
                message: message
            })
        });

        const result = await response.json();

        if (response.ok) {
            return { success: true, result };
        } else {
            console.error('Semaphore API Failed:', response.status, result);
            return { error: 'Failed to send SMS via Semaphore', details: result };
        }
    } catch (error: any) {
        console.error('Server Action SMS Error:', error);
        return { error: 'Internal server error', details: error.message };
    }
}
