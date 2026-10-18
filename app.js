console.log("CCS VSN30 app.js loaded");

// =====================================================
// SUPABASE CONNECTION
// =====================================================

const SUPABASE_URL =
    "https://kuiyxvswxgirrhicvtlz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_sUWQu73cl3ZUm1LXthepCg_PQCw8aPi";

let supabaseClient = null;

let registrationData = {};
let resetData = {};
let currentProfile = null;

let selectedContributionMethod = null;


// =====================================================
// PAGE START
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log("DOM loaded");

        if (window.supabase) {

            supabaseClient =
                window.supabase.createClient(
                    SUPABASE_URL,
                    SUPABASE_PUBLISHABLE_KEY
                );

            console.log("Supabase connected");

        } else {

            console.error(
                "Supabase library not loaded"
            );

        }

        showScreen("welcomeScreen");

    }
);


// =====================================================
// SCREEN NAVIGATION
// =====================================================

function showScreen(screenId) {

    const screens =
        document.querySelectorAll(".screen");

    screens.forEach(
        function (screen) {

            screen.classList.remove("active");

        }
    );

    const selectedScreen =
        document.getElementById(screenId);

    if (selectedScreen) {

        selectedScreen.classList.add("active");

    } else {

        console.error(
            "Screen not found:",
            screenId
        );

    }

}


// =====================================================
// PHONE VALIDATION
// Supports:
// 07XXXXXXXX
// 01XXXXXXXX
// 2547XXXXXXXX
// 2541XXXXXXXX
// +2547XXXXXXXX
// +2541XXXXXXXX
// =====================================================

function isValidPhone(phone) {

    if (!phone) {
        return false;
    }

    const cleaned =
        phone
            .replace(/\s+/g, "")
            .replace(/-/g, "");

    return /^(?:\+254|254|0)(?:7|1)\d{8}$/.test(
        cleaned
    );

}


// =====================================================
// NORMALIZE PHONE NUMBER
// =====================================================

function normalizePhone(phone) {

    if (!phone) {
        return "";
    }

    let cleaned =
        phone
            .replace(/\s+/g, "")
            .replace(/-/g, "");

    if (cleaned.startsWith("+254")) {

        return cleaned.substring(1);

    }

    if (cleaned.startsWith("0")) {

        return "254" +
            cleaned.substring(1);

    }

    return cleaned;

}


// =====================================================
// EMAIL VALIDATION
// =====================================================

function isValidEmail(email) {

    if (!email) {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );

}



  // =====================================================
// SIGN UP → SUBSCRIPTION
// Supports new users and existing confirmed accounts
// =====================================================

async function goToSubscription() {

    const fullName =
        document.getElementById("fullName").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

    const status =
        document.getElementById("signupStatus");

    const button =
        document.getElementById(
            "continueToSubscriptionButton"
        );

    function showSignupStatus(message, isError = true) {

        if (status) {
            status.textContent = message;
            status.style.color =
                isError ? "#ff6b6b" : "#22c55e";
        }
    }

    if (
        !fullName ||
        !phone ||
        !email ||
        !password ||
        !confirmPassword
    ) {
        showSignupStatus(
            "Please complete all required fields."
        );
        return;
    }

    if (!isValidPhone(phone)) {
        showSignupStatus(
            "Enter a valid Kenyan phone number."
        );
        return;
    }

    if (!isValidEmail(email)) {
        showSignupStatus(
            "Enter a valid email address."
        );
        return;
    }

    if (password !== confirmPassword) {
        showSignupStatus(
            "Your passwords do not match."
        );
        return;
    }

    if (password.length < 6) {
        showSignupStatus(
            "Your password must contain at least 6 characters."
        );
        return;
    }

    if (!supabaseClient) {
        showSignupStatus(
            "Supabase is not connected. Refresh and try again."
        );
        return;
    }

    const normalizedPhone = normalizePhone(phone);

    try {

        if (button) {
            button.disabled = true;
            button.textContent = "Checking account...";
        }

        showSignupStatus(
            "Checking your registration account...",
            false
        );

        let authenticated = false;
        let signupError = null;

        // -------------------------------------------------
        // FIRST: Try creating a new account.
        // -------------------------------------------------

        const signupResult =
            await supabaseClient.auth.signUp({

                email: email,

                password: password,

                options: {
                    data: {
                        full_name: fullName,
                        phone: normalizedPhone
                    }
                }

            });

        signupError = signupResult.error;

        if (
            !signupError &&
            signupResult.data &&
            signupResult.data.session
        ) {
            authenticated = true;
        }

        // -------------------------------------------------
        // SECOND: If signup did not create a session,
        // try signing in to the existing confirmed account.
        // -------------------------------------------------

        if (!authenticated) {

            if (button) {
                button.textContent =
                    "Checking existing account...";
            }

            const loginResult =
                await supabaseClient.auth.signInWithPassword({

                    email: email,

                    password: password

                });

            if (
                !loginResult.error &&
                loginResult.data &&
                loginResult.data.session
            ) {
                authenticated = true;
            } else {

                const loginError =
                    loginResult.error;

                if (
                    loginError &&
                    /email not confirmed/i.test(
                        loginError.message || ""
                    )
                ) {
                    showSignupStatus(
                        "Your email is not confirmed yet. " +
                        "Open your latest confirmation email before continuing."
                    );
                    return;
                }

                if (
                    signupError &&
                    /rate limit|email rate limit/i.test(
                        signupError.message || ""
                    )
                ) {
                    showSignupStatus(
                        "Supabase has temporarily limited registration emails. " +
                        "Your existing account may still be used. " +
                        "Please check your email and password, then try again later."
                    );
                    return;
                }

                showSignupStatus(
                    "We could not sign in or create an account. " +
                    "Check your email and password. If your account already exists, " +
                    "use its original password."
                );

                return;
            }
        }

        // -------------------------------------------------
        // THIRD: Store the registration details locally.
        // The authenticated Supabase user remains the
        // source of identity for database submissions.
        // -------------------------------------------------

        registrationData = {
            fullName: fullName,
            phone: normalizedPhone,
            email: email,
            role: "member"
        };

        localStorage.setItem(
            "ccsPendingRegistration",
            JSON.stringify(registrationData)
        );

        const mpesaPhone =
            document.getElementById("mpesaPhone");

        const subscriptionPhone =
            document.getElementById(
                "subscriptionPaymentPhone"
            );

        if (mpesaPhone) {
            mpesaPhone.value = normalizedPhone;
        }

        if (subscriptionPhone) {
            subscriptionPhone.value = normalizedPhone;
        }

        showSignupStatus(
            "Account verified. Continue to the KSh 100 registration payment.",
            false
        );

        showScreen("subscriptionScreen");

    } catch (error) {

        console.error(
            "CCS registration error:",
            error
        );

        showSignupStatus(
            error.message ||
            "Unable to continue registration."
        );

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent =
                "Continue to Subscription";
        }
    }
}   
// ================================================
// SUBSCRIPTION PAYMENT METHOD SELECTION
// ================================================

function selectSubscriptionMethod(method) {
const manualPanel = document.getElementById(
"manualSubscriptionPanel"
);

const stkPanel = document.getElementById(
    "stkSubscriptionPanel"
);

const manualButton = document.getElementById(
    "manualPaybillOption"
);

const stkButton = document.getElementById(
    "stkPushOption"
);

if (!manualPanel || !stkPanel) {
    console.error("Subscription payment panels were not found.");
    return;
}

manualPanel.style.display =
    method === "manual" ? "block" : "none";

stkPanel.style.display =
    method === "stk" ? "block" : "none";

if (manualButton) {
    manualButton.setAttribute(
        "aria-pressed",
        String(method === "manual")
    );
}

if (stkButton) {
    stkButton.setAttribute(
        "aria-pressed",
        String(method === "stk")
    );
}

const generalStatus = document.getElementById(
    "subscriptionRegistrationStatus"
);

if (generalStatus) {
    generalStatus.textContent = "";
}

}

// ================================================
// COPY SUBSCRIPTION PAYMENT DETAILS
// ================================================

async function copySubscriptionDetail(elementId) {
const field = document.getElementById(elementId);

if (!field) {
    return;
}

const value = field.value;

try {
    await navigator.clipboard.writeText(value);
    alert("Copied successfully: " + value);
} catch (error) {
    // Fallback for browsers where clipboard access is unavailable.
    field.focus();
    field.select();

    const copied = document.execCommand("copy");

    if (copied) {
        alert("Copied successfully: " + value);
    } else {
        alert("Please copy the displayed payment detail manually.");
    }
}

}
// =====================================================
// CCS VSN30 — CREATE REGISTRATION APPLICATION
// =====================================================

async function ensureRegistrationApplication(
    paymentMethod,
    transactionReference = null
) {

    if (!supabaseClient) {
        throw new Error(
            "Supabase is not connected."
        );
    }

    const allowedMethods = [
        "manual_paybill",
        "mpesa_stk"
    ];

    if (!allowedMethods.includes(paymentMethod)) {
        throw new Error(
            "Invalid registration payment method."
        );
    }

    // Get the authenticated Supabase user.
    const {
        data: userData,
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !userData || !userData.user) {
        throw new Error(
            "Please sign in before submitting your registration."
        );
    }

    const user = userData.user;

    const savedRegistration =
        registrationData &&
        registrationData.fullName
            ? registrationData
            : JSON.parse(
                localStorage.getItem(
                    "ccsPendingRegistration"
                ) || "{}"
            );

    const fullName =
        savedRegistration.fullName ||
        user.user_metadata?.full_name;

    const phone =
        savedRegistration.phone ||
        user.user_metadata?.phone;

    const email =
        user.email;

    if (!fullName || !phone || !email) {
        throw new Error(
            "Registration details are incomplete. " +
            "Please return to registration and check your details."
        );
    }

    // Check whether this user already has an application.
    const {
        data: existingApplication,
        error: lookupError
    } = await supabaseClient
        .from("registration_applications")
        .select(
    "id, status, payment_method, screenshot_path"
)
.eq("user_id", user.id)
.maybeSingle();

    if (lookupError) {
        console.error(
            "Registration application lookup failed:",
            lookupError
        );

        throw new Error(
            "Could not check your existing registration application."
        );
    }

    if (existingApplication) {

        if (existingApplication.status === "pending") {
            return {
                application: existingApplication,
                alreadyExists: true
            };
        }

        if (existingApplication.status === "approved") {
            throw new Error(
                "Your registration application is already approved. " +
                "Please sign in to your account."
            );
        }

        if (existingApplication.status === "rejected") {
            throw new Error(
                "Your previous registration application was rejected. " +
                "Please contact the administrator for assistance."
            );
        }

        throw new Error(
            "An existing registration application requires administrator review."
        );
    }

    // Create a pending application.
    // This does NOT verify payment or activate the account.
    const {
        data: newApplication,
        error: insertError
    } = await supabaseClient
        .from("registration_applications")
        .insert({
            user_id: user.id,
            full_name: fullName,
            phone: normalizePhone(phone),
            email: email,
            registration_amount: 100,
            payment_method: paymentMethod,
            transaction_reference:
                transactionReference || null,
            status: "pending"
        })
        .select(
    "id, status, payment_method, screenshot_path"
)
.single();

    if (insertError) {

        console.error(
            "Registration application insert failed:",
            insertError
        );

        throw new Error(
            "The registration application could not be submitted. " +
            "Please check your connection and try again."
        );
    }

    return {
        application: newApplication,
        alreadyExists: false
    };
}

