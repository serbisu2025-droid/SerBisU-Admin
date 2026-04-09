import { NextRequest, NextResponse } from "next/server";

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json(
                { success: false, error: "Token is required" },
                { status: 400 }
            );
        }

        if (!RECAPTCHA_SECRET_KEY) {
            console.error("RECAPTCHA_SECRET_KEY is not configured");
            return NextResponse.json(
                { success: false, error: "reCAPTCHA is not configured" },
                { status: 500 }
            );
        }

        // Verify token with Google
        const verifyResponse = await fetch(RECAPTCHA_VERIFY_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
        });

        const verifyData = await verifyResponse.json();

        console.log("reCAPTCHA verification result:", {
            success: verifyData.success,
            score: verifyData.score,
            action: verifyData.action,
            hostname: verifyData.hostname,
        });

        // Check if verification was successful
        if (!verifyData.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "reCAPTCHA verification failed",
                    errorCodes: verifyData["error-codes"],
                },
                { status: 400 }
            );
        }

        // Check score (0.0 = bot, 1.0 = human)
        // Recommended threshold: 0.5
        const score = verifyData.score || 0;
        const threshold = 0.5;

        if (score < threshold) {
            console.warn(`Low reCAPTCHA score: ${score} (threshold: ${threshold})`);
            return NextResponse.json(
                {
                    success: false,
                    error: "Suspicious activity detected",
                    score,
                },
                { status: 403 }
            );
        }

        // Success!
        return NextResponse.json({
            success: true,
            score,
            action: verifyData.action,
        });
    } catch (error) {
        console.error("Error verifying reCAPTCHA:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
