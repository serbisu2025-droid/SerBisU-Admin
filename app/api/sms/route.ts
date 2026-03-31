import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

const SEMAPHORE_API_KEY = "19d2c681c1cde2ba78bb39a8174e444a";

export async function POST(request: Request) {
    try {
        const { numbers, message } = await request.json();

        if (!numbers || !message) {
            return NextResponse.json({ error: 'Missing numbers or message' }, { status: 400 });
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

        let result;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            result = await response.json();
        } else {
            result = { raw: await response.text() };
        }

        if (response.ok) {
            return NextResponse.json(result);
        } else {
            console.error('Semaphore API Failed:', response.status, result);
            return NextResponse.json({ 
                error: 'Failed to send SMS via Semaphore', 
                status: response.status,
                details: result 
            }, { status: response.status });
        }
    } catch (error: any) {
        console.error('API SMS Internal Error:', error);
        return NextResponse.json({ 
            error: 'Internal server error', 
            details: error.message 
        }, { status: 500 });
    }
}