// =====================================================
// START M-PESA SUBSCRIPTION PAYMENT
// =====================================================

async function startPayment() {

    const mpesaPhone =
        document
            .getElementById("mpesaPhone")
            ?.value
            .trim();

    const paymentStatus =
        document.getElementById("paymentStatus");

    function showPaymentStatus(message) {
        if (paymentStatus) {
            paymentStatus.textContent = message;
        }
    }

    if (!isValidPhone(mpesaPhone)) {
        showPaymentStatus(
            "Enter a valid Kenyan M-PESA phone number."
        );
        return;
    }

    if (!supabaseClient) {
        showPaymentStatus(
            "Supabase is not connected."
        );
        return;
    }

    try {

        showPaymentStatus(
            "Preparing your registration application..."
        );

        const normalizedPhone =
            normalizePhone(mpesaPhone);

        // Create or find the registration application first.
        const result =
            await ensureRegistrationApplication(
                "mpesa_stk"
            );

        if (result.alreadyExists) {

            showPaymentStatus(
                "A registration application already exists with status: " +
                result.application.status +
                ". Check with the administrator before submitting another payment."
            );

            return;
        }

        showPaymentStatus(
            "Application recorded. Requesting M-PESA payment..."
        );

        const {
            data,
            error
        } = await supabaseClient.functions.invoke(
            "mpesa-stk",
            {
                body: {
                    phone: normalizedPhone,
                    amount: 100
                }
            }
        );

        if (error) {

            console.error(
                "STK Push error:",
                error
            );

            throw new Error(
                error.message ||
                "Failed to send M-PESA request."
            );
        }

        console.log(
            "STK Push response:",
            data
        );

        if (data && data.success) {

            showPaymentStatus(
                "M-PESA request sent. Check your phone and follow the payment instructions. " +
                "Your account will remain inactive until payment is verified and your application is approved."
            );

        } else {

            showPaymentStatus(
                "The registration application was recorded, but the M-PESA request was not confirmed. " +
                "Do not assume payment succeeded. Check the payment service before retrying."
            );
        }

    } catch (error) {

        console.error(
            "CCS M-PESA registration error:",
            error
        );

        showPaymentStatus(
            error.message ||
            "Unable to start registration payment."
        );
    }
}


// =====================================================
// CCS VSN30 — MANUAL REGISTRATION PAYMENT
// =====================================================
async function submitManualSubscriptionPayment() {

const status = document.getElementById(
    "manualSubscriptionStatus"
);

const button = document.getElementById(
    "submitManualSubscriptionButton"
);

const phoneInput = document.getElementById(
    "subscriptionPaymentPhone"
);

const referenceInput = document.getElementById(
    "subscriptionTransactionReference"
);

const screenshotInput = document.getElementById(
    "subscriptionPaymentScreenshot"
);

if (status) status.textContent = "";

try {

    if (!supabaseClient) {
        throw new Error(
            "Supabase is not connected. Refresh the app and try again."
        );
    }

    const phone = phoneInput.value.trim();
    const reference = referenceInput.value.trim();

    if (!phone || !isValidPhone(phone)) {
        throw new Error(
            "Enter a valid Kenyan M-PESA phone number."
        );
    }

    if (!reference) {
        throw new Error(
            "Enter the M-PESA transaction code."
        );
    }

    const screenshot =
        screenshotInput.files &&
        screenshotInput.files.length > 0
            ? screenshotInput.files[0]
            : null;

    if (screenshot) {

        const allowedImageTypes = [
    "image/jpeg",
    "image/png"
];

if (!allowedImageTypes.includes(screenshot.type)) {
    throw new Error(
        "Please select a JPEG or PNG payment screenshot."
    );
}
        if (screenshot.size > 5 * 1024 * 1024) {
            throw new Error(
                "The screenshot must be 5 MB or smaller."
            );
        }
    }

    if (button) button.disabled = true;

    if (status) {
        status.textContent =
            "Submitting registration details...";
    }

   // Save or retrieve the registration application.
const registrationResult =
    await ensureRegistrationApplication(
        "manual_paybill",
        reference
    );

const application = registrationResult.application;

if (!application || !application.id) {
    throw new Error(
        "Could not retrieve the registration application ID."
    );
}

    let screenshotPath =
        application.screenshot_path || null;

    // Upload evidence only when a screenshot was selected
    // and the application does not already have one.
    if (screenshot && !screenshotPath) {

        if (status) {
            status.textContent =
                "Uploading payment screenshot...";
        }

        const {
            data: userData,
            error: userError
        } = await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        const userId = userData.user.id;

        const safeReference = reference
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .slice(0, 30);

        const extension = (
            screenshot.name.split(".").pop() || "jpg"
        ).toLowerCase().replace(/[^a-z0-9]/g, "");

        const filePath =
            userId + "/" +
            application.id + "/" +
            Date.now() + "_" +
            safeReference + "." +
            extension;

        const {
            error: uploadError
        } = await supabaseClient.storage
            .from("registration-payment-evidence")
            .upload(filePath, screenshot, {
                cacheControl: "3600",
                upsert: false,
                contentType: screenshot.type
            });

        if (uploadError) {
            throw uploadError;
        }

        screenshotPath = filePath;

const {
    data: pathSaved,
    error: updateError
} = await supabaseClient.rpc(
    "set_registration_screenshot_path",
    {
        p_application_id: application.id,
        p_screenshot_path: screenshotPath
    }
);

if (updateError) {
    throw updateError;
}

if (pathSaved !== true) {
    throw new Error(
        "Screenshot uploaded, but its path was not saved."
    );
}
    }

    if (status) {
        status.textContent = screenshotPath
            ? "Registration submitted successfully. Your screenshot has been uploaded. The Admin must verify your payment before approving your account."
            : "Registration submitted successfully. No screenshot was attached. The Admin must verify your payment before approving your account.";
    }

    const generalStatus = document.getElementById(
        "subscriptionRegistrationStatus"
    );

    if (generalStatus) {
        generalStatus.textContent =
            "Registration status: Pending Admin review.";
    }

} catch (error) {

    console.error(
        "Manual payment submission failed:",
        error
    );

    if (status) {
        status.textContent =
            error.message ||
            "Could not submit payment details.";
    }

} finally {

    if (button) button.disabled = false;

}

}
// =====================================================
// VERIFY OTP
// =====================================================

function verifyOTP() {

    const otp =
        document
            .getElementById("otp")
            ?.value
            .trim();

    const otpStatus =
        document.getElementById(
            "otpStatus"
        );


    if (!otp) {

        if (otpStatus) {

            otpStatus.textContent =
                "Please enter the verification code.";

        }

        return;

    }


    if (!/^\d{6}$/.test(otp)) {

        if (otpStatus) {

            otpStatus.textContent =
                "Verification code must contain 6 digits.";

        }

        return;

    }


    /*
       IMPORTANT:

       This only validates the format.

       It does NOT falsely claim that the
       payment/OTP has been verified by Supabase.

       Real OTP verification must be connected
       to your backend/verification function.
    */

    if (otpStatus) {

        otpStatus.textContent =
            "OTP format is valid. Backend verification is required.";

    }

}


// =====================================================
// LOGIN
// =====================================================

async function loginUser() {

    const loginPhone =
        document
            .getElementById("loginPhone")
            ?.value
            .trim();

    const loginPassword =
        document
            .getElementById("loginPassword")
            ?.value;

    const loginStatus =
        document.getElementById(
            "loginStatus"
        );


    if (
        !loginPhone ||
        !loginPassword
    ) {

        if (loginStatus) {

            loginStatus.textContent =
                "Please enter your phone number and password.";

        }

        return;

    }


    if (!isValidPhone(loginPhone)) {

        if (loginStatus) {

            loginStatus.textContent =
                "Enter a valid Kenyan phone number.";

        }

        return;

    }


    if (!supabaseClient) {

        if (loginStatus) {

            loginStatus.textContent =
                "Supabase is not connected.";

        }

        return;

    }


    const phone =
        normalizePhone(
            loginPhone
        );


    try {

        if (loginStatus) {

            loginStatus.textContent =
                "Logging in...";

        }


        // =================================================
        // FIND EMAIL USING PHONE
        // =================================================

        const {
            data: emailData,
            error: emailError
        } =
            await supabaseClient.rpc(
                "get_login_email",
                {
                    login_phone:
                        phone
                }
            );


        if (emailError) {

            console.error(
                emailError
            );

            if (loginStatus) {

                loginStatus.textContent =
                    "Could not find the account.";

            }

            return;

        }


        if (
            !emailData ||
            emailData.length === 0
        ) {

            if (loginStatus) {

                loginStatus.textContent =
                    "No active account was found for this phone number.";

            }

            return;

        }


        const email =
            emailData[0].email;


        // =================================================
        // SUPABASE LOGIN
        // =================================================

        const {
            data: authData,
            error: authError
        } =
            await supabaseClient.auth
                .signInWithPassword({

                    email:
                        email,

                    password:
                        loginPassword

                });


        if (authError) {

            console.error(
                authError
            );

            if (loginStatus) {

                loginStatus.textContent =
                    authError.message;

            }

            return;

        }


        if (
            !authData ||
            !authData.user
        ) {

            if (loginStatus) {

                loginStatus.textContent =
                    "Login failed.";

            }

            return;

        }


        // =================================================
        // GET PROFILE
        // =================================================

        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    authData.user.id
                )
                .single();


        if (profileError) {

            console.error(
                profileError
            );

            if (loginStatus) {

                loginStatus.textContent =
                    "Could not load your profile.";

            }

            return;

        }


        // =================================================
        // ACTIVE STATUS
        // =================================================

        if (
            profile.is_active === false
        ) {

            if (loginStatus) {

                loginStatus.textContent =
                    "Your account is currently inactive.";

            }

            await supabaseClient.auth.signOut();

            return;

        }


        currentProfile =
            profile;
  // CCS VSN30 — SHOW TREASURER ACCESS FOR AUTHORIZED USERS

const treasurerCard = document.getElementById("treasurerCard");

if (treasurerCard && currentProfile) {
    const role = String(currentProfile.role || "").toLowerCase();

    treasurerCard.style.display =
        currentProfile.is_active === true &&
        ["admin","treasurer"].includes(role)
            ? "block"
            : "none";
}

        // =================================================
        // DISPLAY NAME
        // =================================================

        const dashboardName =
            document.getElementById(
                "dashboardName"
            );

        if (dashboardName) {

            dashboardName.textContent =
                profile.full_name ||
                "User";

        }


        // =================================================
        // DISPLAY ROLE
        // =================================================

        const dashboardRole =
            document.getElementById(
                "dashboardRole"
            );

        if (dashboardRole) {

            dashboardRole.textContent =
                "Role: " +
                (
                    profile.role ||
                    "Member"
                );

        }


        const loggedInRole =
            String(
                profile.role || ""
            )
                .trim()
                .toLowerCase();


        // =================================================
        // ADMIN CARD
        // =================================================

        const adminCard =
            document.getElementById(
                "adminCard"
            );

        if (adminCard) {

            if (
                loggedInRole ===
                "admin"
            ) {

                adminCard.style.display =
                    "block";

            } else {

                adminCard.style.display =
                    "none";

            }

        }


        // =================================================
        // SECRETARY WITHDRAWAL PANEL
        // =================================================

        const withdrawalPanel =
            document.getElementById(
                "withdrawalPanel"
            );

        if (withdrawalPanel) {

            if (
                loggedInRole ===
                "secretary"
            ) {

                withdrawalPanel.style.display =
                    "block";

            } else {

                withdrawalPanel.style.display =
                    "none";

            }

        }


        // =================================================
        // LOAD DASHBOARD
        // =================================================

        await loadDashboardData();

        await loadWithdrawalVoting();


        if (loginStatus) {

            loginStatus.textContent =
                "";

        }


        showScreen(
            "dashboardScreen"
        );


    } catch (error) {

        console.error(
            error
        );

        if (loginStatus) {

            loginStatus.textContent =
                "An unexpected error occurred.";

        }

    }

}


