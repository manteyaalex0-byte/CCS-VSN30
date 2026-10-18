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

                        payment_phone:
                            normalizePhone(
                                phone
                            )

                    }
                ])
                .select()
                .single();


        if (contributionError) {

            console.error(
                "Contribution creation error:",
                contributionError
            );

            status.textContent =
                "Could not create contribution: " +
                contributionError.message;

            return;

        }


        console.log(
            "Pending contribution created:",
            contribution
        );


        // =================================================
        // SEND STK PUSH
        // =================================================

        status.textContent =
            "Sending M-PESA STK Push...";


        const {
            data: functionData,
            error: functionError
        } =
            await supabaseClient.functions.invoke(
                "mpesa-stk",
                {
                    body: {

                        phone:
                            normalizePhone(
                                phone
                            ),

                        amount:
                            amount,

                        contribution_id:
                            contribution.id

                    }
                }
            );


        if (functionError) {

            console.error(
                "STK function error:",
                functionError
            );

            status.textContent =
                "Could not start M-PESA payment: " +
                functionError.message;

            return;

        }


        console.log(
            "STK response:",
            functionData
        );


        if (
            !functionData ||
            !functionData.success
        ) {

            status.textContent =
                "M-PESA payment could not be started: " +
                (
                    functionData?.error ||
                    "Unknown error"
                );

            return;

        }


        status.textContent =
            "STK Push sent! Check your phone and enter your M-PESA PIN.";

    } catch (error) {

        console.error(
            "Contribution payment error:",
            error
        );

        status.textContent =
            "Payment error: " +
            error.message;

    }

}


// =====================================================
// MAKE FUNCTIONS AVAILABLE TO HTML onclick=""
// =====================================================

window.showScreen =
    showScreen;

window.goToSubscription =
    goToSubscription;

window.startPayment =
    startPayment;

window.verifyOTP =
    verifyOTP;

window.loginUser =
    loginUser;

window.requestPasswordReset =
    requestPasswordReset;

window.resetPassword =
    resetPassword;

window.createWithdrawal =
    createWithdrawal;

window.logoutUser =
    logoutUser;

window.loadWithdrawalVoting =
    loadWithdrawalVoting;

window.voteOnWithdrawal =
    voteOnWithdrawal;

window.rejectWithdrawal =
    rejectWithdrawal;

window.openAdminPanel =
    openAdminPanel;

window.closeAdminPanel =
    closeAdminPanel;

window.loadAdminMembers =
    loadAdminMembers;

window.loadAdminContributions =
    loadAdminContributions;

window.loadAdminWithdrawals =
    loadAdminWithdrawals;

window.loadAdminVoting =
    loadAdminVoting;

window.selectContributionMethod =
    selectContributionMethod;

window.startContributionPayment =
    startContributionPayment;

window.isValidPhone =
    isValidPhone;

window.normalizePhone =
    normalizePhone;


console.log(
    "CCS VSN30 functions loaded successfully"
);
/* =========================================
   CCS VSN30 — REPORTS, FORUM & MESSAGES
========================================= */