// =====================================================
// LOAD DASHBOARD DATA
// =====================================================

async function loadDashboardData() {

    if (!supabaseClient) {
        return;
    }


    // =================================================
    // TOTAL CONTRIBUTIONS
    // =================================================

    try {

        const {
            data: totalData,
            error: totalError
        } =
            await supabaseClient.rpc(
                "get_total_contributed"
            );


        if (!totalError) {

            const total =
                Number(
                    totalData || 0
                );


            const formatted =
                "KES " +
                total.toLocaleString();


            const totalElements = [

                document.getElementById(
                    "totalContributed"
                ),

                document.getElementById(
                    "totalBalance"
                ),

                document.getElementById(
                    "totalContribution"
                ),

                document.getElementById(
                    "balanceAmount"
                )

            ];


            totalElements.forEach(
                function (element) {

                    if (element) {

                        element.textContent =
                            formatted;

                    }

                }
            );


        } else {

            console.error(
                "Contribution error:",
                totalError
            );

        }


    } catch (error) {

        console.error(
            "Contribution loading error:",
            error
        );

    }


    // =================================================
    // ACTIVE MEMBERS
    // =================================================

    try {

        const {
            count,
            error: membersError
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    "*",
                    {
                        count:
                            "exact",
                        head:
                            true
                    }
                )
                .eq(
                    "is_active",
                    true
                );


        if (!membersError) {

            /*
               Exclude Admin in JavaScript so
               role capitalization does not
               accidentally affect the count.
            */

            const {
                data: memberProfiles,
                error: profileError
            } =
                await supabaseClient
                    .from("profiles")
                    .select(
                        "id, role, is_active"
                    )
                    .eq(
                        "is_active",
                        true
                    );


            let activeMemberCount = 0;


            if (!profileError) {

                activeMemberCount =
                    (
                        memberProfiles || []
                    ).filter(
                        function (member) {

                            return String(
                                member.role || ""
                            )
                                .trim()
                                .toLowerCase()
                                !== "admin";

                        }
                    ).length;

            } else {

                activeMemberCount =
                    count || 0;

            }


            const memberElements = [

                document.getElementById(
                    "activeMembers"
                ),

                document.getElementById(
                    "memberCount"
                ),

                document.getElementById(
                    "totalMembers"
                )

            ];


            memberElements.forEach(
                function (element) {

                    if (element) {

                        element.textContent =
                            activeMemberCount;

                    }

                }
            );


        } else {

            console.error(
                "Members error:",
                membersError
            );

        }


    } catch (error) {

        console.error(
            "Member loading error:",
            error
        );

    }

}



// =====================================================
// CREATE WITHDRAWAL
// SECRETARY ONLY — IMPROVED FORM SUBMISSION
// =====================================================

async function createWithdrawal() {

    const amountInput =
        document.getElementById("withdrawalAmount");

    const reasonInput =
        document.getElementById("withdrawalReason");

    const destinationInput =
        document.getElementById("withdrawalDestination");

    const statusBox =
        document.getElementById("withdrawalStatus");

    const submitButton =
        document.querySelector(
            '#withdrawalPanel button[onclick="createWithdrawal()"]'
        );

    function showStatus(message, success = false) {
        if (statusBox) {
            statusBox.textContent = message;
            statusBox.style.color = success
                ? "#22c55e"
                : "#ff6b6b";
        }
    }

    // -------------------------------------------------
    // CHECK FORM ELEMENTS
    // -------------------------------------------------

    if (
        !amountInput ||
        !reasonInput ||
        !destinationInput ||
        !statusBox
    ) {
        console.error(
            "Withdrawal form elements are missing."
        );

        return;
    }

    // -------------------------------------------------
    // PREVENT DOUBLE SUBMISSION
    // -------------------------------------------------

    if (submitButton && submitButton.disabled) {
        return;
    }

    if (!supabaseClient) {
        showStatus(
            "Supabase is not connected. Refresh and try again."
        );
        return;
    }

    // -------------------------------------------------
    // VALIDATE AMOUNT, REASON AND DESTINATION
    // -------------------------------------------------

    const amountText = amountInput.value.trim();
    const amount = Number(amountText);
    const reason = reasonInput.value.trim();
    const destination = destinationInput.value.trim();

    if (
        amountText === "" ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        showStatus(
            "Enter a valid withdrawal amount greater than zero."
        );

        amountInput.focus();
        return;
    }

    if (!reason) {
        showStatus(
            "Enter the reason for withdrawal."
        );

        reasonInput.focus();
        return;
    }

    if (!destination) {
        showStatus(
            "Enter the withdrawal destination."
        );

        destinationInput.focus();
        return;
    }

    // -------------------------------------------------
    // SUBMIT REQUEST
    // -------------------------------------------------

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
    }

    try {

        showStatus(
            "Checking your account..."
        );

        // Verify the current authenticated user.
        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (
            sessionError ||
            !sessionData ||
            !sessionData.session
        ) {
            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        const user = sessionData.session.user;

        // Load the current user's profile.
        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .select("id, role, is_active")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            console.error(
                "Withdrawal profile error:",
                profileError
            );

            throw new Error(
                "Could not verify your profile. Please try again."
            );
        }

        const userRole = String(
            profile.role || ""
        ).trim().toLowerCase();

        // Only the Secretary may create withdrawal requests.
        if (userRole !== "secretary") {
            throw new Error(
                "Only the Secretary can create a withdrawal request."
            );
        }

        if (profile.is_active !== true) {
            throw new Error(
                "Your account is inactive. Contact the Admin."
            );
        }

        showStatus(
            "Submitting your withdrawal request..."
        );

        // Insert the request into the existing table.
        const {
            data: withdrawal,
            error: insertError
        } = await supabaseClient
            .from("withdrawals")
            .insert({
                requested_by: user.id,
                amount: amount,
                reason: reason,
                destination: destination,
                status: "pending"
            })
            .select(
                "id, amount, reason, destination, status, created_at"
            )
            .single();

        if (insertError) {
            console.error(
                "Withdrawal submission error:",
                insertError
            );

            throw new Error(
                "Request submission failed: " +
                insertError.message
            );
        }

        if (!withdrawal) {
            throw new Error(
                "The database did not return the submitted request."
            );
        }

        // Clear the form only after confirmed insertion.
        amountInput.value = "";
        reasonInput.value = "";
        destinationInput.value = "";

        showStatus(
            "Withdrawal request #" +
            withdrawal.id +
            " submitted successfully. Status: Pending approval.",
            true
        );

        console.log(
            "Withdrawal request created:",
            withdrawal
        );

        // Refresh the voting list without treating a
        // refresh failure as a failed database submission.
        try {
            await loadWithdrawalVoting();
        } catch (refreshError) {
            console.error(
                "Withdrawal voting refresh error:",
                refreshError
            );
        }

    } catch (error) {

        console.error(
            "Create withdrawal error:",
            error
        );

        showStatus(
            error.message ||
            "An unexpected error occurred while submitting the request."
        );

    } finally {

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent =
                "Submit Withdrawal Request";
        }
    }
}


// =====================================================
// CCS VSN30 — LOAD TREASURER WITHDRAWAL REQUESTS
// =====================================================

window.loadTreasurerWithdrawals = async function () {

const statusBox = document.getElementById(
    "treasurerWithdrawalStatus"
);

const listBox = document.getElementById(
    "treasurerPendingWithdrawalsList"
);

const countBox = document.getElementById(
    "treasurerPendingWithdrawalsCount"
);

if (!statusBox || !listBox) {
    console.error(
        "Treasurer withdrawal HTML elements are missing."
    );
    return;
}

statusBox.textContent = "Loading withdrawal requests...";
listBox.innerHTML = "";

try {

    const {
        data: { user },
        error: authError
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        throw new Error("Please log in again.");
    }

    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

    if (profileError) throw profileError;

    const role = String(profile.role || "")
        .trim()
        .toLowerCase();

    if (
        profile.is_active !== true ||
        !["admin", "treasurer"].includes(role)
    ) {
        throw new Error(
            "Only an active Treasurer or Admin can view these requests."
        );
    }

    const {
        data: withdrawals,
        error: withdrawalError
    } = await supabaseClient
        .from("withdrawals")
        .select(
            "id, requested_by, amount, reason, destination, status, created_at"
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true });

    if (withdrawalError) throw withdrawalError;

    const requests = withdrawals || [];

    if (countBox) {
        countBox.textContent = String(requests.length);
    }

    if (requests.length === 0) {
        statusBox.textContent =
            "No pending withdrawal requests were found.";

        listBox.innerHTML =
            "<p>There are currently no pending withdrawals.</p>";

        return;
    }

    const requesterIds = [
        ...new Set(
            requests.map(item => item.requested_by)
        )
    ];

    const {
        data: profiles,
        error: requesterError
    } = await supabaseClient
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", requesterIds);

    if (requesterError) throw requesterError;

    const profileMap = {};

    (profiles || []).forEach(person => {
        profileMap[String(person.id)] = person;
    });

    const withdrawalIds = requests.map(item => item.id);

    const {
        data: summaries,
        error: summaryError
    } = await supabaseClient
        .from("withdrawal_vote_summary")
        .select(
            "withdrawal_id, active_members, approvals, rejections, total_votes"
        )
        .in("withdrawal_id", withdrawalIds);

    if (summaryError) throw summaryError;

    const summaryMap = {};

    (summaries || []).forEach(item => {
        summaryMap[String(item.withdrawal_id)] = item;
    });

    const escapeHTML = value =>
        String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);

    listBox.innerHTML = requests.map(request => {

        const requester =
            profileMap[String(request.requested_by)] || {};

        const summary =
            summaryMap[String(request.id)] || {};

        const approvals = Number(summary.approvals || 0);
        const rejections = Number(summary.rejections || 0);
        const activeMembers = Number(summary.active_members || 0);

        const requiredApprovals = activeMembers > 0
            ? Math.ceil(activeMembers / 2)
            : null;

        const dateText = request.created_at
            ? new Date(request.created_at).toLocaleString()
            : "Not available";

        return `
            <div class="dashboard-card" style="margin-top:15px;">

                <h3>Withdrawal #${escapeHTML(request.id)}</h3>

                <p>
                    <strong>Requested by:</strong>
                    ${escapeHTML(requester.full_name || "Unknown member")}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${escapeHTML(requester.phone || "Not available")}
                </p>

                <p>
                    <strong>Amount:</strong>
                    KSh ${Number(request.amount || 0).toLocaleString()}
                </p>

                <p>
                    <strong>Reason:</strong>
                    ${escapeHTML(request.reason || "Not provided")}
                </p>

                <p>
                    <strong>Destination:</strong>
                    ${escapeHTML(request.destination || "Not provided")}
                </p>

                <p>
                    <strong>Date requested:</strong>
                    ${escapeHTML(dateText)}
                </p>

                <hr>

                <h4>Member Voting Progress</h4>

                <p>Active members: ${activeMembers}</p>
                <p>Approvals: ${approvals}</p>
                <p>Rejections: ${rejections}</p>

                <p>
                    Required approvals:
                    ${requiredApprovals === null
                        ? "Unable to determine"
                        : requiredApprovals}
                </p>

                <p>
                    <strong>Status:</strong>
                    ${escapeHTML(request.status)}
                </p>

            </div>
        `;

    }).join("");

    statusBox.textContent =
        `Loaded ${requests.length} pending withdrawal request(s).`;

} catch (error) {

    console.error(
        "Treasurer withdrawal loading error:",
        error
    );

    statusBox.textContent =
        error.message ||
        "Could not load withdrawal requests.";

    listBox.innerHTML =
        "<p>Unable to load requests. Check database permissions and the browser console.</p>";
}

};
// =====================================================
// FORGOT PASSWORD
// =====================================================

function requestPasswordReset() {

    const identifier =
        document
            .getElementById(
                "forgotIdentifier"
            )
            ?.value
            .trim();


    const resetStatus =
        document.getElementById(
            "forgotPasswordStatus"
        );


    if (!identifier) {

        if (resetStatus) {

            resetStatus.textContent =
                "Enter your phone number or email address.";

        }

        return;

    }


    if (
        identifier.includes("@") &&
        !isValidEmail(identifier)
    ) {

        if (resetStatus) {

            resetStatus.textContent =
                "Enter a valid email address.";

        }

        return;

    }


    resetData = {

        identifier:
            identifier

    };


    if (resetStatus) {

        resetStatus.textContent =
            "Password reset service requires backend OTP verification.";

    }

}


// =====================================================
// RESET PASSWORD
// =====================================================

function resetPassword() {

    const resetOTP =
        document
            .getElementById(
                "resetOTP"
            )
            ?.value
            .trim();


    const newPassword =
        document
            .getElementById(
                "newPassword"
            )
            ?.value;


    const confirmNewPassword =
        document
            .getElementById(
                "confirmNewPassword"
            )
            ?.value;


    const resetPasswordStatus =
        document.getElementById(
            "resetPasswordStatus"
        );


    if (
        !resetOTP ||
        !newPassword ||
        !confirmNewPassword
    ) {

        if (resetPasswordStatus) {

            resetPasswordStatus.textContent =
                "Please enter the OTP and new password.";

        }

        return;

    }


    if (!/^\d{6}$/.test(resetOTP)) {

        if (resetPasswordStatus) {

            resetPasswordStatus.textContent =
                "OTP must contain 6 digits.";

        }

        return;

    }


    if (
        newPassword.length <
        6
    ) {

        if (resetPasswordStatus) {

            resetPasswordStatus.textContent =
                "Password must be at least 6 characters.";

        }

        return;

    }


    if (
        newPassword !==
        confirmNewPassword
    ) {

        if (resetPasswordStatus) {

            resetPasswordStatus.textContent =
                "Passwords do not match.";

        }

        return;

    }


    if (resetPasswordStatus) {

        resetPasswordStatus.textContent =
            "Password format is valid. Backend OTP verification is required before changing the password.";

    }

}


// =====================================================
// LOGOUT
// =====================================================

async function logoutUser() {

    try {

        if (supabaseClient) {

            await supabaseClient.auth.signOut();

        }

    } catch (error) {

        console.error(
            error
        );

    }


    currentProfile =
        null;

    registrationData =
        {};

    resetData =
        {};

    selectedContributionMethod =
        null;


    // =================================================
    // HIDE PANELS
    // =================================================

    const withdrawalPanel =
        document.getElementById(
            "withdrawalPanel"
        );

    if (withdrawalPanel) {

        withdrawalPanel.style.display =
            "none";

    }


    const adminCard =
        document.getElementById(
            "adminCard"
        );

    if (adminCard) {

        adminCard.style.display =
            "none";

    }


    const adminPanel =
        document.getElementById(
            "adminPanel"
        );

    if (adminPanel) {

        adminPanel.style.display =
            "none";

    }


    const votingSection =
        document.getElementById(
            "withdrawalVotingSection"
        );

    if (votingSection) {

        votingSection.style.display =
            "none";

    }


    // =================================================
    // CLEAR LOGIN
    // =================================================

    const loginPhone =
        document.getElementById(
            "loginPhone"
        );

    const loginPassword =
        document.getElementById(
            "loginPassword"
        );

    const loginStatus =
        document.getElementById(
            "loginStatus"
        );


    if (loginPhone) {
        loginPhone.value = "";
    }

    if (loginPassword) {
        loginPassword.value = "";
    }

    if (loginStatus) {
        loginStatus.textContent = "";
    }


    showScreen(
        "welcomeScreen"
    );

}


// =====================================================
// WITHDRAWAL VOTING
// =====================================================

async function loadWithdrawalVoting() {

    const section =
        document.getElementById(
            "withdrawalVotingSection"
        );

    const list =
        document.getElementById(
            "withdrawalRequestsList"
        );


    if (
        !section ||
        !list ||
        !supabaseClient
    ) {

        return;

    }


    try {

        const {
            data: sessionData
        } =
            await supabaseClient.auth
                .getSession();


        if (
            !sessionData.session
        ) {

            section.style.display =
                "none";

            return;

        }


        const user =
            sessionData.session.user;


        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    user.id
                )
                .single();


        if (
            profileError ||
            !profile
        ) {

            console.error(
                profileError
            );

            section.style.display =
                "none";

            return;

        }


        const role =
            String(
                profile.role || ""
            )
                .trim()
                .toLowerCase();


        // Secretary does not vote.
        // Admin may view the voting section,
        // but normal voting is for members.

        if (
            profile.is_active !== true ||
            role === "secretary"
        ) {

            section.style.display =
                "none";

            return;

        }


        section.style.display =
            "block";


        // =================================================
        // GET PENDING WITHDRAWALS
        // =================================================

        const {
            data: withdrawals,
            error
        } =
            await supabaseClient
                .from("withdrawals")
                .select("*")
                .eq(
                    "status",
                    "pending"
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        if (error) {

            console.error(
                "Withdrawal loading error:",
                error
            );

            list.innerHTML =
                "<p>Unable to load withdrawal requests.</p>";

            return;

        }


        if (
            !withdrawals ||
            withdrawals.length === 0
        ) {

            list.innerHTML =
                "<p>No pending withdrawal requests.</p>";

            return;

        }


        let html = "";


        for (
            const withdrawal
            of withdrawals
        ) {

            const {
                data: votes,
                error: voteError
            } =
                await supabaseClient
                    .from("withdrawal_votes")
                    .select("*")
                    .eq(
                        "withdrawal_id",
                        withdrawal.id
                    );


            if (voteError) {

                console.error(
                    voteError
                );

                continue;

            }


            const approved =
                (
                    votes || []
                ).filter(
                    function (vote) {

                        return String(
                            vote.vote
                        )
                            .toLowerCase()
                            === "approve";

                    }
                ).length;


            const rejected =
                (
                    votes || []
                ).filter(
                    function (vote) {

                        return String(
                            vote.vote
                        )
                            .toLowerCase()
                            === "reject";

                    }
                ).length;


            const totalVotes =
                (
                    votes || []
                ).length;


            const alreadyVoted =
                (
                    votes || []
                ).some(
                    function (vote) {

                        return (
                            vote.voter_id ===
                            user.id
                        );

                    }
                );


            html += `
                <div class="dashboard-card">

                    <h3>
                        Withdrawal Request
                    </h3>

                    <p>
                        <strong>Amount:</strong>
                        KES ${
                            Number(
                                withdrawal.amount
                            ).toLocaleString()
                        }
                    </p>

                    <p>
                        <strong>Reason:</strong>
                        ${
                            withdrawal.reason ||
                            "Not provided"
                        }
                    </p>

                    <p>
                        <strong>Destination:</strong>
                        ${
                            withdrawal.destination ||
                            "Not provided"
                        }
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${
                            withdrawal.created_at
                            ?
                            new Date(
                                withdrawal.created_at
                            ).toLocaleString()
                            :
                            "Not available"
                        }
                    </p>

                    <hr>

                    <p>
                        <strong>
                            Voting Progress
                        </strong>
                    </p>

                    <p>
                        Approved:
                        <strong>
                            ${approved}
                        </strong>

                        |

                        Rejected:
                        <strong>
                            ${rejected}
                        </strong>

                        |

                        Total Voted:
                        <strong>
                            ${totalVotes}
                        </strong>
                    </p>

                    ${
                        alreadyVoted
                        ?
                        `
                        <p>
                            <strong>
                                You have already voted on this request.
                            </strong>
                        </p>
                        `
                        :
                        `
                        <button
                            type="button"
                            onclick="voteOnWithdrawal(
                                '${withdrawal.id}',
                                'approve'
                            )"
                        >
                            Approve
                        </button>

                        <button
                            type="button"
                            class="secondary"
                            onclick="rejectWithdrawal(
                                '${withdrawal.id}'
                            )"
                        >
                            Reject
                        </button>
                        `
                    }

                </div>
            `;

        }


        list.innerHTML =
            html;


    } catch (error) {

        console.error(
            "Voting error:",
            error
        );

        list.innerHTML =
            "<p>Unable to load voting section.</p>";

    }

}


// =====================================================
// CAST APPROVE / REJECT VOTE
// =====================================================

async function voteOnWithdrawal(
    withdrawalId,
    vote,
    rejectionReason = null
) {

    if (!supabaseClient) {

        return;

    }


    try {

        const {
            data: sessionData
        } =
            await supabaseClient.auth
                .getSession();


        if (
            !sessionData.session
        ) {

            alert(
                "Please login first."
            );

            return;

        }


        const user =
            sessionData.session.user;


        const {
            error
        } =
            await supabaseClient
                .from("withdrawal_votes")
                .insert([
                    {

                        withdrawal_id:
                            withdrawalId,

                        voter_id:
                            user.id,

                        vote:
                            vote,

                        rejection_reason:
                            rejectionReason

                    }
                ]);


        if (error) {

            if (
                error.code ===
                "23505"
            ) {

                alert(
                    "You have already voted on this withdrawal."
                );

            } else {

                console.error(
                    error
                );

                alert(
                    "Vote failed: " +
                    error.message
                );

            }

            return;

        }


        alert(
            vote === "approve"
                ?
                "Your approval vote has been recorded."
                :
                "Your rejection vote has been recorded."
        );


        await checkWithdrawalResult(
            withdrawalId
        );


        await loadWithdrawalVoting();


    } catch (error) {

        console.error(
            error
        );

        alert(
            "An error occurred while voting."
        );

    }

}