(function () {
    "use strict";

    let contributionsChart = null;
    let withdrawalsChart = null;

    const CCS_WHATSAPP_LINK =
        "https://chat.whatsapp.com/Jh5VFBAX2DT8zSsSwWfbon?s=cl&p=a&mlu=4&ilr=4&iam=0";

    function ccsUserId() {
        return window.currentProfile?.id ||
               (typeof currentProfile !== "undefined"
                   ? currentProfile?.id
                   : null);
    }

    function ccsProfile() {
        return window.currentProfile ||
            (typeof currentProfile !== "undefined"
                ? currentProfile
                : null);
    }

    function ccsElement(id) {
        return document.getElementById(id);
    }

    function ccsStatus(id, message, error) {
        const element = ccsElement(id);
        if (!element) return;

        element.textContent = message;
        element.style.color = error ? "#ff7777" : "#5bdcff";
    }

    function ccsMoney(amount) {
        return Number(amount || 0).toLocaleString("en-KE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function ccsDate(date) {
        if (!date) return "Date unavailable";

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return "Date unavailable";
        }

        return parsed.toLocaleString("en-KE", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function ccsMake(tag, text, className) {
        const element = document.createElement(tag);

        if (text !== undefined && text !== null) {
            element.textContent = String(text);
        }

        if (className) {
            element.className = className;
        }

        return element;
    }

    function ccsRequireLogin() {
        if (!ccsUserId()) {
            alert("Please log in first.");
            return false;
        }

        if (!window.supabaseClient &&
            typeof supabaseClient === "undefined") {
            alert("Supabase is not initialized. Please refresh the app.");
            return false;
        }

        return true;
    }

    function ccsDb() {
        return window.supabaseClient ||
            (typeof supabaseClient !== "undefined"
                ? supabaseClient
                : null);
    }

    /* =========================================
       BOTTOM NAVIGATION
    ========================================= */

    window.navigateDashboard = async function (targetId) {
        const target = ccsElement(targetId);

        if (!target) {
            alert("Section not found: " + targetId);
            return;
        }

        if (targetId === "dashboardScreen") {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            return;
        }

        if (!ccsRequireLogin()) return;

        target.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        if (targetId === "reportsPanel") {
            await window.loadReports();
        }

        if (targetId === "forumPanel") {
            await window.loadForum();
        }

        if (targetId === "messagesPanel") {
            await window.loadMemberDirectory();
            await window.loadPrivateMessages();
        }
    };

    /* =========================================
       MEMBER DIRECTORY
    ========================================= */

    window.loadMemberDirectory = async function () {
        if (!ccsRequireLogin()) return;

        const select = ccsElement("messageRecipient");
        if (!select) return;

        const db = ccsDb();
        const myId = ccsUserId();

        const { data, error } = await db
            .from("profiles")
            .select("id, full_name, role, is_active")
            .eq("is_active", true)
            .order("full_name", { ascending: true });

        if (error) {
            ccsStatus(
                "messageStatus",
                "Could not load members. Check profiles table permissions.",
                true
            );
            console.error("Member directory:", error);
            return;
        }

        const previousValue = select.value;

        select.replaceChildren();

        const placeholder = ccsMake(
            "option",
            "Choose a member to message"
        );

        placeholder.value = "";
        select.appendChild(placeholder);

        (data || [])
            .filter(member => member.id !== myId)
            .forEach(member => {
                const option = ccsMake(
                    "option",
                    member.full_name || member.role || "Member"
                );

                option.value = member.id;
                select.appendChild(option);
            });

        if ([...select.options].some(
            option => option.value === previousValue
        )) {
            select.value = previousValue;
        }
    };

    /* =========================================
       REPORTS AND CHARTS
    ========================================= */

    window.loadReports = async function () {
        if (!ccsRequireLogin()) return;

        const db = ccsDb();

        ccsStatus("reportContributions", "Loading contributions…");
        ccsStatus("reportWithdrawals", "Loading withdrawals…");

        const [contributionResult, withdrawalResult] =
            await Promise.all([
                db.from("contributions")
                    .select("*")
                    .limit(5000),

                db.from("withdrawals")
                    .select("*")
                    .limit(5000)
            ]);

        if (contributionResult.error) {
            ccsStatus(
                "reportContributions",
                "Unable to load contribution records.",
                true
            );

            console.error(
                "Contribution report:",
                contributionResult.error
            );
        }

        if (withdrawalResult.error) {
            ccsStatus(
                "reportWithdrawals",
                "Unable to load withdrawal records.",
                true
            );

            console.error(
                "Withdrawal report:",
                withdrawalResult.error
            );
        }

        const contributions = contributionResult.data || [];
        const withdrawals = withdrawalResult.data || [];

        const paidContributions = contributions.filter(
            row => Number(row.amount_paid || 0) > 0
        );

        const approvedWithdrawals = withdrawals.filter(row => {
            const status = String(row.status || "").toLowerCase();

            return [
                "approved",
                "completed",
                "paid",
                "successful"
            ].includes(status);
        });

        const contributionTotal = paidContributions.reduce(
            (sum, row) => sum + Number(row.amount_paid || 0),
            0
        );

        const withdrawalTotal = approvedWithdrawals.reduce(
            (sum, row) => sum + Number(
                row.amount ??
                row.amount_requested ??
                row.amount_withdrawn ??
                0
            ),
            0
        );

        ccsStatus(
            "reportContributions",
            contributionResult.error
                ? "Contribution data unavailable"
                : "Total recorded contributions: KSh " +
                  ccsMoney(contributionTotal)
        );

        ccsStatus(
            "reportWithdrawals",
            withdrawalResult.error
                ? "Withdrawal data unavailable"
                : "Total approved withdrawals: KSh " +
                  ccsMoney(withdrawalTotal)
        );

        function monthlyTotals(rows, amountField, approvedOnly) {
            const totals = {};

            rows.forEach(row => {
                const status = String(
                    row.status || ""
                ).toLowerCase();

                if (
                    approvedOnly &&
                    ![
                        "approved",
                        "completed",
                        "paid",
                        "successful"
                    ].includes(status)
                ) {
                    return;
                }

                const amount = Number(
                    row[amountField] ??
                    row.amount ??
                    row.amount_requested ??
                    row.amount_withdrawn ??
                    0
                );

                const dateValue =
                    row.paid_at ||
                    row.created_at ||
                    row.date ||
                    row.withdrawal_date;

                if (!dateValue || !Number.isFinite(amount)) return;

                const date = new Date(dateValue);

                if (Number.isNaN(date.getTime())) return;

                const key =
                    date.getFullYear() + "-" +
                    String(date.getMonth() + 1).padStart(2, "0");

                totals[key] = (totals[key] || 0) + amount;
            });

            return totals;
        }

        function chartLabels(totals) {
            const keys = Object.keys(totals).sort().slice(-12);

            if (!keys.length) {
                return {
                    labels: ["No data"],
                    values: [0]
                };
            }

            return {
                labels: keys,
                values: keys.map(key => totals[key])
            };
        }

        if (typeof Chart !== "undefined") {
            const contributionCanvas =
                ccsElement("contributionsChart");

            if (contributionCanvas && !contributionResult.error) {
                const totals = monthlyTotals(
                    paidContributions,
                    "amount_paid",
                    false
                );

                const result = chartLabels(totals);

                if (contributionsChart) {
                    contributionsChart.destroy();
                }

                contributionsChart = new Chart(
                    contributionCanvas,
                    {
                        type: "bar",
                        data: {
                            labels: result.labels,
                            datasets: [{
                                label: "Contributions (KSh)",
                                data: result.values,
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false
                        }
                    }
                );
            }

            const withdrawalCanvas =
                ccsElement("withdrawalsChart");

            if (withdrawalCanvas && !withdrawalResult.error) {
                const totals = monthlyTotals(
                    approvedWithdrawals,
                    "amount",
                    false
                );

                const result = chartLabels(totals);

                if (withdrawalsChart) {
                    withdrawalsChart.destroy();
                }

                withdrawalsChart = new Chart(
                    withdrawalCanvas,
                    {
                        type: "line",
                        data: {
                            labels: result.labels,
                            datasets: [{
                                label: "Approved withdrawals (KSh)",
                                data: result.values,
                                borderWidth: 2,
                                tension: 0.25
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false
                        }
                    }
                );
            }
        } else {
            console.warn(
                "Chart.js is missing. Add its CDN script before app.js."
            );
        }

        await window.loadMemberPerformance(paidContributions);
    };

    /* =========================================
       INDIVIDUAL MEMBER PERFORMANCE
    ========================================= */

    window.loadMemberPerformance = async function (records) {
        if (!ccsRequireLogin()) return;

        const container = ccsElement("memberPerformance");
        if (!container) return;

        container.replaceChildren(
            ccsMake("p", "Loading member performance…")
        );

        const db = ccsDb();

        if (!records) {
            const result = await db
                .from("contributions")
                .select("*")
                .limit(5000);

            if (result.error) {
                container.replaceChildren(
                    ccsMake(
                        "p",
                        "Unable to load member contribution records."
                    )
                );
                console.error(result.error);
                return;
            }

            records = (result.data || []).filter(
                row => Number(row.amount_paid || 0) > 0
            );
        }

        const totals = {};

        records.forEach(row => {
            if (!row.user_id) return;

            totals[row.user_id] =
                (totals[row.user_id] || 0) +
                Number(row.amount_paid || 0);
        });

        const profileResult = await db
            .from("profiles")
            .select("id, full_name, role")
            .limit(1000);

        const names = {};

        if (!profileResult.error) {
            (profileResult.data || []).forEach(profile => {
                names[profile.id] =
                    profile.full_name ||
                    profile.role ||
                    "Member";
            });
        }

        container.replaceChildren();

        const ranked = Object.entries(totals)
            .sort((a, b) => b[1] - a[1]);

        if (!ranked.length) {
            container.appendChild(
                ccsMake(
                    "p",
                    "No contribution records are available to display."
                )
            );
            return;
        }

        ranked.forEach(([userId, total], index) => {
            const item = ccsMake("div", null, "performance-item");

            item.appendChild(
                ccsMake(
                    "h4",
                    (index + 1) + ". " +
                    (names[userId] || "Member")
                )
            );

            item.appendChild(
                ccsMake(
                    "p",
                    "Recorded contributions: KSh " + ccsMoney(total)
                )
            );

            container.appendChild(item);
        });

        if (profileResult.error) {
            console.warn(
                "Member names could not be loaded:",
                profileResult.error
            );
        }
    };

    /* =========================================
       FORUM
    ========================================= */

    window.loadForum = async function () {
        if (!ccsRequireLogin()) return;

        const db = ccsDb();
        const container = ccsElement("forumPostsList");

        if (!container) return;

        container.replaceChildren(
            ccsMake("p", "Loading forum posts…")
        );

        const result = await db
            .from("forum_posts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(30);

        if (result.error) {
            container.replaceChildren(
                ccsMake(
                    "p",
                    "Unable to load forum posts. Check your Supabase policies."
                )
            );

            console.error("Forum loading:", result.error);
            return;
        }

        container.replaceChildren();

        const posts = result.data || [];

        if (!posts.length) {
            container.appendChild(
                ccsMake("p", "No forum posts yet. Start a discussion!")
            );
            return;
        }

        const profileResult = await db
            .from("profiles")
            .select("id, full_name, role")
            .limit(1000);

        const names = {};

        if (!profileResult.error) {
            (profileResult.data || []).forEach(profile => {
                names[profile.id] =
                    profile.full_name ||
                    profile.role ||
                    "Member";
            });
        }

        for (const post of posts) {
            const card = ccsMake("article", null, "forum-post");

            if (post.is_announcement) {
                card.appendChild(
                    ccsMake("strong", "📢 ADMIN ANNOUNCEMENT")
                );
            }

            card.appendChild(
                ccsMake("h4", post.title || "Forum discussion")
            );

            card.appendChild(
                ccsMake(
                    "small",
                    "By " + (names[post.user_id] || "Member") +
                    " • " + ccsDate(post.created_at)
                )
            );

            card.appendChild(
                ccsMake("p", post.body || "")
            );

            const commentsBox = ccsMake("div", null, "forum-comments");
            commentsBox.appendChild(
                ccsMake("strong", "Comments")
            );

            const commentsResult = await db
                .from("forum_comments")
                .select("*")
                .eq("post_id", post.id)
                .order("created_at", { ascending: true });

            if (commentsResult.error) {
                commentsBox.appendChild(
                    ccsMake("p", "Comments could not be loaded.")
                );
            } else if (!commentsResult.data?.length) {
                commentsBox.appendChild(
                    ccsMake("p", "No comments yet.")
                );
            } else {
                commentsResult.data.forEach(comment => {
                    const commentBox = ccsMake(
                        "div",
                        null,
                        "forum-comment"
                    );

                    commentBox.appendChild(
                        ccsMake(
                            "small",
                            (names[comment.user_id] || "Member") +
                            " • " + ccsDate(comment.created_at)
                        )
                    );

                    commentBox.appendChild(
                        ccsMake("p", comment.body || "")
                    );

                    commentsBox.appendChild(commentBox);
                });
            }

            const commentInput = ccsMake("textarea");
            commentInput.placeholder = "Write a comment…";
            commentInput.rows = 2;
            commentInput.maxLength = 2000;

            const commentButton = ccsMake(
                "button",
                "Add Comment"
            );

            commentButton.type = "button";

            commentButton.addEventListener("click", async () => {
                const body = commentInput.value.trim();

                if (!body) {
                    alert("Please write a comment first.");
                    return;
                }

                commentButton.disabled = true;

                const insertResult = await db
                    .from("forum_comments")
                    .insert({
                        post_id: post.id,
                        user_id: ccsUserId(),
                        body
                    });

                commentButton.disabled = false;

                if (insertResult.error) {
                    alert(
                        "Comment failed: " + insertResult.error.message
                    );
                    return;
                }

                await window.loadForum();
            });

            card.appendChild(commentsBox);
            card.appendChild(commentInput);
            card.appendChild(commentButton);

            container.appendChild(card);
        }
    };

    window.createForumPost = async function () {
        if (!ccsRequireLogin()) return;

        const titleInput = ccsElement("forumTitle");
        const bodyInput = ccsElement("forumBody");

        const title = titleInput?.value.trim();
        const body = bodyInput?.value.trim();

        if (!title || !body) {
            ccsStatus(
                "forumStatus",
                "Enter both a title and a message.",
                true
            );
            return;
        }

        if (title.length > 150 || body.length > 5000) {
            ccsStatus(
                "forumStatus",
                "Title limit: 150 characters. Message limit: 5,000.",
                true
            );
            return;
        }

        const db = ccsDb();

        const result = await db
            .from("forum_posts")
            .insert({
                user_id: ccsUserId(),
                title,
                body,
                is_announcement: false
            });

        if (result.error) {
            ccsStatus(
                "forumStatus",
                "Could not publish post: " + result.error.message,
                true
            );
            return;
        }

        titleInput.value = "";
        bodyInput.value = "";

        ccsStatus("forumStatus", "Post published successfully!");
        await window.loadForum();
    };

    /* =========================================
       PRIVATE MEMBER MESSAGES
    ========================================= */

    window.sendPrivateMessage = async function () {
        if (!ccsRequireLogin()) return;

        const recipient = ccsElement("messageRecipient")?.value;
        const bodyInput = ccsElement("privateMessageBody");
        const body = bodyInput?.value.trim();

        if (!recipient) {
            ccsStatus(
                "messageStatus",
                "Choose a member first.",
                true
            );
            return;
        }

        if (!body) {
            ccsStatus(
                "messageStatus",
                "Write a message first.",
                true
            );
            return;
        }

        if (body.length > 5000) {
            ccsStatus(
                "messageStatus",
                "Messages must be 5,000 characters or fewer.",
                true
            );
            return;
        }

        const result = await ccsDb()
            .from("private_messages")
            .insert({
                sender_id: ccsUserId(),
                recipient_id: recipient,
                body
            });

        if (result.error) {
            ccsStatus(
                "messageStatus",
                "Message failed: " + result.error.message,
                true
            );
            return;
        }

        bodyInput.value = "";

        ccsStatus("messageStatus", "Message sent successfully!");

        await window.loadPrivateMessages();
    };

    window.loadPrivateMessages = async function () {
        if (!ccsRequireLogin()) return;

        const container = ccsElement("privateMessagesList");
        if (!container) return;

        const recipient = ccsElement("messageRecipient")?.value;

        container.replaceChildren();

        if (!recipient) {
            container.appendChild(
                ccsMake(
                    "p",
                    "Choose a member above to view your conversation."
                )
            );
            return;
        }

        const db = ccsDb();
        const myId = ccsUserId();

        const result = await db
            .from("private_messages")
            .select("*")
            .or(
                "and(sender_id.eq." + myId +
                ",recipient_id.eq." + recipient +
                ")," +
                "and(sender_id.eq." + recipient +
                ",recipient_id.eq." + myId + ")"
            )
            .order("created_at", { ascending: true })
            .limit(500);

        if (result.error) {
            container.appendChild(
                ccsMake(
                    "p",
                    "Unable to load messages. Check your Supabase policies."
                )
            );

            console.error("Private messages:", result.error);
            return;
        }

        const messages = result.data || [];

        if (!messages.length) {
            container.appendChild(
                ccsMake("p", "No messages yet. Start the conversation!")
            );
            return;
        }

        for (const message of messages) {
            const mine = message.sender_id === myId;

            const card = ccsMake(
                "div",
                null,
                "private-message"
            );

            card.appendChild(
                ccsMake(
                    "h4",
                    mine ? "You" : "Member"
                )
            );

            card.appendChild(
                ccsMake("p", message.body || "")
            );

            card.appendChild(
                ccsMake("small", ccsDate(message.created_at))
            );

            container.appendChild(card);
        }

        const unreadIds = messages
            .filter(message =>
                message.recipient_id === myId &&
                !message.read_at
            )
            .map(message => message.id);

        if (unreadIds.length) {
            const updateResult = await db
                .from("private_messages")
                .update({ read_at: new Date().toISOString() })
                .in("id", unreadIds);

            if (updateResult.error) {
                console.warn(
                    "Could not mark messages as read:",
                    updateResult.error
                );
            }
        }

        container.scrollTop = container.scrollHeight;
    };

    /* =========================================
       AUTOMATIC REFRESH WHEN RECIPIENT CHANGES
    ========================================= */

    document.addEventListener("DOMContentLoaded", function () {
        const recipient = ccsElement("messageRecipient");

        if (recipient) {
            recipient.addEventListener("change", function () {
                window.loadPrivateMessages();
            });
        }

        const whatsapp = ccsElement("whatsappGroupLink");

        if (whatsapp) {
            whatsapp.href = CCS_WHATSAPP_LINK;
            whatsapp.target = "_blank";
            whatsapp.rel = "noopener noreferrer";
        }

        console.log("CCS VSN30 new features loaded.");
    });

})();
/* =========================================================
CCS VSN30 — COMMUNITY, GROUP CHAT & REPORTS PATCH
Preserves the existing Supabase connection and design.
========================================================= */

(function () {
"use strict";

console.log("CCS VSN30 community and reports patch loaded.");

/* ---------- SHARED HELPERS ---------- */

function ccsPatchDb() {
    return window.supabaseClient ||
        (typeof supabaseClient !== "undefined"
            ? supabaseClient
            : null);
}

function ccsPatchProfile() {
    return window.currentProfile ||
        (typeof currentProfile !== "undefined"
            ? currentProfile
            : null);
}

function ccsEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char];
    });
}

function ccsStatus(id, message, isError) {
    const element = document.getElementById(id);
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#ff7777" : "#38c98a";
}

function ccsFormatMoney(value) {
    return Number(value || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/* ---------- COMMUNITY NAVIGATION ---------- */

window.openCommunity = function () {
    const community = document.querySelector(".community-screen");

    if (community) {
        community.classList.add("community-open");
        community.setAttribute("aria-hidden", "false");
    }

    if (typeof window.loadGroupChat === "function") {
        window.loadGroupChat();
    }
};

window.closeCommunity = function () {
    const community = document.querySelector(".community-screen");

    if (community) {
        community.classList.remove("community-open");
        community.setAttribute("aria-hidden", "true");
    }
};

window.openCommunityTab = function (tab) {
    const community = document.querySelector(".community-screen");

    if (community) {
        community.classList.add("community-open");
    }

    const groupTab = document.getElementById("groupChatTab");
    const discussionTab = document.getElementById("discussionsTab");

    const groupContent = document.getElementById("groupChatContent");
    const discussionContent = document.getElementById("discussionsContent");

    const wantsGroup = /group|chat/i.test(String(tab || ""));

    if (groupContent) {
        groupContent.style.display = wantsGroup ? "block" : "none";
    }

    if (discussionContent) {
        discussionContent.style.display = wantsGroup ? "none" : "block";
    }

    if (groupTab) {
        groupTab.classList.toggle("active", wantsGroup);
    }

    if (discussionTab) {
        discussionTab.classList.toggle("active", !wantsGroup);
    }

    if (wantsGroup && typeof window.loadGroupChat === "function") {
        window.loadGroupChat();
    }

    if (!wantsGroup && typeof window.loadForum === "function") {
        window.loadForum();
    }
};

/* ---------- GROUP CHAT ---------- */

let groupChatLoading = false;
let groupChatTimer = null;

window.loadGroupChat = async function () {
    if (groupChatLoading) return;

    const db = ccsPatchDb();
    const profile = ccsPatchProfile();
    const container = document.getElementById("groupChatMessages");

    if (!db || !profile || !container) return;

    groupChatLoading = true;

    try {
        const { data: messages, error } = await db
            .from("group_chat_messages")
            .select("id,user_id,body,created_at")
            .order("created_at", { ascending: true })
            .limit(200);

        if (error) throw error;

        const userIds = [...new Set(
            (messages || []).map(message => message.user_id).filter(Boolean)
        )];

        let profilesById = {};

        if (userIds.length) {
            const { data: profiles, error: profilesError } = await db
                .from("profiles")
                .select("id,full_name,role")
                .in("id", userIds);

            if (profilesError) {
                console.warn("Could not load chat member names:", profilesError.message);
            } else {
                (profiles || []).forEach(member => {
                    profilesById[member.id] = member;
                });
            }
        }

        if (!messages || messages.length === 0) {
            container.innerHTML =
                '<p class="chat-empty">No messages yet. Start the conversation!</p>';
            return;
        }

        container.innerHTML = messages.map(message => {
            const sender = profilesById[message.user_id] || {};
            const ownMessage = message.user_id === profile.id;

            const time = message.created_at
                ? new Date(message.created_at).toLocaleString("en-KE", {
                    dateStyle: "short",
                    timeStyle: "short"
                })
                : "";

            return `
                <div class="chat-message ${ownMessage ? "own-message" : ""}">
                    <div class="chat-message-header">
                        <strong>${ccsEscape(
                            ownMessage ? "You" : (sender.full_name || "Member")
                        )}</strong>
                        <small>${ccsEscape(time)}</small>
                    </div>
                    <div class="chat-message-body">${ccsEscape(message.body)}</div>
                </div>
            `;
        }).join("");

        container.scrollTop = container.scrollHeight;

    } catch (error) {
        console.error("Group chat loading failed:", error);
        ccsStatus(
            "groupChatStatus",
            "Could not load messages. Check your connection and chat-table permissions.",
            true
        );
    } finally {
        groupChatLoading = false;
    }
};

window.sendGroupChatMessage = async function () {
    const db = ccsPatchDb();
    const profile = ccsPatchProfile();
    const input = document.getElementById("groupChatInput");

    if (!db || !profile) {
        ccsStatus("groupChatStatus", "Please log in before sending messages.", true);
        return;
    }

    if (!input) {
        console.error("Missing HTML element: groupChatInput");
        return;
    }

    const body = input.value.trim();

    if (!body) {
        ccsStatus("groupChatStatus", "Type a message first.", true);
        return;
    }

    if (body.length > 2000) {
        ccsStatus("groupChatStatus", "Messages must be 2,000 characters or fewer.", true);
        return;
    }

    const sendButton = document.querySelector(
        '[onclick*="sendGroupChatMessage"]'
    );

    if (sendButton) sendButton.disabled = true;

    try {
        const { error } = await db
            .from("group_chat_messages")
            .insert({
                user_id: profile.id,
                body: body
            });

        if (error) throw error;

        input.value = "";
        ccsStatus("groupChatStatus", "Message sent.", false);

        await window.loadGroupChat();

    } catch (error) {
        console.error("Sending group chat message failed:", error);

        ccsStatus(
            "groupChatStatus",
            "Message was not sent. Check the group_chat_messages table and its RLS policies.",
            true
        );
    } finally {
        if (sendButton) sendButton.disabled = false;
    }
};

/* Refresh messages periodically while the page is visible. */

function startGroupChatRefresh() {
    if (groupChatTimer) clearInterval(groupChatTimer);

    groupChatTimer = setInterval(function () {
        const community = document.querySelector(".community-screen");

        if (
            document.visibilityState === "visible" &&
            community &&
            community.classList.contains("community-open")
        ) {
            window.loadGroupChat();
        }
    }, 15000);
}

startGroupChatRefresh();

/* ---------- FINANCIAL REPORTS ---------- */

window.loadReports = async function () {
    const db = ccsPatchDb();

    if (!db) {
        console.error("Supabase is not initialized.");
        return;
    }

    const contributionElement = document.getElementById("reportContributions");
    const withdrawalElement = document.getElementById("reportWithdrawals");

    if (contributionElement) contributionElement.textContent = "Loading...";
    if (withdrawalElement) withdrawalElement.textContent = "Loading...";

    try {
        const [contributionResult, withdrawalResult] = await Promise.all([
            db.from("contributions")
                .select("id,user_id,amount_paid,status,created_at")
                .limit(5000),

            db.from("withdrawals")
                .select("id,requested_by,amount,status,created_at")
                .limit(5000)
        ]);

        if (contributionResult.error) throw contributionResult.error;
        if (withdrawalResult.error) throw withdrawalResult.error;

        const contributions = contributionResult.data || [];
        const withdrawals = withdrawalResult.data || [];

        const totalContributions = contributions.reduce((sum, item) => {
            return sum + Math.max(0, Number(item.amount_paid) || 0);
        }, 0);

        const successfulStatuses = [
            "approved",
            "completed",
            "paid",
            "successful"
        ];

        const approvedWithdrawals = withdrawals.filter(item =>
            successfulStatuses.includes(
                String(item.status || "").toLowerCase()
            )
        );

        const totalWithdrawals = approvedWithdrawals.reduce((sum, item) => {
            return sum + Math.max(0, Number(item.amount) || 0);
        }, 0);

        if (contributionElement) {
            contributionElement.textContent =
                "KSh " + ccsFormatMoney(totalContributions);
        }

        if (withdrawalElement) {
            withdrawalElement.textContent =
                "KSh " + ccsFormatMoney(totalWithdrawals);
        }

        /* Update charts only when the existing canvases are available. */

        const contributionCanvas = document.getElementById("contributionsChart");
        const withdrawalCanvas = document.getElementById("withdrawalsChart");

        if (typeof window.Chart !== "undefined") {
            const monthlyTotals = function (rows, amountField) {
                const totals = {};

                rows.forEach(row => {
                    if (!row.created_at) return;

                    const date = new Date(row.created_at);
                    if (Number.isNaN(date.getTime())) return;

                    const key =
                        date.getFullYear() + "-" +
                        String(date.getMonth() + 1).padStart(2, "0");

                    totals[key] = (totals[key] || 0) +
                        Math.max(0, Number(row[amountField]) || 0);
                });

                const keys = Object.keys(totals).sort();

                return {
                    labels: keys,
                    values: keys.map(key => totals[key])
                };
            };

            function updateChart(canvas, chartKey, rows, amountField) {
                if (!canvas) return;

                const totals = monthlyTotals(rows, amountField);

                if (window[chartKey]) {
                    window[chartKey].destroy();
                }

                window[chartKey] = new window.Chart(canvas, {
                    type: "bar",
                    data: {
                        labels: totals.labels,
                        datasets: [{
                            label: "Amount (KSh)",
                            data: totals.values
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            }

            updateChart(
                contributionCanvas,
                "ccsContributionsReportChart",
                contributions,
                "amount_paid"
            );

            updateChart(
                withdrawalCanvas,
                "ccsWithdrawalsReportChart",
                approvedWithdrawals,
                "amount"
            );
        }

        if (typeof window.loadMemberPerformance === "function") {
            await window.loadMemberPerformance(contributions);
        }

    } catch (error) {
        console.error("Financial reports failed:", error);

        if (contributionElement) {
            contributionElement.textContent = "Unable to load";
        }

        if (withdrawalElement) {
            withdrawalElement.textContent = "Unable to load";
        }

        alert(
            "Reports could not be loaded. Check the browser console and Supabase permissions."
        );
    }
};

})();
/* =====================================================
   CCS VSN30 — GROUP CHAT DASHBOARD
   Reply • Edit Own Messages • Resubmit • Edited Label
===================================================== */

(function () {
    "use strict";

    let replyToMessage = null;
    let editingChatMessage = null;
    let chatRequestInProgress = false;

    function chatDb() {
        return window.supabaseClient ||
            (typeof supabaseClient !== "undefined"
                ? supabaseClient
                : null);
    }

    function chatProfile() {
        return window.currentProfile ||
            (typeof currentProfile !== "undefined"
                ? currentProfile
                : null);
    }

    function chatElement(id) {
        return document.getElementById(id);
    }

    function chatStatus(message, isError) {
        const element = chatElement("groupChatStatus");

        if (!element) return;

        element.textContent = message;

        element.style.color = isError
            ? "#ff7777"
            : "#5bdcff";
    }

    function chatEscape(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            function (character) {
                return {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                }[character];
            }
        );
    }

    function chatDate(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString("en-KE", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function requireChatLogin() {
        if (!chatDb() || !chatProfile()?.id) {
            chatStatus(
                "Please log in before using Group Chat.",
                true
            );

            return false;
        }

        return true;
    }


    /* =========================================
       OPEN CHAT DASHBOARD
    ========================================= */

    window.openGroupChatDashboard = async function () {
        if (!requireChatLogin()) return;

        const dashboard = chatElement("chatDashboard");

        if (!dashboard) {
            alert("The Group Chat dashboard HTML is missing.");
            return;
        }

        dashboard.classList.add("chat-dashboard-open");

        dashboard.setAttribute("aria-hidden", "false");

        document.body.classList.add("chat-dashboard-active");

        await window.loadGroupChat();

        const input = chatElement("groupChatInput");

        if (input) {
            input.focus();
        }
    };


    /* =========================================
       CLOSE CHAT DASHBOARD
    ========================================= */

    window.closeGroupChatDashboard = function () {
        const dashboard = chatElement("chatDashboard");

        if (dashboard) {
            dashboard.classList.remove("chat-dashboard-open");

            dashboard.setAttribute("aria-hidden", "true");
        }

        document.body.classList.remove("chat-dashboard-active");
    };


    /* =========================================
       REPLY PREVIEW
    ========================================= */

    window.cancelChatReply = function () {
        replyToMessage = null;

        const preview = chatElement("chatReplyPreview");

        if (preview) {
            preview.style.display = "none";
        }
    };


    function startChatReply(message) {
        replyToMessage = message;

        // Editing and replying are separate operations.
        if (editingChatMessage) {
            window.cancelChatEdit();
        }

        const preview = chatElement("chatReplyPreview");
        const previewText = chatElement("chatReplyText");
        const input = chatElement("groupChatInput");

        if (preview) {
            preview.style.display = "flex";
        }

        if (previewText) {
            previewText.textContent =
                (message.senderName || "Member") +
                ": " +
                (message.body || "");
        }

        if (input) {
            input.focus();
        }

        chatStatus("Replying to selected message.", false);
    }


    /* =========================================
       EDIT OWN MESSAGE
    ========================================= */

    window.startChatEdit = function (message) {
        const profile = chatProfile();

        if (!profile || message.user_id !== profile.id) {
            chatStatus(
                "You can only edit your own messages.",
                true
            );

            return;
        }

        if (replyToMessage) {
            window.cancelChatReply();
        }

        editingChatMessage = message;

        const input = chatElement("groupChatInput");
        const submitButton = chatElement("groupChatSubmitButton");
        const cancelButton = chatElement("groupChatCancelEditButton");

        if (input) {
            input.value = message.body || "";
            input.focus();
        }

        if (submitButton) {
            submitButton.textContent = "Save Changes / Resubmit";
        }

        if (cancelButton) {
            cancelButton.style.display = "inline-block";
        }

        chatStatus(
            "Editing your message. Save Changes / Resubmit when ready.",
            false
        );
    };


    /* =========================================
       CANCEL EDIT
    ========================================= */

    window.cancelChatEdit = function () {
        editingChatMessage = null;

        const input = chatElement("groupChatInput");
        const submitButton = chatElement("groupChatSubmitButton");
        const cancelButton = chatElement("groupChatCancelEditButton");

        if (input) {
            input.value = "";
        }

        if (submitButton) {
            submitButton.textContent = "Send Message";
        }

        if (cancelButton) {
            cancelButton.style.display = "none";
        }

        chatStatus("", false);
    };


    /* =========================================
       LOAD GROUP CHAT
    ========================================= */

    window.loadGroupChat = async function () {
        if (chatRequestInProgress) return;

        if (!requireChatLogin()) return;

        const db = chatDb();
        const profile = chatProfile();
        const container = chatElement("groupChatMessages");

        if (!container) return;

        chatRequestInProgress = true;

        try {
            const result = await db
                .from("group_chat_messages")
                .select(
                    "id,user_id,body,created_at,reply_to_id,edited_at"
                )
                .order("created_at", {
                    ascending: true
                })
                .limit(200);

            if (result.error) {
                throw result.error;
            }

            const messages = result.data || [];

            const userIds = [
                ...new Set(
                    messages
                        .map(message => message.user_id)
                        .filter(Boolean)
                )
            ];

            const profilesById = {};

            if (userIds.length) {
                const profileResult = await db
                    .from("profiles")
                    .select("id,full_name,role")
                    .in("id", userIds);

                if (profileResult.error) {
                    throw profileResult.error;
                }

                (profileResult.data || []).forEach(member => {
                    profilesById[member.id] = member;
                });
            }

            const messagesById = {};

            messages.forEach(message => {
                messagesById[message.id] = message;
            });

            if (!messages.length) {
                container.innerHTML =
                    '<p class="chat-empty">' +
                    'No messages yet. Start the conversation!' +
                    '</p>';

                chatStatus("", false);

                return;
            }

            container.replaceChildren();

            messages.forEach(message => {
                const sender = profilesById[message.user_id] || {};

                const ownMessage =
                    message.user_id === profile.id;

                const senderName = ownMessage
                    ? "You"
                    : (
                        sender.full_name ||
                        sender.role ||
                        "Member"
                    );

                message.senderName = senderName;

                const card = document.createElement("article");

                card.className =
                    "chat-message" +
                    (ownMessage ? " own-message" : "");

                card.dataset.messageId = message.id;


                // Message header

                const header = document.createElement("div");

                header.className = "chat-message-header";

                const author = document.createElement("strong");

                author.className = "chat-message-author";

                author.textContent = senderName;

                const timestamp = document.createElement("small");

                timestamp.textContent = chatDate(message.created_at);

                header.append(author, timestamp);

                card.appendChild(header);


                // Referenced message, if this is a reply

                if (message.reply_to_id) {
                    const original =
                        messagesById[message.reply_to_id];

                    const replyBox = document.createElement("div");

                    replyBox.className = "chat-reply-preview";

                    replyBox.style.display = "block";

                    const replyHeading =
                        document.createElement("strong");

                    replyHeading.textContent = original
                        ? "Replying to " +
                            (
                                profilesById[original.user_id]?.full_name ||
                                profilesById[original.user_id]?.role ||
                                "Member"
                            )
                        : "Reply to an earlier message";

                    const replyBody = document.createElement("p");

                    replyBody.textContent = original
                        ? original.body
                        : "The original message is unavailable.";

                    replyBox.append(replyHeading, replyBody);

                    card.appendChild(replyBox);
                }


                // Message text

                const body = document.createElement("div");

                body.className = "chat-message-body";

                body.textContent = message.body || "";

                card.appendChild(body);


                // Edited indicator

                if (message.edited_at) {
                    const edited = document.createElement("small");

                    edited.className = "chat-message-edited";

                    edited.textContent = "Edited";

                    edited.title =
                        "Last edited " + chatDate(message.edited_at);

                    card.appendChild(edited);
                }


                // Actions

                const actions = document.createElement("div");

                actions.className = "chat-message-actions";

                const replyButton = document.createElement("button");

                replyButton.type = "button";

                replyButton.className = "chat-reply-button";

                replyButton.textContent = "↩ Reply";

                replyButton.addEventListener("click", function () {
                    startChatReply(message);
                });

                actions.appendChild(replyButton);


                // Only the author gets the Edit button.

                if (ownMessage) {
                    const editButton = document.createElement("button");

                    editButton.type = "button";

                    editButton.className = "chat-edit-button";

                    editButton.textContent = "✎ Edit";

                    editButton.addEventListener("click", function () {
                        window.startChatEdit(message);
                    });

                    actions.appendChild(editButton);
                }

                card.appendChild(actions);

                container.appendChild(card);
            });

            container.scrollTop = container.scrollHeight;

            chatStatus("", false);

        } catch (error) {
            console.error("Group Chat loading failed:", error);

            chatStatus(
                "Unable to load messages: " +
                (error.message || "Check your connection and permissions."),
                true
            );

        } finally {
            chatRequestInProgress = false;
        }
    };


    /* =========================================
       SEND, REPLY OR SAVE EDIT
    ========================================= */

    window.sendGroupChatMessage = async function () {
        if (!requireChatLogin()) return;

        const db = chatDb();
        const profile = chatProfile();
        const input = chatElement("groupChatInput");
        const submitButton = chatElement("groupChatSubmitButton");

        if (!input) return;

        const body = input.value.trim();

        if (!body) {
            chatStatus("Please type a message first.", true);
            return;
        }

        if (body.length > 3000) {
            chatStatus(
                "Messages cannot exceed 3,000 characters.",
                true
            );

            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
        }

        try {
            /*
             * EDIT EXISTING MESSAGE
             */

            if (editingChatMessage) {
                const messageBeingEdited = editingChatMessage;

                if (
                    messageBeingEdited.user_id !== profile.id
                ) {
                    throw new Error(
                        "You can only edit your own messages."
                    );
                }

                const updateResult = await db
                    .from("group_chat_messages")
                    .update({
                        body: body,
                        edited_at: new Date().toISOString()
                    })
                    .eq("id", messageBeingEdited.id)
                    .eq("user_id", profile.id)
                    .select("id")
                    .maybeSingle();

                if (updateResult.error) {
                    throw updateResult.error;
                }

                if (!updateResult.data) {
                    throw new Error(
                        "The message was not updated. Check your permissions."
                    );
                }

                editingChatMessage = null;

                input.value = "";

                if (submitButton) {
                    submitButton.textContent = "Send Message";
                }

                const cancelButton =
                    chatElement("groupChatCancelEditButton");

                if (cancelButton) {
                    cancelButton.style.display = "none";
                }

                chatStatus(
                    "Changes saved and message resubmitted successfully.",
                    false
                );

                await window.loadGroupChat();

                return;
            }


            /*
             * SEND NEW MESSAGE OR REPLY
             */

            const newMessage = {
                user_id: profile.id,
                body: body
            };

            if (replyToMessage) {
                newMessage.reply_to_id = replyToMessage.id;
            }

            const insertResult = await db
                .from("group_chat_messages")
                .insert(newMessage);

            if (insertResult.error) {
                throw insertResult.error;
            }

            input.value = "";

            replyToMessage = null;

            const preview = chatElement("chatReplyPreview");

            if (preview) {
                preview.style.display = "none";
            }

            chatStatus("Message sent successfully.", false);

            await window.loadGroupChat();

        } catch (error) {
            console.error("Group Chat message operation failed:", error);

            chatStatus(
                "Operation failed: " +
                (error.message || "Please try again."),
                true
            );

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    };


    /* =========================================
       CHAT REFRESH
    ========================================= */

    let refreshTimer = null;

    function startChatRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }

        refreshTimer = setInterval(function () {
            const dashboard = chatElement("chatDashboard");

            if (
                document.visibilityState === "visible" &&
                dashboard &&
                dashboard.classList.contains("chat-dashboard-open")
            ) {
                window.loadGroupChat();
            }
        }, 15000);
    }

    startChatRefresh();


    /* =========================================
       KEYBOARD SHORTCUTS
    ========================================= */

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            const dashboard = chatElement("chatDashboard");

            if (
                dashboard &&
                dashboard.classList.contains("chat-dashboard-open")
            ) {
                window.closeGroupChatDashboard();
            }
        }
    });

    console.log(
        "CCS VSN30 Group Chat Dashboard features loaded."
    );

})();
/* =====================================================
   CCS VSN30
   ANNOUNCEMENTS & NOTIFICATIONS
   Uses forum_posts and announcement_reads
===================================================== */

(function () {
    "use strict";

    // Prevent this feature from being initialized twice.
    if (window.ccsAnnouncementsInitialized) {
        return;
    }

    window.ccsAnnouncementsInitialized = true;

    const ANNOUNCEMENT_CATEGORIES = [
        "Important Notice",
        "Contributions",
        "Meetings",
        "Withdrawals",
        "General Update"
    ];

    let announcementLoadInProgress = false;

    // -------------------------------------------------
    // CURRENT PROFILE
    // -------------------------------------------------

    function getAnnouncementProfile() {
        if (
            typeof currentProfile !== "undefined" &&
            currentProfile
        ) {
            return currentProfile;
        }

        return window.currentProfile || null;
    }

    function getAnnouncementRole() {
        const profile = getAnnouncementProfile();

        return String(profile?.role || "")
            .trim()
            .toLowerCase();
    }

    function isAnnouncementAdmin() {
        return getAnnouncementRole() === "admin";
    }

    function getAnnouncementUserId() {
        const profile = getAnnouncementProfile();

        return profile?.id || null;
    }

    // -------------------------------------------------
    // ELEMENT HELPERS
    // -------------------------------------------------

    function announcementElement(id) {
        return document.getElementById(id);
    }

    function setAnnouncementStatus(message, isError) {
        const element = announcementElement(
            "announcementPublishStatus"
        );

        if (!element) return;

        element.textContent = message;

        element.style.color = isError
            ? "#ff8a8a"
            : "#86efac";
    }

    function setUnreadAnnouncementCount(count) {
        const badge = announcementElement(
            "unreadAnnouncementCount"
        );

        if (!badge) return;

        badge.textContent = String(count);

        badge.style.display = count > 0
            ? "inline-flex"
            : "none";

        badge.setAttribute(
            "aria-label",
            count + " unread announcements"
        );
    }

    function escapeAnnouncementText(value) {
        return String(value ?? "");
    }

    // -------------------------------------------------
    // SHOW ADMIN FORM
    // -------------------------------------------------

    function updateAnnouncementPermissions() {
        const adminForm = announcementElement(
            "announcementAdminForm"
        );

        if (!adminForm) return;

        adminForm.style.display = isAnnouncementAdmin()
            ? "block"
            : "none";
    }

    // -------------------------------------------------
    // CREATE SAFE ANNOUNCEMENT ELEMENT
    // -------------------------------------------------

    function createAnnouncementCard(
        announcement,
        isRead
    ) {
        const card = document.createElement("article");

        card.className = "announcement-item";

        if (!isRead) {
            card.classList.add("announcement-unread");
        }

        const heading = document.createElement("h4");

        heading.textContent = escapeAnnouncementText(
            announcement.title
        );

        const category = document.createElement("span");

        category.className = "announcement-category";

        category.textContent =
            announcement.category || "General Update";

        const date = document.createElement("p");

        date.className = "announcement-date";

        if (announcement.created_at) {
            const parsedDate = new Date(
                announcement.created_at
            );

            date.textContent = Number.isNaN(
                parsedDate.getTime()
            )
                ? ""
                : parsedDate.toLocaleString();
        }

        const body = document.createElement("p");

        body.className = "announcement-body";

        body.style.whiteSpace = "pre-wrap";

        body.textContent = escapeAnnouncementText(
            announcement.body
        );

        card.appendChild(category);
        card.appendChild(heading);
        card.appendChild(date);
        card.appendChild(body);

        if (!isRead) {
            const readButton = document.createElement("button");

            readButton.type = "button";

            readButton.textContent = "Mark as Read";

            readButton.addEventListener(
                "click",
                function () {
                    markAnnouncementAsRead(
                        announcement.id,
                        card,
                        readButton
                    );
                }
            );

            card.appendChild(readButton);
        } else {
            const readLabel = document.createElement("p");

            readLabel.className = "announcement-read-label";

            readLabel.textContent = "✓ Read";

            card.appendChild(readLabel);
        }

        return card;
    }

    // -------------------------------------------------
    // LOAD ANNOUNCEMENTS
    // -------------------------------------------------

    window.loadAnnouncements = async function () {
        if (announcementLoadInProgress) return;

        const list = announcementElement(
            "announcementsList"
        );

        if (!list) return;

        const profile = getAnnouncementProfile();
        const userId = getAnnouncementUserId();

        updateAnnouncementPermissions();

        if (!profile || !userId) {
            list.textContent =
                "Please log in to view announcements.";

            setUnreadAnnouncementCount(0);

            return;
        }

        if (
            typeof supabaseClient === "undefined" ||
            !supabaseClient
        ) {
            list.textContent =
                "The database connection is unavailable.";

            return;
        }

        announcementLoadInProgress = true;

        list.textContent = "Loading announcements...";

        try {
            const {
                data: announcements,
                error: announcementsError
            } = await supabaseClient
                .from("forum_posts")
                .select(
                    "id, user_id, title, body, category, created_at"
                )
                .eq("is_announcement", true)
                .order("created_at", {
                    ascending: false
                });

            if (announcementsError) {
                throw announcementsError;
            }

            if (
                !Array.isArray(announcements) ||
                announcements.length === 0
            ) {
                list.textContent =
                    "There are no announcements yet.";

                setUnreadAnnouncementCount(0);

                return;
            }

            const announcementIds = announcements.map(
                item => item.id
            );

            const {
                data: receipts,
                error: receiptsError
            } = await supabaseClient
                .from("announcement_reads")
                .select("announcement_id")
                .eq("user_id", userId)
                .in("announcement_id", announcementIds);

            if (receiptsError) {
                throw receiptsError;
            }

            const readIds = new Set(
                (receipts || []).map(
                    receipt => receipt.announcement_id
                )
            );

            const unreadAnnouncements = announcements.filter(
function (item) {
return !readIds.has(item.id);
}
);

        setUnreadAnnouncementCount(
            unreadAnnouncements.length
        );

        list.replaceChildren();

        if (unreadAnnouncements.length === 0) {
            const message = document.createElement("p");

            message.textContent =
                "You're all caught up! No unread announcements.";

            list.appendChild(message);
        } else {
            unreadAnnouncements.forEach(
                function (announcement) {
                    list.appendChild(
                        createAnnouncementCard(
                            announcement,
                            false
                        )
                    );
                }
            );
        }

} catch (error) {
console.error("CCS announcement loading error:", error);

        list.textContent = "Could not load announcements: " + (error && error.message ? error.message : "Unknown error");

    } finally {
        announcementLoadInProgress = false;
    }
};

    // -------------------------------------------------
    // MARK ANNOUNCEMENT AS READ
    // -------------------------------------------------
window.markAnnouncementAsRead = async function (
announcementId,
card,
button
) {
const userId = getAnnouncementUserId();

if (!userId) {
    alert("Please log in first.");
    return;
}

if (!supabaseClient) {
    alert("Database connection is unavailable.");
    return;
}

if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
}

try {
    const { error } = await supabaseClient
        .from("announcement_reads")
        .insert({
            announcement_id: announcementId,
            user_id: userId
        });

    if (error && error.code !== "23505") {
        throw error;
    }

    // Remove the announcement immediately from this member's list.
    if (card) {
        card.remove();
    }

    // Recalculate the unread count from the remaining cards.
    const list = document.getElementById(
        "announcementsList"
    );

    const remaining = list
        ? list.querySelectorAll(
            ".announcement-item.announcement-unread"
        ).length
        : 0;

    setUnreadAnnouncementCount(remaining);

    if (remaining === 0 && list) {
        const message = document.createElement("p");

        message.textContent =
            "You're all caught up! No unread announcements.";

        list.replaceChildren(message);
    }

} catch (error) {
    console.error(
        "Mark announcement as read error:",
        error
    );

    alert(
        "Could not mark this announcement as read: " +
        (error.message || "Please try again.")
    );

    if (button) {
        button.disabled = false;
        button.textContent = "Mark as Read";
    }
}

};
    // -------------------------------------------------
    // PUBLISH ANNOUNCEMENT
    // -------------------------------------------------

    window.publishAnnouncement = async function () {
        if (!isAnnouncementAdmin()) {
            setAnnouncementStatus(
                "Only the Admin can publish announcements.",
                true
            );

            return;
        }

        const profile = getAnnouncementProfile();

        const userId = getAnnouncementUserId();

        const title = (
            announcementElement("announcementTitle")?.value ||
            ""
        ).trim();

        const body = (
            announcementElement("announcementBody")?.value ||
            ""
        ).trim();

        const category = (
            announcementElement("announcementCategory")?.value ||
            "General Update"
        ).trim();

        if (!userId) {
            setAnnouncementStatus(
                "Your account profile could not be verified.",
                true
            );

            return;
        }

        if (!title || !body) {
            setAnnouncementStatus(
                "Enter both an announcement title and message.",
                true
            );

            return;
        }

        if (!ANNOUNCEMENT_CATEGORIES.includes(category)) {
            setAnnouncementStatus(
                "Please select a valid announcement category.",
                true
            );

            return;
        }

        const publishButton = document.querySelector(
            '#announcementAdminForm button[onclick="publishAnnouncement()"]'
        );

        if (publishButton) {
            publishButton.disabled = true;
            publishButton.textContent = "Publishing...";
        }

        setAnnouncementStatus(
            "Publishing announcement...",
            false
        );

        try {
            const {
                error
            } = await supabaseClient
                .from("forum_posts")
                .insert({
                    user_id: userId,
                    title: title,
                    body: body,
                    category: category,
                    is_announcement: true
                });

            if (error) {
                throw error;
            }

            announcementElement(
                "announcementTitle"
            ).value = "";

            announcementElement(
                "announcementBody"
            ).value = "";

            setAnnouncementStatus(
                "Announcement published successfully.",
                false
            );

            await window.loadAnnouncements();

        } catch (error) {
            console.error(
                "Publish announcement error:",
                error
            );

            setAnnouncementStatus(
                "Publishing failed. Check your Admin role and Supabase permissions.",
                true
            );

        } finally {
            if (publishButton) {
                publishButton.disabled = false;
                publishButton.textContent =
                    "Publish Announcement";
            }
        }
    };

    // -------------------------------------------------
    // AUTOMATIC DASHBOARD DETECTION
    // -------------------------------------------------

    function refreshAnnouncementDashboard() {
        const dashboard = announcementElement(
            "dashboardScreen"
        );

        if (!dashboard) return;

        const isVisible =
            dashboard.classList.contains("active");

        if (isVisible && getAnnouncementProfile()) {
            updateAnnouncementPermissions();

            window.loadAnnouncements();
        }
    }

    function initializeAnnouncements() {
        updateAnnouncementPermissions();

        refreshAnnouncementDashboard();

        const dashboard = announcementElement(
            "dashboardScreen"
        );

        if (dashboard) {
            const observer = new MutationObserver(
                function () {
                    refreshAnnouncementDashboard();
                }
            );

            observer.observe(dashboard, {
                attributes: true,
                attributeFilter: ["class", "style"]
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeAnnouncements
        );
    } else {
        initializeAnnouncements();
    }
// =====================================================
// CCS VSN30 — TEMPORARY MEMBER IDENTITY DIAGNOSTIC
// =====================================================

window.ccsCheckCurrentMember = async function () {
const { data, error } = await window.supabase.rpc(
"ccs_check_current_member"
);

if (error) {
    console.error("CCS identity check failed:", error);
    alert("Identity check failed: " + error.message);
    return;
}

console.log("CCS CURRENT MEMBER:", data);

alert(JSON.stringify(data, null, 2));

};

// =====================================================
// END TEMPORARY MEMBER IDENTITY DIAGNOSTIC
// =====================================================
})();
// ============================================================
// CCS VSN30 — ADMIN ROLE MANAGEMENT
// ============================================================

window.loadRoleManagement = async function () {
    const membersList = document.getElementById("roleMembersList");
    const requestsList = document.getElementById("promotionRequestsList");
    const memberSelect = document.getElementById("roleTargetMember");
    const status = document.getElementById("roleManagementStatus");

    if (!membersList || !requestsList || !memberSelect) {
        console.error("Role management HTML elements were not found.");
        return;
    }

    if (!supabaseClient) {
        status.textContent = "Supabase connection is not ready.";
        return;
    }

    membersList.textContent = "Loading members...";
    requestsList.textContent = "Loading promotion requests...";

    try {
        const { data, error } = await supabaseClient.rpc(
            "get_admin_role_management_data"
        );

        if (error) throw error;

        if (!data || data.success !== true) {
            throw new Error("Unable to load role-management data.");
        }

        const members = Array.isArray(data.members) ? data.members : [];
        window.ccsRoleManagementMembers = members;
        const requests = Array.isArray(data.requests) ? data.requests : [];

        // Populate the member selector.
        memberSelect.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select a member";
        memberSelect.appendChild(placeholder);

        members
            .filter(member => member.role !== "admin")
            .forEach(member => {
                const option = document.createElement("option");
                option.value = member.id;

                const inactiveText = member.is_active ? "" : " (Inactive)";
                option.textContent =
                    `${member.full_name || "Unnamed member"} — ` +
                    `${member.role || "member"}${inactiveText}`;

                memberSelect.appendChild(option);
            });
        window.showSelectedMemberDetails();

        // Display current roles.
        membersList.replaceChildren();

        if (members.length === 0) {
            membersList.textContent = "No members found.";
        } else {
            members.forEach(member => {
                const card = document.createElement("div");
                card.className = "dashboard-card";

                const name = document.createElement("h4");
                name.textContent = member.full_name || "Unnamed member";

                const role = document.createElement("p");
                role.textContent =
                    "Role: " + (member.role || "member");

                const phone = document.createElement("p");
                phone.textContent =
                    "Phone: " + (member.phone || "Not provided");

                const active = document.createElement("p");
                active.textContent = member.is_active
                    ? "Account: Active"
                    : "Account: Inactive";

                card.append(name, role, phone, active);
                membersList.appendChild(card);
            });
        }

        // Display pending promotion requests.
        requestsList.replaceChildren();

        if (requests.length === 0) {
            requestsList.textContent = "No pending promotion requests.";
        } else {
            requests.forEach(request => {
                const card = document.createElement("div");
                card.className = "dashboard-card";

                const title = document.createElement("h4");
                title.textContent =
                    request.full_name || "Unnamed member";

                const requestedRole = document.createElement("p");
                requestedRole.textContent =
                    "Requested role: " + request.requested_role;

                const reason = document.createElement("p");
                reason.textContent =
                    "Reason: " + (request.reason || "No reason provided");

                const created = document.createElement("p");
                created.textContent =
                    "Submitted: " +
                    (request.created_at
                        ? new Date(request.created_at).toLocaleString()
                        : "Date unavailable");

                const noteLabel = document.createElement("label");
                noteLabel.textContent = "Admin review note";

                const note = document.createElement("textarea");
                note.placeholder = "Optional reason or feedback";
                note.maxLength = 1000;

                const approve = document.createElement("button");
                approve.type = "button";
                approve.textContent = "Approve";
                approve.addEventListener("click", () => {
                    window.reviewRolePromotion(
                        request.id,
                        "approved",
                        note.value
                    );
                });

                const reject = document.createElement("button");
                reject.type = "button";
                reject.textContent = "Reject";
                reject.className = "secondary";
                reject.addEventListener("click", () => {
                    window.reviewRolePromotion(
                        request.id,
                        "rejected",
                        note.value
                    );
                });

                card.append(
                    title,
                    requestedRole,
                    reason,
                    created,
                    noteLabel,
                    note,
                    approve,
                    reject
                );

                requestsList.appendChild(card);
            });
        }

        if (status) {
            status.textContent = "Role management loaded successfully.";
        }
    } catch (error) {
        console.error("Role management error:", error);

        membersList.textContent = "Could not load member roles.";
        requestsList.textContent = "Could not load promotion requests.";

        if (status) {
            status.textContent =
                error.message || "Failed to load role management.";
        }
    }
};


// ============================================================
// ASSIGN A MEMBER'S ROLE
// ============================================================

window.assignSelectedMemberRole = async function () {
    const memberSelect = document.getElementById("roleTargetMember");
    const roleSelect = document.getElementById("roleTargetValue");
    const status = document.getElementById("roleAssignmentStatus");

    const userId = memberSelect?.value;
    const newRole = roleSelect?.value;

    const allowedRoles = [
        "member",
        "treasurer",
        "secretary",
        "committee"
    ];

    if (!userId) {
        status.textContent = "Please select a member.";
        return;
    }

    if (!allowedRoles.includes(newRole)) {
        status.textContent = "Please select a valid role.";
        return;
    }

    if (!window.confirm(
        `Assign the role "${newRole}" to the selected member?`
    )) {
        return;
    }

    status.textContent = "Updating member role...";

    try {
        const { data, error } = await supabaseClient.rpc(
            "admin_assign_member_role",
            {
                p_user_id: userId,
                p_new_role: newRole
            }
        );

        if (error) throw error;

        if (data && data.success === false) {
            throw new Error(data.message || "Role assignment failed.");
        }

        status.textContent = "Member role updated successfully.";

        await window.loadRoleManagement();
    } catch (error) {
        console.error("Role assignment error:", error);

        status.textContent =
            error.message || "Could not update the member role.";
    }
};


// ============================================================
// APPROVE OR REJECT PROMOTION REQUESTS
// ============================================================

window.reviewRolePromotion = async function (
    requestId,
    decision,
    reviewNote
) {
    if (!["approved", "rejected"].includes(decision)) {
        alert("Invalid review decision.");
        return;
    }

    const action = decision === "approved" ? "approve" : "reject";

    if (!window.confirm(`Are you sure you want to ${action} this request?`)) {
        return;
    }

    const status = document.getElementById("roleManagementStatus");

    if (status) {
        status.textContent = `Processing ${action}...`;
    }

    try {
        const { data, error } = await supabaseClient.rpc(
            "review_promotion_request",
            {
                p_request_id: requestId,
                p_decision: decision,
                p_review_note: (reviewNote || "").trim() || null
            }
        );

        if (error) throw error;

        if (data && data.success === false) {
            throw new Error(data.message || "Request review failed.");
        }

        if (status) {
            status.textContent =
                `Promotion request ${decision} successfully.`;
        }

        await window.loadRoleManagement();
    } catch (error) {
        console.error("Promotion review error:", error);

        if (status) {
            status.textContent =
                error.message || "Could not review the promotion request.";
        }
    }
};

console.log("CCS VSN30 Admin Role Management loaded.");
// ============================================================
// CCS VSN30 — SELECTED MEMBER DETAILS
// ============================================================

window.showSelectedMemberDetails = function () {
    const selector = document.getElementById("roleTargetMember");
    const details = document.getElementById("selectedMemberDetails");

    if (!selector || !details) return;

    const selectedId = selector.value;

    if (!selectedId) {
        details.replaceChildren();

        const message = document.createElement("p");
        message.textContent =
            "Select a member to view their details before assigning a role.";

        details.appendChild(message);
        return;
    }

    const member = window.ccsRoleManagementMembers?.find(
        item => String(item.id) === String(selectedId)
    );

    if (!member) {
        details.textContent =
            "Member details are unavailable. Refresh role management.";
        return;
    }

    details.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = "Member Information";
    details.appendChild(heading);

    const fields = [
        ["Full Name", member.full_name],
        ["Phone Number", member.phone],
        ["Current Role", member.role],
        ["Account Status", member.is_active ? "Active" : "Inactive"],
        ["Member ID", member.id]
    ];

    fields.forEach(([label, value]) => {
        const paragraph = document.createElement("p");
        const strong = document.createElement("strong");

        strong.textContent = label + ": ";
        paragraph.appendChild(strong);
        paragraph.appendChild(
            document.createTextNode(
                value === null || value === undefined || value === ""
                    ? "Not available"
                    : String(value)
            )
        );

        details.appendChild(paragraph);
    });

    const warning = document.createElement("p");
    warning.textContent =
        "Confirm that these details identify the correct member before assigning a role.";

    details.appendChild(warning);
};
// =========================================================
// CCS VSN30 — PENDING REGISTRATION APPROVALS
// =========================================================
window.loadPendingRegistrations = async function () {

    const list = document.getElementById(
        "pendingRegistrationsList"
    );

    const count = document.getElementById(
        "pendingRegistrationCount"
    );

    const status = document.getElementById(
        "registrationApprovalStatus"
    );

    if (!list || !count || !status) {
        console.error(
            "Registration approval HTML elements are missing."
        );
        return;
    }

    if (!supabaseClient || !currentProfile) {
        status.textContent =
            "Please log in before loading applications.";
        return;
    }

    if (
        String(currentProfile.role || "").toLowerCase() !== "admin" ||
        currentProfile.is_active !== true
    ) {
        status.textContent =
            "Only the active Admin can review applications.";
        return;
    }

    list.innerHTML = "<p>Loading applications...</p>";
    status.textContent = "";

    try {

        const { data, error } = await supabaseClient
            .from("registration_applications")
            .select(
                "id, full_name, phone, email, registration_amount, payment_method, transaction_reference, screenshot_path, status, rejection_reason, created_at"
            )
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        const applications = data || [];

        count.textContent = String(applications.length);

        if (applications.length === 0) {

            list.innerHTML = `
                <div class="dashboard-card">
                    <h4>No Pending Applications</h4>
                    <p>
                        There are currently no registration
                        applications waiting for review.
                    </p>
                </div>
            `;

            return;
        }

        const safe = function (value) {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        list.innerHTML = applications.map(function (app) {

            const method =
                app.payment_method === "manual_paybill"
                    ? "Manual M-PESA PayBill"
                    : app.payment_method === "mpesa_stk"
                    ? "M-PESA STK Push"
                    : app.payment_method || "Not specified";

            const submittedAt = app.created_at
                ? new Date(app.created_at).toLocaleString()
                : "Not available";

            /*
             * Show the screenshot button only when
             * a screenshot path has been saved.
             */

            const screenshotSection = app.screenshot_path
                ? `
                    <div class="registration-screenshot-section">

                        <p style="color:#10b981;">
                            <strong>Payment Screenshot:</strong>
                            Uploaded
                        </p>

                        <button
                            type="button"
                            class="registration-screenshot-button"
                            data-screenshot-path="${safe(app.screenshot_path)}"
                        >
                            View Payment Screenshot
                        </button>

                    </div>
                `
                : `
                    <div class="registration-screenshot-section">
                        <p style="color:#f59e0b;">
                            <strong>Payment Screenshot:</strong>
                            Not provided
                        </p>
                    </div>
                `;

            return `
                <div class="dashboard-card registration-application-card">

                    <h4>${safe(app.full_name)}</h4>

                    <p>
                        <strong>Application ID:</strong><br>
                        ${safe(app.id)}
                    </p>

                    <p>
                        <strong>Phone:</strong>
                        ${safe(app.phone)}
                    </p>

                    <p>
                        <strong>Email:</strong>
                        ${safe(app.email)}
                    </p>

                    <p>
                        <strong>Registration Fee:</strong>
                        KSh ${Number(
                            app.registration_amount || 0
                        ).toLocaleString()}
                    </p>

                    <p>
                        <strong>Payment Method:</strong>
                        ${safe(method)}
                    </p>

                    <p>
                        <strong>Transaction Reference:</strong>
                        ${safe(
                            app.transaction_reference ||
                            "Not supplied"
                        )}
                    </p>

                    ${screenshotSection}

                    <p>
                        <strong>Submitted:</strong>
                        ${safe(submittedAt)}
                    </p>

                    <p style="color:#f59e0b;">
                        <strong>Status:</strong>
                        PENDING — PAYMENT NOT YET VERIFIED
                    </p>

                    <p>
                        Verify the KSh 100 payment using
                        your authorized payment records before
                        approving this application.
                    </p>

                    <label for="rejectReason_${safe(app.id)}">
                        Reason for Rejection
                    </label>

                    <textarea
                        id="rejectReason_${safe(app.id)}"
                        rows="3"
                        maxlength="1000"
                        placeholder="Enter the reason if rejecting"
                    ></textarea>

                    <button
                        type="button"
                        class="registration-approve-button"
                        data-application-id="${safe(app.id)}"
                        data-decision="approved"
                    >
                        Approve Verified Application
                    </button>

                    <button
                        type="button"
                        class="secondary registration-reject-button"
                        data-application-id="${safe(app.id)}"
                        data-decision="rejected"
                    >
                        Reject Application
                    </button>

                </div>
            `;

        }).join("");

        /*
         * Attach click handlers after rendering.
         * This avoids placing application data directly
         * inside inline JavaScript event handlers.
         */

        list.querySelectorAll(
            ".registration-screenshot-button"
        ).forEach(function (button) {

            button.addEventListener("click", function () {

                const screenshotPath =
                    button.getAttribute("data-screenshot-path");

                if (
                    typeof window.viewRegistrationScreenshot !==
                    "function"
                ) {
                    alert(
                        "The screenshot viewer is not installed yet."
                    );
                    return;
                }

                window.viewRegistrationScreenshot(
                    screenshotPath
                );
            });

        });

        list.querySelectorAll(
            ".registration-approve-button"
        ).forEach(function (button) {

            button.addEventListener("click", function () {

                window.reviewRegistrationApplication(
                    button.getAttribute("data-application-id"),
                    "approved"
                );

            });

        });

        list.querySelectorAll(
            ".registration-reject-button"
        ).forEach(function (button) {

            button.addEventListener("click", function () {

                window.reviewRegistrationApplication(
                    button.getAttribute("data-application-id"),
                    "rejected"
                );

            });

        });

    } catch (error) {

        console.error(
            "Could not load registration applications:",
            error
        );

        list.innerHTML = `
            <p>
                Applications could not be loaded.
                Check the Admin permissions and database policies.
            </p>
        `;

        status.textContent =
            error.message || "Failed to load applications.";
    }

};
// =========================================================
// REVIEW A REGISTRATION APPLICATION
// =========================================================

window.reviewRegistrationApplication = async function (
applicationId,
decision
) {

const status = document.getElementById(
    "registrationApprovalStatus"
);

if (!supabaseClient || !currentProfile) {
    if (status) {
        status.textContent =
            "Please log in before reviewing applications.";
    }
    return;
}

if (
    String(currentProfile.role || "").toLowerCase() !==
        "admin" ||
    currentProfile.is_active !== true
) {
    if (status) {
        status.textContent =
            "Only the active Admin can review applications.";
    }
    return;
}

if (!["approved", "rejected"].includes(decision)) {
    if (status) {
        status.textContent = "Invalid review decision.";
    }
    return;
}

let rejectionReason = null;

if (decision === "rejected") {

    const reasonField = document.getElementById(
        "rejectReason_" + applicationId
    );

    rejectionReason = reasonField
        ? reasonField.value.trim()
        : "";

    if (!rejectionReason) {
        if (status) {
            status.textContent =
                "Enter a reason before rejecting the application.";
        }
        return;
    }
}

const confirmation = decision === "approved"
    ? "Confirm that you have independently verified the KSh 100 payment. Approve this application and activate the member?"
    : "Reject this registration application? The applicant's account will remain inactive.";

if (!window.confirm(confirmation)) {
    return;
}

try {

    if (status) {
        status.textContent = "Processing decision...";
    }

    const { error } = await supabaseClient.rpc(
        "admin_review_registration",
        {
            p_application_id: applicationId,
            p_decision: decision,
            p_rejection_reason: rejectionReason
        }
    );

    if (error) {
        throw error;
    }

    if (status) {
        status.textContent = decision === "approved"
            ? "Application approved. The member has been activated."
            : "Application rejected. The account remains inactive.";
    }

    await window.loadPendingRegistrations();

} catch (error) {

    console.error(
        "Registration review failed:",
        error
    );

    if (status) {
        status.textContent =
            error.message ||
            "The decision could not be completed.";
    }
}

};

// =========================================================
// END REGISTRATION APPROVALS
// =========================================================

// =========================================================
// CCS VSN30 — REGISTRATION PAYMENT SCREENSHOT VIEWER
// Displays private payment evidence inside the dashboard.
// =========================================================

window.viewRegistrationScreenshot = async function (screenshotPath) {
    const storageBucket = "registration-payment-evidence";

    if (!screenshotPath) {
        alert("No payment screenshot path was saved for this application.");
        return;
    }

    // Use the existing CCS VSN30 Supabase client.
const client = supabaseClient;

if (
    !client ||
    !client.storage ||
    typeof client.storage.from !== "function"
) {
    console.error(
        "CCS VSN30 Supabase client is not initialized."
    );

    alert(
        "Supabase is not initialized. Please reload CCS VSN30 and try again."
    );

    return;
}

    // Use the existing admin session.
    const {
        data: { user },
        error: authError
    } = await client.auth.getUser();

    if (authError || !user) {
        alert("Your session has expired. Log in again as Admin.");
        return;
    }

    // Verify that the current user is an active Admin.
    const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (
        profileError ||
        !profile ||
        String(profile.role).toLowerCase() !== "admin" ||
        profile.is_active !== true
    ) {
        alert("Only an active Admin can view registration payment screenshots.");
        return;
    }

    // Create a private, temporary URL for the screenshot.
    const { data, error } = await client.storage
        .from(storageBucket)
        .createSignedUrl(screenshotPath, 300);

    if (error || !data || !data.signedUrl) {
        console.error("Screenshot URL error:", error);
        alert(
            "Could not retrieve the screenshot. Check the Admin Storage SELECT policy."
        );
        return;
    }

    // Create the viewer modal once.
    let modal = document.getElementById("ccsRegistrationScreenshotModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "ccsRegistrationScreenshotModal";

        modal.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 999999;
            background: rgba(0, 0, 0, 0.92);
            display: none;
            align-items: center;
            justify-content: center;
            padding: 16px;
        `;

        modal.innerHTML = `
            <div style="
                width: 100%;
                max-width: 850px;
                max-height: 95vh;
                background: #111827;
                border: 1px solid #475569;
                border-radius: 14px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                ">
                    <strong style="color: white;">
                        Registration Payment Screenshot
                    </strong>

                    <button
                        type="button"
                        id="ccsCloseRegistrationScreenshot"
                        style="
                            padding: 9px 14px;
                            background: #dc2626;
                            color: white;
                            border: none;
                            border-radius: 7px;
                            font-weight: bold;
                        "
                    >Close ✕</button>
                </div>

                <div id="ccsRegistrationScreenshotStatus"
                     style="color: #fbbf24; font-size: 14px;">
                    Loading screenshot...
                </div>

                <div style="
                    overflow: auto;
                    min-height: 100px;
                    text-align: center;
                ">
                    <img
                        id="ccsRegistrationScreenshotImage"
                        alt="Registration payment evidence"
                        style="
                            display: none;
                            max-width: 100%;
                            max-height: 72vh;
                            object-fit: contain;
                            border-radius: 8px;
                            background: white;
                        "
                    >
                </div>

                <a
                    id="ccsRegistrationScreenshotOpen"
                    target="_blank"
                    rel="noopener noreferrer"
                    style="
                        display: none;
                        color: #93c5fd;
                        text-align: center;
                        padding: 8px;
                    "
                >Open image separately</a>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById(
            "ccsCloseRegistrationScreenshot"
        ).addEventListener("click", function () {
            modal.style.display = "none";

            const image = document.getElementById(
                "ccsRegistrationScreenshotImage"
            );

            image.onload = null;
            image.onerror = null;
            image.removeAttribute("src");
        });

        modal.addEventListener("click", function (event) {
            if (event.target === modal) {
                modal.style.display = "none";
            }
        });
    }

    const image = document.getElementById(
        "ccsRegistrationScreenshotImage"
    );

    const status = document.getElementById(
        "ccsRegistrationScreenshotStatus"
    );

    const openLink = document.getElementById(
        "ccsRegistrationScreenshotOpen"
    );

    modal.style.display = "flex";
    image.style.display = "none";
    image.removeAttribute("src");
    openLink.style.display = "none";
    status.textContent = "Loading screenshot...";

    image.onload = function () {
        image.style.display = "inline-block";
        status.textContent = "Screenshot loaded successfully.";
    };

    image.onerror = function () {
        image.style.display = "none";
        status.textContent =
            "The image could not be displayed here. Try opening it separately.";
        openLink.style.display = "block";
    };

    openLink.href = data.signedUrl;

    image.src = data.signedUrl;

    openLink.style.display = "block";
};