// =====================================================
// REJECT WITHDRAWAL
// =====================================================

async function rejectWithdrawal(
    withdrawalId
) {

    const reason =
        prompt(
            "Please enter the reason for rejecting this withdrawal:"
        );


    if (
        !reason ||
        !reason.trim()
    ) {

        alert(
            "A rejection reason is required."
        );

        return;

    }


    await voteOnWithdrawal(
        withdrawalId,
        "reject",
        reason.trim()
    );

}


// =====================================================
// CHECK VOTING RESULT
// =====================================================

async function checkWithdrawalResult(
    withdrawalId
) {

    try {

        // =================================================
        // ACTIVE NON-ADMIN MEMBERS
        // =================================================

        const {
            data: members,
            error: memberError
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    "id, role, is_active"
                )
                .eq(
                    "is_active",
                    true
                );


        if (memberError) {

            console.error(
                memberError
            );

            return;

        }


        const votingMembers =
            (
                members || []
            ).filter(
                function (member) {

                    return String(
                        member.role || ""
                    )
                        .trim()
                        .toLowerCase()
                        !== "admin";

                }
            );


        const totalMembers =
            votingMembers.length;


        const requiredVotes =
            Math.ceil(
                totalMembers / 2
            );


        // =================================================
        // GET VOTES
        // =================================================

        const {
            data: votes,
            error: voteError
        } =
            await supabaseClient
                .from("withdrawal_votes")
                .select("vote")
                .eq(
                    "withdrawal_id",
                    withdrawalId
                );


        if (voteError) {

            console.error(
                voteError
            );

            return;

        }


        const approved =
            (
                votes || []
            ).filter(
                function (vote) {

                    return String(
                        vote.vote
                    )
                        .toLowerCase()
                        === "approve";

                }
            ).length;


        const rejected =
            (
                votes || []
            ).filter(
                function (vote) {

                    return String(
                        vote.vote
                    )
                        .toLowerCase()
                        === "reject";

                }
            ).length;


        // =================================================
        // APPROVED
        // =================================================

        if (
            approved >=
            requiredVotes
        ) {

            const {
                error
            } =
                await supabaseClient
                    .from("withdrawals")
                    .update({
                        status:
                            "approved"
                    })
                    .eq(
                        "id",
                        withdrawalId
                    );


            if (error) {

                console.error(
                    "Approval update error:",
                    error
                );

                return;

            }


            alert(
                "The withdrawal has received enough approval votes."
            );

            return;

        }


        // =================================================
        // REJECTION MATHEMATICALLY UNAVOIDABLE
        // =================================================

        const remaining =
            totalMembers -
            (
                approved +
                rejected
            );


        if (
            approved +
            remaining <
            requiredVotes
        ) {

            const {
                error
            } =
                await supabaseClient
                    .from("withdrawals")
                    .update({
                        status:
                            "rejected"
                    })
                    .eq(
                        "id",
                        withdrawalId
                    );


            if (error) {

                console.error(
                    "Rejection update error:",
                    error
                );

                return;

            }


            alert(
                "The withdrawal has been rejected because it can no longer reach the required approval."
            );

        }

    } catch (error) {

        console.error(
            "Result check error:",
            error
        );

    }

}


// =====================================================
// ADMIN DASHBOARD
// =====================================================

async function openAdminPanel() {

    const panel =
        document.getElementById(
            "adminPanel"
        );

    const status =
        document.getElementById(
            "adminStatus"
        );


    if (!panel) {
        return;
    }


    if (!supabaseClient) {

        if (status) {

            status.textContent =
                "Supabase is not connected.";

        }

        return;

    }


    try {

        const {
            data: sessionData,
            error: sessionError
        } =
            await supabaseClient.auth
                .getSession();


        if (
            sessionError ||
            !sessionData.session
        ) {

            if (status) {

                status.textContent =
                    "Please login first.";

            }

            return;

        }


        const user =
            sessionData.session.user;


        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    user.id
                )
                .single();


        if (
            profileError ||
            !profile
        ) {

            if (status) {

                status.textContent =
                    "Could not load Admin profile.";

            }

            return;

        }


        const role =
            String(
                profile.role || ""
            )
                .trim()
                .toLowerCase();


        if (
            role !==
            "admin"
        ) {

            if (status) {

                status.textContent =
                    "Access denied. Admin account required.";

            }

            return;

        }


        if (
            profile.is_active ===
            false
        ) {

            if (status) {

                status.textContent =
                    "This Admin account is inactive.";

            }

            return;

        }


        panel.style.display =
            "block";


        if (status) {

            status.textContent =
                "Admin dashboard loaded.";

        }


        await loadAdminMembers();

        await loadAdminContributions();

        await loadAdminWithdrawals();

        await loadAdminVoting();


    } catch (error) {

        console.error(
            "Admin dashboard error:",
            error
        );

        if (status) {

            status.textContent =
                "Unable to load Admin dashboard.";

        }

    }

}

// ============================================
// CCS VSN30 — SAVE DAILY CONTRIBUTION SCHEDULE
// ============================================

async function saveDailyContributionSchedule() {
    const status = document.getElementById(
        "dailyContributionScheduleStatus"
    );

    if (!supabaseClient || !currentProfile) {
        status.textContent =
            "Please log in before managing the schedule.";
        return;
    }

    if (
        String(currentProfile.role || "").toLowerCase()
        !== "admin"
    ) {
        status.textContent =
            "Only the Admin can activate this schedule.";
        return;
    }

    const confirmed = window.confirm(
        "Activate a daily contribution of KSh 50 per member, " +
        "with a 3-day grace period and the existing penalty policy?"
    );

    if (!confirmed) {
        return;
    }

    status.textContent = "Saving daily contribution schedule...";

    try {
        const { data, error } = await supabaseClient.rpc(
            "admin_save_contribution_schedule",
            {
                p_schedule_type: "daily",
                p_required_amount: 50,
                p_is_enabled: true,
                p_effective_from:
                    new Date().toLocaleDateString("en-CA"),
                p_due_day: null,
                p_grace_period_days: 3,
                p_penalty_enabled: true
            }
        );

        if (error) {
            console.error(
                "Daily schedule error:",
                error
            );

            status.textContent =
                "Could not save the schedule: " + error.message;

            return;
        }

        if (!data || data.success !== true) {
            status.textContent =
                data?.message ||
                "The schedule could not be activated.";

            return;
        }

        status.textContent =
            "Success! Daily contributions are set to KSh 50. " +
            "Schedule ID: " + data.schedule_id;

        alert(
            "Daily contribution schedule saved successfully."
        );

    } catch (error) {
        console.error(error);

        status.textContent =
            "An unexpected error occurred while saving the schedule.";
    }
}
// =====================================================
// CLOSE ADMIN PANEL
// =====================================================

function closeAdminPanel() {

    const panel =
        document.getElementById(
            "adminPanel"
        );

    if (panel) {

        panel.style.display =
            "none";

    }

}


// =====================================================
// LOAD ADMIN MEMBERS
// =====================================================

async function loadAdminMembers() {

    const list =
        document.getElementById(
            "adminMembersList"
        );


    if (!list) {
        return;
    }


    try {

        const {
            data: members,
            error
        } =
            await supabaseClient
                .from("profiles")
                .select(
                    "id, full_name, phone, email, role, is_active, created_at"
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        if (error) {

            console.error(
                "Admin members error:",
                error
            );

            list.innerHTML =
                "<p>Unable to load members.</p>";

            return;

        }


        if (
            !members ||
            members.length === 0
        ) {

            list.innerHTML =
                "<p>No member accounts found.</p>";

            return;

        }


        const activeMembers =
            members.filter(
                function (member) {

                    return (
                        member.is_active ===
                        true
                    ) &&
                    String(
                        member.role || ""
                    )
                        .trim()
                        .toLowerCase()
                        !== "admin";

                }
            ).length;


        const totalAccounts =
            members.length;


        const activeElement =
            document.getElementById(
                "adminActiveMembers"
            );


        const accountsElement =
            document.getElementById(
                "adminTotalAccounts"
            );


        if (activeElement) {

            activeElement.textContent =
                activeMembers;

        }


        if (accountsElement) {

            accountsElement.textContent =
                totalAccounts;

        }


        let html = "";


        members.forEach(
            function (member) {

                const memberRole =
                    member.role ||
                    "Member";


                const activeStatus =
                    member.is_active
                        ?
                        "Active"
                        :
                        "Inactive";


                html += `
                    <div class="dashboard-card">

                        <h3>
                            ${
                                member.full_name ||
                                "Unnamed User"
                            }
                        </h3>

                        <p>
                            <strong>Phone:</strong>
                            ${
                                member.phone ||
                                "Not provided"
                            }
                        </p>

                        <p>
                            <strong>Email:</strong>
                            ${
                                member.email ||
                                "Not provided"
                            }
                        </p>

                        <p>
                            <strong>Role:</strong>
                            ${memberRole}
                        </p>

                        <p>
                            <strong>Status:</strong>
                            ${activeStatus}
                        </p>

                    </div>
                `;

            }
        );


        list.innerHTML =
            html;


    } catch (error) {

        console.error(
            error
        );

        list.innerHTML =
            "<p>Unable to load member records.</p>";

    }

}


// =====================================================
// LOAD ADMIN CONTRIBUTIONS
// =====================================================

async function loadAdminContributions() {

    const container =
        document.getElementById(
            "adminContributionsList"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "<p>Loading contribution records...</p>";


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("contributions")
                .select(`
                    id,
                    user_id,
                    expected_amount,
                    amount_paid,
                    due_date,
                    paid_at,
                    status,
                    penalty_amount,
                    created_at
                `)
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        // =================================================
        // ERROR FIRST
        // =================================================

        if (error) {

            console.error(
                "Contribution records error:",
                error
            );

            container.innerHTML = `
                <div class="dashboard-card">

                    <h3>
                        Contribution Records Error
                    </h3>

                    <p>
                        ${error.message}
                    </p>

                </div>
            `;

            return;

        }


        // =================================================
        // NO RECORDS
        // =================================================

        if (
            !data ||
            data.length === 0
        ) {

            container.innerHTML =
                "<p>No contribution records found.</p>";

            return;

        }


        // =================================================
        // ADMIN TOTAL
        // =================================================

        const totalPaid =
            data.reduce(
                function (
                    total,
                    contribution
                ) {

                    return total +
                        Number(
                            contribution.amount_paid ||
                            0
                        );

                },
                0
            );


        const adminTotal =
            document.getElementById(
                "adminTotalContributions"
            );


        if (adminTotal) {

            adminTotal.textContent =
                "KES " +
                totalPaid.toLocaleString();

        }


        // =================================================
        // DISPLAY RECORDS
        // =================================================

        container.innerHTML =
            "";


        data.forEach(
            function (
                contribution,
                index
            ) {

                const record =
                    document.createElement(
                        "div"
                    );


                record.className =
                    "dashboard-card";


                record.innerHTML = `
                    <h3>
                        Contribution #${
                            index + 1
                        }
                    </h3>

                    <p>
                        <strong>User ID:</strong>
                        ${
                            contribution.user_id ||
                            "N/A"
                        }
                    </p>

                    <p>
                        <strong>Expected Amount:</strong>
                        KES ${
                            Number(
                                contribution.expected_amount ||
                                0
                            ).toLocaleString()
                        }
                    </p>

                    <p>
                        <strong>Amount Paid:</strong>
                        KES ${
                            Number(
                                contribution.amount_paid ||
                                0
                            ).toLocaleString()
                        }
                    </p>

                    <p>
                        <strong>Due Date:</strong>
                        ${
                            contribution.due_date ||
                            "N/A"
                        }
                    </p>

                    <p>
                        <strong>Paid At:</strong>
                        ${
                            contribution.paid_at ||
                            "Not paid"
                        }
                    </p>

                    <p>
                        <strong>Status:</strong>
                        ${
                            contribution.status ||
                            "N/A"
                        }
                    </p>

                    <p>
                        <strong>Penalty:</strong>
                        KES ${
                            Number(
                                contribution.penalty_amount ||
                                0
                            ).toLocaleString()
                        }
                    </p>

                    <p>
                        <strong>Created:</strong>
                        ${
                            contribution.created_at
                            ?
                            new Date(
                                contribution.created_at
                            ).toLocaleString()
                            :
                            "N/A"
                        }
                    </p>
                `;


                container.appendChild(
                    record
                );

            }
        );


    } catch (error) {

        console.error(
            "Unexpected contribution error:",
            error
        );

        container.innerHTML =
            `<p>Unexpected error: ${
                error.message
            }</p>`;

    }

}


// =====================================================
// LOAD ADMIN WITHDRAWALS
// =====================================================

async function loadAdminWithdrawals() {

    const list =
        document.getElementById(
            "adminWithdrawalsList"
        );


    if (!list) {
        return;
    }


    try {

        const {
            data: withdrawals,
            error
        } =
            await supabaseClient
                .from("withdrawals")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        if (error) {

            console.error(
                "Admin withdrawals error:",
                error
            );

            list.innerHTML =
                "<p>Unable to load withdrawal records.</p>";

            return;

        }


        if (
            !withdrawals ||
            withdrawals.length === 0
        ) {

            list.innerHTML =
                "<p>No withdrawal records found.</p>";

            return;

        }


        let html = "";


        withdrawals.forEach(
            function (withdrawal) {

                html += `
                    <div class="dashboard-card">

                        <h3>
                            KES ${
                                Number(
                                    withdrawal.amount ||
                                    0
                                ).toLocaleString()
                            }
                        </h3>

                        <p>
                            <strong>Reason:</strong>
                            ${
                                withdrawal.reason ||
                                "Not provided"
                            }
                        </p>

                        <p>
                            <strong>Destination:</strong>
                            ${
                                withdrawal.destination ||
                                "Not provided"
                            }
                        </p>

                        <p>
                            <strong>Status:</strong>
                            ${
                                withdrawal.status ||
                                "Unknown"
                            }
                        </p>

                        <p>
                            <strong>Date:</strong>
                            ${
                                withdrawal.created_at
                                ?
                                new Date(
                                    withdrawal.created_at
                                ).toLocaleString()
                                :
                                "Not available"
                            }
                        </p>

                        <p>
                            <strong>Requested By:</strong>
                            ${
                                withdrawal.requested_by ||
                                "Not available"
                            }
                        </p>

                    </div>
                `;

            }
        );


        list.innerHTML =
            html;


    } catch (error) {

        console.error(
            error
        );

        list.innerHTML =
            "<p>Unable to load withdrawal records.</p>";

    }

}


// =====================================================
// LOAD ADMIN VOTING RECORDS
// =====================================================

async function loadAdminVoting() {

    const list =
        document.getElementById(
            "adminVotingList"
        );


    if (!list) {
        return;
    }


    try {

        const {
            data: votes,
            error
        } =
            await supabaseClient
                .from("withdrawal_votes")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        if (error) {

            console.error(
                "Admin voting error:",
                error
            );

            list.innerHTML =
                "<p>Unable to load voting records.</p>";

            return;

        }


        if (
            !votes ||
            votes.length === 0
        ) {

            list.innerHTML =
                "<p>No voting records found.</p>";

            return;

        }


        let html = "";


        votes.forEach(
            function (vote) {

                const voteType =
                    String(
                        vote.vote ||
                        ""
                    )
                        .toLowerCase();


                html += `
                    <div class="dashboard-card">

                        <p>
                            <strong>Withdrawal ID:</strong>
                            ${
                                vote.withdrawal_id
                            }
                        </p>

                        <p>
                            <strong>Voter ID:</strong>
                            ${
                                vote.voter_id
                            }
                        </p>

                        <p>
                            <strong>Vote:</strong>
                            ${
                                voteType ===
                                "approve"
                                ?
                                "Approved"
                                :
                                "Rejected"
                            }
                        </p>

                        <p>
                            <strong>Rejection Reason:</strong>
                            ${
                                vote.rejection_reason ||
                                "N/A"
                            }
                        </p>

                        <p>
                            <strong>Date:</strong>
                            ${
                                vote.created_at
                                ?
                                new Date(
                                    vote.created_at
                                ).toLocaleString()
                                :
                                "Not available"
                            }
                        </p>

                    </div>
                `;

            }
        );


        list.innerHTML =
            html;


    } catch (error) {

        console.error(
            error
        );

        list.innerHTML =
            "<p>Unable to load voting records.</p>";

    }

}



// ==================================================
// CCS VSN30 — CONTRIBUTION PAYMENT METHOD SELECTOR
// ==================================================

function selectContributionMethod(method) {

    // Save the selected payment method.
    selectedContributionMethod = method;

    const status = document.getElementById(
        "contributionStatus"
    );

    const stkSection = document.getElementById(
        "stkPaymentSection"
    );

    const manualSection = document.getElementById(
        "manualMpesaSection"
    );

    const stkButton = document.getElementById(
        "selectStkPayment"
    );

    const manualButton = document.getElementById(
        "selectManualPayment"
    );

    // Hide both sections before showing the chosen method.
    if (stkSection) {
        stkSection.style.display = "none";
    }

    if (manualSection) {
        manualSection.style.display = "none";
    }

    // Reset button highlighting.
    if (stkButton) {
        stkButton.classList.remove("active");
        stkButton.setAttribute(
            "aria-pressed",
            "false"
        );
    }

    if (manualButton) {
        manualButton.classList.remove("active");
        manualButton.setAttribute(
            "aria-pressed",
            "false"
        );
    }

    // M-PESA STK PUSH.
    if (method === "mpesa_stk" || method === "mpesa") {

        if (stkSection) {
            stkSection.style.display = "block";
        }

        if (stkButton) {
            stkButton.classList.add("active");
            stkButton.setAttribute(
                "aria-pressed",
                "true"
            );
        }

        if (status) {
            status.textContent =
                "M-PESA STK selected. Enter your phone number and amount.";
        }

        return;
    }

    // MANUAL M-PESA PAYMENT.
    if (method === "manual_mpesa" || method === "bank") {

        if (manualSection) {
            manualSection.style.display = "block";
        }

        if (manualButton) {
            manualButton.classList.add("active");
            manualButton.setAttribute(
                "aria-pressed",
                "true"
            );
        }

        if (status) {
            status.textContent =
                "Manual M-PESA selected. Enter the transaction code and upload your payment screenshot.";
        }

        return;
    }

    // Handle unsupported methods safely.
    if (status) {
        status.textContent =
            "Please select M-PESA STK Push or Manual M-PESA.";
    }
}
// ======================================================
// CCS VSN30 — MANUAL M-PESA PAYMENT AND SCREENSHOT
// ======================================================

async function submitManualContributionPayment() {

    const status = document.getElementById(
        "contributionStatus"
    );

    const submitButton = document.getElementById(
        "submitManualContributionButton"
    );

    const amountInput = document.getElementById(
        "calculatedContributionTotal"
    );

    const phoneInput = document.getElementById(
        "manualMpesaPhone"
    );

    const referenceInput = document.getElementById(
        "manualMpesaReference"
    );

    const screenshotInput = document.getElementById(
        "contributionScreenshot"
    );

    const typeInput = document.getElementById(
        "contributionType"
    );

    const startInput = document.getElementById(
        "contributionStartDate"
    );

    const endInput = document.getElementById(
        "contributionEndDate"
    );

    const periodInput = document.getElementById(
        "contributionPeriod"
    );

    if (!status || !submitButton) {
        alert("The contribution form could not be found.");
        return;
    }

    // Confirm that Supabase has been initialized.
    if (!supabaseClient) {
        status.textContent =
            "Connection is not ready. Please refresh and log in again.";
        return;
    }

    // Get the signed-in user.
    let user;

    try {
        const { data, error } =
            await supabaseClient.auth.getUser();

        if (error) {
            throw error;
        }

        user = data.user;

    } catch (error) {
        console.error("Authentication error:", error);

        status.textContent =
            "Could not verify your login. Please log in again.";

        return;
    }

    if (!user) {
        status.textContent =
            "Please log in before submitting a contribution.";
        return;
    }

    // Validate the payment amount displayed by the calculator.
    const amountText = amountInput.textContent
        .replace(/[^0-9.]/g, "");

    const amount = Number(amountText);

    if (!Number.isFinite(amount) || amount <= 0) {
        status.textContent =
            "Please select a valid contribution period.";
        return;
    }

    // Read the manual payment details.
    const phone = phoneInput.value.trim();

    const reference = referenceInput.value
        .trim()
        .toUpperCase();

    const screenshot = screenshotInput.files[0];

    if (!phone) {
        status.textContent =
            "Enter the phone number used for payment.";
        phoneInput.focus();
        return;
    }

    if (!/^(?:07|01)\d{8}$/.test(phone)) {
        status.textContent =
            "Enter a valid Kenyan phone number, for example 0712345678.";
        phoneInput.focus();
        return;
    }

    if (!reference) {
        status.textContent =
            "Enter the M-PESA transaction code.";
        referenceInput.focus();
        return;
    }

    if (!/^[A-Z0-9]{6,30}$/.test(reference)) {
        status.textContent =
            "Check the transaction code. Enter 6–30 letters or numbers.";
        referenceInput.focus();
        return;
    }

    if (!screenshot) {
        status.textContent =
            "Please choose the M-PESA payment screenshot.";
        screenshotInput.focus();
        return;
    }

    // Accept JPG/JPEG and PNG images up to 5 MB.
    const allowedTypes = [
        "image/jpeg",
        "image/png"
    ];

    if (!allowedTypes.includes(screenshot.type)) {
        status.textContent =
            "The screenshot must be a JPG or PNG image.";
        return;
    }

    if (screenshot.size > 5 * 1024 * 1024) {
        status.textContent =
            "The screenshot exceeds 5 MB. Please choose a smaller image.";
        return;
    }

    const startDate = startInput.value;
    const endDate = endInput.value;

    if (!startDate || !endDate || endDate < startDate) {
        status.textContent =
            "Please select a valid contribution period.";
        return;
    }

    const submissionType = typeInput.value;

    if (!["contribution", "advance"].includes(submissionType)) {
        status.textContent =
            "Please choose a valid contribution type.";
        return;
    }

    // Disable the button to prevent accidental duplicate submissions.
    submitButton.disabled = true;

    let uploadedPath = null;

    try {

        status.textContent =
            "Checking the contribution schedule...";

        // Find the enabled daily contribution schedule.
        const { data: schedules, error: scheduleError } =
            await supabaseClient
                .from("contribution_schedules")
                .select("id, required_amount, is_enabled")
                .eq("schedule_type", "daily")
                .eq("is_enabled", true)
                .limit(1);

        if (scheduleError) {
            throw new Error(
                "Could not load the contribution schedule: " +
                scheduleError.message
            );
        }

        if (!schedules || schedules.length === 0) {
            throw new Error(
                "No enabled daily contribution schedule exists. " +
                "The Admin must activate the KSh 50 daily schedule first."
            );
        }

        const schedule = schedules[0];

        if (Number(schedule.required_amount) !== 50) {
            throw new Error(
                "The enabled daily schedule is not KSh 50. " +
                "Please ask the Admin to check the schedule."
            );
        }

        status.textContent =
            "Uploading payment screenshot...";

        // Use a unique filename inside the member's own folder.
        const safeName = screenshot.name
            .replace(/[^a-zA-Z0-9._-]/g, "_");

        const filePath =
            user.id + "/" +
            Date.now() + "_" +
            safeName;

        // Upload to the existing private storage bucket.
        const { data: uploadData, error: uploadError } =
            await supabaseClient.storage
                .from("contribution-payment-evidence")
                .upload(filePath, screenshot, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: screenshot.type
                });

        if (uploadError) {
            throw new Error(
                "Screenshot upload failed: " +
                uploadError.message
            );
        }

        uploadedPath = uploadData.path;

        status.textContent =
            "Screenshot uploaded. Submitting payment details...";

        // Save the submission as pending verification.
        const { data: result, error: submissionError } =
            await supabaseClient.rpc(
                "submit_contribution_payment",
                {
                    p_amount: amount,
                    p_payment_method: "mpesa",
                    p_payment_phone: phone,
                    p_transaction_reference: reference,
                    p_schedule_id: schedule.id,
                    p_screenshot_path: uploadedPath,
                    p_submission_type: submissionType,
                    p_coverage_start: startDate,
                    p_coverage_end: endDate
                }
            );

        if (submissionError) {
            throw new Error(
                "Payment submission failed: " +
                submissionError.message
            );
        }

        // Handle the response from the existing RPC.
        if (result && result.success === false) {
            throw new Error(
                result.message ||
                "The payment submission was not accepted."
            );
        }

        status.textContent =
            "Payment submitted successfully for verification. " +
            "Your payment has not yet been approved.";

        alert(
            "Your payment details and screenshot have been submitted. " +
            "The Admin/Treasurer must verify the payment before it is approved."
        );

        // Clear the submitted form fields.
        phoneInput.value = "";
        referenceInput.value = "";
        screenshotInput.value = "";

    } catch (error) {

        console.error(
            "Manual contribution submission error:",
            error
        );

        status.textContent =
            error.message ||
            "An error occurred while submitting your payment.";

        /*
         * We deliberately do not delete an uploaded screenshot here.
         * A submission error may happen after the upload succeeds.
         * Keeping the file avoids accidentally removing evidence.
         */

    } finally {

        submitButton.disabled = false;

    }
}
// ========================================================
// CCS VSN30 — TREASURER PAYMENT REVIEW DASHBOARD
// ========================================================

window.openTreasurerDashboard = async function () {
    const status = document.getElementById(
        "treasurerReviewStatus"
    );

    const panel = document.getElementById(
        "treasurerPanel"
    );

    if (status) {
        status.textContent = "Checking your permissions...";
    }

    try {
        const {
            data: { user },
            error: authError
        } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            throw new Error("Please log in first.");
        }

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role, is_active")
                .eq("id", user.id)
                .single();

        if (profileError) throw profileError;

        const role = String(profile.role || "").toLowerCase();

        if (
            profile.is_active !== true ||
            !["admin", "treasurer"].includes(role)
        ) {
            if (panel) panel.style.display = "none";

            throw new Error(
                "Access denied. Only an active Admin or Treasurer can review payments."
            );
        }

        if (panel) {
            panel.style.display = "block";
            panel.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

        await loadTreasurerReviews();

    } catch (error) {
        if (status) {
            status.textContent =
                error.message || "Could not open Treasurer Dashboard.";
        }
    }
};


// ========================================================
// LOAD PENDING PAYMENT SUBMISSIONS
// ========================================================

window.loadTreasurerReviews = async function () {
    const list = document.getElementById(
        "treasurerPendingPaymentsList"
    );

    const status = document.getElementById(
        "treasurerReviewStatus"
    );

    const count = document.getElementById(
        "treasurerPendingCount"
    );

    if (!list) return;

    list.innerHTML = "<p>Loading payment submissions...</p>";

    if (status) {
        status.textContent = "";
    }

    try {
        const { data, error } = await supabaseClient.rpc(
            "get_pending_contribution_reviews"
        );

        if (error) throw error;

        const submissions = Array.isArray(data) ? data : [];

        if (count) {
            count.textContent = String(submissions.length);
        }

        if (submissions.length === 0) {
            list.innerHTML =
                "<p>No pending contribution payments require review.</p>";

            if (status) {
                status.textContent = "Payment review list updated.";
            }

            return;
        }

        list.innerHTML = "";

        for (const item of submissions) {
            const card = document.createElement("div");

            card.className = "dashboard-card";

            const escapeHTML = value =>
                String(value ?? "").replace(
                    /[&<>"']/g,
                    character => ({
                        "&": "&amp;",
                        "<": "&lt;",
                        ">": "&gt;",
                        '"': "&quot;",
                        "'": "&#39;"
                    })[character]
                );

            const amount = Number(item.amount || 0);

            const amountText = amount.toLocaleString(
                "en-KE",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );

            const start = item.coverage_start || "Not provided";
            const end = item.coverage_end || "Not provided";

            const submissionType =
                String(item.submission_type || "").toLowerCase();

            const typeLabel =
                submissionType === "advance"
                    ? "Advance Contribution"
                    : "Regular Contribution";

            const submittedDate = item.submitted_at
                ? new Date(item.submitted_at).toLocaleString()
                : "Not available";

            let screenshotLink =
                "<p>No screenshot was attached.</p>";

            // Generate a temporary link for the private screenshot.
            if (item.screenshot_path) {
                const { data: signedData, error: signedError } =
                    await supabaseClient.storage
                        .from("contribution-payment-evidence")
                        .createSignedUrl(item.screenshot_path, 300);

                if (!signedError && signedData?.signedUrl) {
                    screenshotLink = `
                        <a
                            href="${escapeHTML(signedData.signedUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            🖼️ View Payment Screenshot
                        </a>
                    `;
                } else {
                    screenshotLink =
                        "<p>Screenshot unavailable. Check storage permissions.</p>";
                }
            }

            card.innerHTML = `
                <h3>Payment Awaiting Review</h3>

                <p>
                    <strong>Member:</strong>
                    ${escapeHTML(item.member_name)}
                </p>

                <p>
                    <strong>Member Phone:</strong>
                    ${escapeHTML(item.member_phone)}
                </p>

                <p>
                    <strong>Contribution Type:</strong>
                    ${escapeHTML(typeLabel)}
                </p>

                <p>
                    <strong>Amount:</strong>
                    KSh ${amountText}
                </p>

                <p>
                    <strong>Payment Method:</strong>
                    ${escapeHTML(item.payment_method)}
                </p>

                <p>
                    <strong>M-PESA Phone:</strong>
                    ${escapeHTML(item.payment_phone)}
                </p>

                <p>
                    <strong>Transaction Code:</strong>
                    ${escapeHTML(item.transaction_reference)}
                </p>

                <p>
                    <strong>Coverage Start:</strong>
                    ${escapeHTML(start)}
                </p>

                <p>
                    <strong>Coverage End:</strong>
                    ${escapeHTML(end)}
                </p>

                <p>
                    <strong>Submitted:</strong>
                    ${escapeHTML(submittedDate)}
                </p>

                <p>
                    <strong>Submission ID:</strong>
                    ${escapeHTML(item.submission_id)}
                </p>

                <p>
                    <strong>Payment Evidence:</strong>
                    ${screenshotLink}
                </p>

                <label>
                    Review Note
                </label>

                <textarea
                    id="reviewNote_${escapeHTML(item.submission_id)}"
                    rows="2"
                    maxlength="500"
                    placeholder="Optional approval note, or required rejection reason"
                ></textarea>

                <button
                    type="button"
                    onclick="reviewTreasurerPayment(
                        '${escapeHTML(item.submission_id)}',
                        '${escapeHTML(submissionType)}',
                        'approve'
                    )"
                >
                    ✅ Approve Payment
                </button>

                <button
                    type="button"
                    class="secondary"
                    onclick="reviewTreasurerPayment(
                        '${escapeHTML(item.submission_id)}',
                        '${escapeHTML(submissionType)}',
                        'reject'
                    )"
                >
                    ❌ Reject Payment
                </button>
            `;

            list.appendChild(card);
        }

        if (status) {
            status.textContent =
                "Loaded " + submissions.length +
                " pending payment submission(s).";
        }

    } catch (error) {
        list.innerHTML = "";

        if (status) {
            status.textContent =
                "Could not load payments: " +
                (error.message || "Unknown error");
        }

        console.error(
            "Treasurer payment loading error:",
            error
        );
    }
};


// ========================================================
// APPROVE OR REJECT A PAYMENT
// ========================================================

window.reviewTreasurerPayment = async function (
    submissionId,
    submissionType,
    decision
) {
    const status = document.getElementById(
        "treasurerReviewStatus"
    );

    const noteField = document.getElementById(
        "reviewNote_" + submissionId
    );

    const reviewNote = noteField
        ? noteField.value.trim()
        : "";

    if (decision === "reject" && !reviewNote) {
        alert("Enter a reason before rejecting this payment.");
        return;
    }

    const confirmed = confirm(
        decision === "approve"
            ? "Have you verified the payment against the actual M-PESA transaction? Approve it now?"
            : "Are you sure you want to reject this payment?"
    );

    if (!confirmed) return;

    try {
        if (status) {
            status.textContent = "Processing your decision...";
        }

        let result;

if (submissionType === "advance") {
    result = await supabaseClient.rpc(
        "review_advance_contribution_payment",
        {
            p_submission_id: submissionId,
            p_decision:
                decision === "approve"
                    ? "approved"
                    : "rejected",
            p_review_note: reviewNote || null
        }
    );
} else {
    result = await supabaseClient.rpc(
        "review_contribution_payment",
        {
            p_submission_id: submissionId,
            p_decision:
                decision === "approve"
                    ? "approved"
                    : "rejected",
            p_review_note: reviewNote || null
        }
    );
}

if (result.error) {
    throw result.error;
}

if (!result.data || result.data.success !== true) {
    throw new Error(
        result.data?.message ||
        "Supabase did not confirm the payment review."
    );
}

if (!result.data || result.data.success !== true) {
    throw new Error(
        result.data?.message ||
        "Supabase did not confirm the payment review."
    );
}

        if (status) {
            status.textContent =
                decision === "approve"
                    ? "Payment approved successfully."
                    : "Payment rejected.";
        }

        alert(
            decision === "approve"
                ? "Payment approved."
                : "Payment rejected."
        );

// Refresh the pending payment list.
await window.loadTreasurerReviews();

// Refresh payment history without hiding
// a successful review if history loading fails.
try {
    if (
        typeof window.loadTreasurerPaymentHistory === "function"
    ) {
        await window.loadTreasurerPaymentHistory("all");
    }
} catch (historyError) {
    console.error(
        "Payment history refresh error:",
        historyError
    );
}
    } catch (error) {
        console.error(
            "Treasurer review error:",
            error
        );

        if (status) {
            status.textContent =
                "Review failed: " +
                (error.message || "Unknown error");
        }

        alert(
            "Could not process the review. " +
            (error.message || "Check the Supabase function and permissions.")
        );
    }
};
// ========================================================
// LOAD APPROVED AND REJECTED PAYMENT HISTORY
// ========================================================

window.loadTreasurerPaymentHistory = async function (
filter = "all"
) {
const list = document.getElementById(
"treasurerPaymentHistoryList"
);

const status = document.getElementById(
    "treasurerHistoryStatus"
);

if (!list) return;

const escapeHTML = value =>
    String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]
    );

list.innerHTML = "<p>Loading payment history...</p>";

if (status) {
    status.textContent = "";
}

try {
    const { data, error } = await supabaseClient.rpc(
        "get_contribution_payment_history"
    );

    if (error) throw error;

    const records = Array.isArray(data) ? data : [];

    const reviewedRecords = records.filter(item => {
        const paymentStatus = String(
            item.status || ""
        ).toLowerCase();

        if (filter === "approved") {
            return paymentStatus === "approved";
        }

        if (filter === "rejected") {
            return paymentStatus === "rejected";
        }

        return (
            paymentStatus === "approved" ||
            paymentStatus === "rejected"
        );
    });

    if (reviewedRecords.length === 0) {
        list.innerHTML =
            "<p>No payments found in this history.</p>";

        if (status) {
            status.textContent =
                "No reviewed payments match this filter.";
        }

        return;
    }

    list.innerHTML = "";

    for (const item of reviewedRecords) {
        const card = document.createElement("div");

        card.className = "dashboard-card";

        const paymentStatus = String(
            item.status || ""
        ).toLowerCase();

        const amount = Number(item.amount || 0)
            .toLocaleString("en-KE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

        const submittedDate = item.submitted_at
            ? new Date(
                item.submitted_at
            ).toLocaleString()
            : "Not available";

        const reviewedDate = item.reviewed_at
            ? new Date(
                item.reviewed_at
            ).toLocaleString()
            : "Not available";

        const statusLabel =
            paymentStatus === "approved"
                ? "✅ APPROVED"
                : "❌ REJECTED";

        const typeLabel =
            String(item.submission_type || "")
                .toLowerCase() === "advance"
                ? "Advance Contribution"
                : "Regular Contribution";

        card.innerHTML = `
            <h3>${statusLabel}</h3>

            <p>
                <strong>Member:</strong>
                ${escapeHTML(item.member_name)}
            </p>

            <p>
                <strong>Member Phone:</strong>
                ${escapeHTML(item.member_phone)}
            </p>

            <p>
                <strong>Contribution Type:</strong>
                ${escapeHTML(typeLabel)}
            </p>

            <p>
                <strong>Amount:</strong>
                KSh ${amount}
            </p>

            <p>
                <strong>Payment Method:</strong>
                ${escapeHTML(item.payment_method)}
            </p>

            <p>
                <strong>Transaction Reference:</strong>
                ${escapeHTML(item.transaction_reference)}
            </p>

            <p>
                <strong>Submitted:</strong>
                ${escapeHTML(submittedDate)}
            </p>

            <p>
                <strong>Reviewed:</strong>
                ${escapeHTML(reviewedDate)}
            </p>

            <p>
                <strong>Reviewed By:</strong>
                ${escapeHTML(item.reviewer_name)}
            </p>

            <p>
                <strong>Review Note:</strong>
                ${escapeHTML(item.review_note || "No note provided")}
            </p>
        `;

        list.appendChild(card);
    }

    if (status) {
        status.textContent =
            "Loaded " + reviewedRecords.length +
            " reviewed payment(s).";
    }

} catch (error) {
    console.error(
        "Payment history loading error:",
        error
    );

    list.innerHTML =
        "<p>Payment history could not be loaded.</p>";

    if (status) {
        status.textContent =
            "History error: " +
            (error.message || "Unknown error");
    }
}

};
// ==================================================
// CCS VSN30 — CONTRIBUTION PERIOD CALCULATOR
// KSh 50 per day; both dates are inclusive
// ==================================================

(function initializeContributionCalculator() {
    const period = document.getElementById(
        "contributionPeriod"
    );

    const startDate = document.getElementById(
        "contributionStartDate"
    );

    const endDate = document.getElementById(
        "contributionEndDate"
    );

    const customSection = document.getElementById(
        "customContributionEndSection"
    );

    const daysDisplay = document.getElementById(
        "calculatedContributionDays"
    );

    const totalDisplay = document.getElementById(
        "calculatedContributionTotal"
    );

    const statusDisplay = document.getElementById(
        "contributionCalculationStatus"
    );

    if (
        !period ||
        !startDate ||
        !endDate ||
        !customSection ||
        !daysDisplay ||
        !totalDisplay ||
        !statusDisplay
    ) {
        console.warn(
            "CCS contribution calculator: required HTML fields missing."
        );
        return;
    }

    // Format a date using local calendar components.
    function formatLocalDate(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    // Add calendar days without changing the original date.
    function addCalendarDays(dateString, numberOfDays) {
        const parts = dateString.split("-").map(Number);

        const date = new Date(
            parts[0],
            parts[1] - 1,
            parts[2]
        );

        date.setDate(
            date.getDate() + numberOfDays
        );

        return formatLocalDate(date);
    }

    // Convert YYYY-MM-DD to a UTC day number.
    function getCalendarDayNumber(dateString) {
        const parts = dateString.split("-").map(Number);

        return Date.UTC(
            parts[0],
            parts[1] - 1,
            parts[2]
        ) / 86400000;
    }

    // Initialize the start date to today if empty.
    if (!startDate.value) {
        startDate.value = formatLocalDate(new Date());
    }

    function calculateContributionTotal() {
        const start = startDate.value;
        const selectedPeriod = period.value;

        customSection.style.display =
            selectedPeriod === "custom" ? "block" : "none";

        let numberOfDays = 0;

        if (!start) {
            daysDisplay.textContent = "—";
            totalDisplay.textContent = "—";

            statusDisplay.textContent =
                "Please select a start date.";

            return;
        }

        if (selectedPeriod === "custom") {
            const end = endDate.value;

            if (!end) {
                daysDisplay.textContent = "—";
                totalDisplay.textContent = "—";

                statusDisplay.textContent =
                    "Please select an end date.";

                return;
            }

            const startNumber =
                getCalendarDayNumber(start);

            const endNumber =
                getCalendarDayNumber(end);

            numberOfDays =
                endNumber - startNumber + 1;

            if (numberOfDays < 1) {
                daysDisplay.textContent = "—";
                totalDisplay.textContent = "—";

                statusDisplay.textContent =
                    "The end date cannot be before the start date.";

                return;
            }
        } else {
            numberOfDays = Number(selectedPeriod);

            if (
                !Number.isInteger(numberOfDays) ||
                numberOfDays < 1
            ) {
                daysDisplay.textContent = "—";
                totalDisplay.textContent = "—";

                statusDisplay.textContent =
                    "Please select a valid contribution period.";

                return;
            }

            // For fixed periods, calculate the end date.
            endDate.value = addCalendarDays(
                start,
                numberOfDays - 1
            );
        }

        const dailyRate = 50;

        const totalAmount =
            numberOfDays * dailyRate;

        daysDisplay.textContent =
            numberOfDays +
            (numberOfDays === 1 ? " day" : " days");

        totalDisplay.textContent =
            "KSh " +
            totalAmount.toLocaleString("en-KE");

        statusDisplay.textContent =
            numberOfDays +
            " days × KSh 50 = KSh " +
            totalAmount.toLocaleString("en-KE");
    }

    period.addEventListener(
        "change",
        calculateContributionTotal
    );

    startDate.addEventListener(
        "change",
        calculateContributionTotal
    );

    endDate.addEventListener(
        "change",
        calculateContributionTotal
    );

    calculateContributionTotal();

})();
// =====================================================
// START CONTRIBUTION PAYMENT
// =====================================================

async function startContributionPayment() {

    const amountInput =
        document.getElementById(
            "contributionAmount"
        );

    const dueDateInput =
        document.getElementById(
            "contributionDueDate"
        );

    const phoneInput =
        document.getElementById(
            "contributionPhone"
        );

    const status =
        document.getElementById(
            "contributionStatus"
        );


    if (
        !amountInput ||
        !dueDateInput ||
        !phoneInput ||
        !status
    ) {

        return;

    }


    const amount =
        Number(
            amountInput.value
        );


    const dueDate =
        dueDateInput.value;


    const phone =
        phoneInput.value.trim();


    // =================================================
    // AMOUNT
    // =================================================

    if (
        !amount ||
        amount <= 0
    ) {

        status.textContent =
            "Please enter a valid contribution amount.";

        return;

    }


    // =================================================
    // DUE DATE
    // =================================================

    if (!dueDate) {

        status.textContent =
            "Please select the contribution due date.";

        return;

    }


    // =================================================
    // PAYMENT METHOD
    // =================================================

    if (
        !selectedContributionMethod
    ) {

        status.textContent =
            "Please select a payment method.";

        return;

    }


    // =================================================
    // BANK
    // =================================================

    if (
        selectedContributionMethod ===
        "bank"
    ) {

        status.textContent =
            "Bank payment will be connected next. Please use M-PESA STK for now.";

        return;

    }


    // =================================================
    // M-PESA PHONE
    // =================================================

    if (!isValidPhone(phone)) {

        status.textContent =
            "Enter a valid Kenyan M-PESA phone number.";

        return;

    }


    if (!supabaseClient) {

        status.textContent =
            "Supabase is not connected.";

        return;

    }


    try {

        // =================================================
        // CURRENT USER
        // =================================================

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabaseClient.auth
                .getUser();


        if (
            userError ||
            !user
        ) {

            status.textContent =
                "Please log in again.";

            return;

        }


        // =================================================
        // CREATE PENDING CONTRIBUTION
        // =================================================

        status.textContent =
            "Creating pending contribution...";


        const {
            data: contribution,
            error: contributionError
        } =
            await supabaseClient
                .from("contributions")
                .insert([
                    {

                        user_id:
                            user.id,

                        expected_amount:
                            amount,

                        amount_paid:
                            0,

                        due_date:
                            dueDate,

                        status:
                            "pending",

                        penalty_amount:
                            0,

                        payment_method:
                            "mpesa",

                        payment_status:
                            "pending",

