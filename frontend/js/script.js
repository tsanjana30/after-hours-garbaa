// ==================================================
// AFTER-HOURS GARBA
// BOOKING PAGE JAVASCRIPT
// ==================================================


// ==================================================
// BACKEND URL
// ==================================================

const API_URL = window.location.origin;

// ==================================================
// GET ELEMENTS
// ==================================================

const bookingForm =
    document.getElementById(
        "bookingForm"
    );

const passSelect =
    document.getElementById(
        "pass"
    );

const quantityInput =
    document.getElementById(
        "quantity"
    );

const totalElement =
    document.getElementById(
        "total"
    );

const screenshotInput =
    document.getElementById(
        "paymentScreenshot"
    );

const submitButton =
    document.getElementById(
        "submitButton"
    );

const formMessage =
    document.getElementById(
        "formMessage"
    );

const copyUpiButton =
    document.getElementById(
        "copyUpi"
    );

const upiIdElement =
    document.getElementById(
        "upiId"
    );

const earlyBirdNote =
    document.getElementById(
        "earlyBirdNote"
    );

const priceNote =
    document.getElementById(
        "priceNote"
    );

const menuToggle =
    document.getElementById(
        "menuToggle"
    );

const navLinks =
    document.querySelector(
        ".nav-links"
    );


// ==================================================
// DEFAULT PRICES
// ==================================================
// These are only fallback values.
// The backend is the actual authority for price.
// ==================================================

let prices = {

    "Single Pass": 399,

    "Couple Pass": 699,

    "Group Pass": 1399

};


// ==================================================
// EARLY BIRD STATE
// ==================================================

let earlyBirdActive = false;


// ==================================================
// UPDATE TOTAL
// ==================================================

function updateTotal() {

    if (
        !passSelect ||
        !quantityInput ||
        !totalElement
    ) {

        return;

    }


    const selectedPass =
        passSelect.value;


    const quantity =
        Number(
            quantityInput.value
        );


    const price =
        prices[selectedPass];


    if (
        !price ||
        !quantity
    ) {

        return;

    }


    const total =
        price * quantity;


    totalElement.textContent =
        `₹${total.toLocaleString("en-IN")}`;

}


// ==================================================
// CHANGE QUANTITY
// ==================================================
// This function is called directly by the
// onclick attributes in booking.html.
// ==================================================

function changeQuantity(change) {

    if (
        !quantityInput
    ) {

        return;

    }


    let quantity =
        Number(
            quantityInput.value
        );


    // If something goes wrong,
    // reset to 1.

    if (
        Number.isNaN(
            quantity
        )
    ) {

        quantity = 1;

    }


    quantity =
        quantity + change;


    // Minimum = 1

    if (
        quantity < 1
    ) {

        quantity = 1;

    }


    // Maximum = 20

    if (
        quantity > 20
    ) {

        quantity = 20;

    }


    quantityInput.value =
        quantity;


    updateTotal();

}


// ==================================================
// MAKE FUNCTION AVAILABLE TO HTML
// ==================================================

window.changeQuantity =
    changeQuantity;


// ==================================================
// PASS CHANGE
// ==================================================

if (
    passSelect
) {

    passSelect.addEventListener(
        "change",
        function () {

            updateTotal();

        }
    );

}


// ==================================================
// COPY UPI ID
// ==================================================

if (
    copyUpiButton
) {

    copyUpiButton.addEventListener(
        "click",
        async function () {

            const upiId =
                upiIdElement?.textContent.trim();

            if (!upiId) return;


            try {

                await navigator
                    .clipboard
                    .writeText(
                        upiId
                    );


                copyUpiButton.textContent =
                    "Copied ✓";


                setTimeout(
                    function () {

                        copyUpiButton.textContent =
                            "Copy UPI ID";

                    },
                    2000
                );


            } catch (error) {

                alert(
                    "UPI ID: " +
                    upiId
                );

            }

        }
    );

}


// ==================================================
// SHOW FORM MESSAGE
// ==================================================

function showMessage(
    message,
    type
) {

    if (
        !formMessage
    ) {

        return;

    }


    formMessage.textContent =
        message;


    formMessage.className =
        `form-message show ${type}`;

}


// ==================================================
// LOAD CURRENT PRICES FROM BACKEND
// ==================================================
// This prevents the website from showing one price
// while the backend accepts another price.
// ==================================================

async function loadCurrentPrices() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/prices`
            );


        if (
            !response.ok
        ) {

            throw new Error(
                "Unable to load prices."
            );

        }


        const data =
            await response.json();


        if (
            data.prices || data.currentPrices
        ) {

            prices =
                data.prices || data.currentPrices;

        }


        earlyBirdActive =
            Boolean(
                data.earlyBirdActive
            );


        // ------------------------------------------
        // UPDATE DROPDOWN PRICES
        // ------------------------------------------

        if (
            passSelect
        ) {

            const singleOption =
                passSelect.querySelector(
                    'option[value="Single Pass"]'
                );


            const coupleOption =
                passSelect.querySelector(
                    'option[value="Couple Pass"]'
                );


            const groupOption =
                passSelect.querySelector(
                    'option[value="Group Pass"]'
                );


            if (
                singleOption
            ) {

                singleOption.textContent =
                    earlyBirdActive
                        ? "Single Pass — ₹299"
                        : "Single Pass — ₹399";

            }


            if (
                coupleOption
            ) {

                coupleOption.textContent =
                    earlyBirdActive
                        ? "Couple Pass — ₹599"
                        : "Couple Pass — ₹699";

            }


            if (
                groupOption
            ) {

                groupOption.textContent =
                    earlyBirdActive
                        ? "Group Pass — ₹2,999"
                        : "Group Pass — ₹1,399";

            }

        }


        // ------------------------------------------
        // UPDATE EARLY BIRD MESSAGE
        // ------------------------------------------

        if (
            earlyBirdNote
        ) {

            if (
                earlyBirdActive
            ) {

                earlyBirdNote.textContent =
                    "✦ EARLY BIRD OFFER — Valid until 7 October 2026";

            } else {

                earlyBirdNote.textContent =
                    "Regular pricing is currently active.";

            }

        }


        // ------------------------------------------
        // UPDATE TOTAL NOTE
        // ------------------------------------------

        if (
            priceNote
        ) {

            if (
                earlyBirdActive
            ) {

                priceNote.textContent =
                    "Early Bird pricing • Limited time only";

            } else {

                priceNote.textContent =
                    "Regular event pricing";

            }

        }


        updateTotal();


    } catch (error) {

        console.error(
            "Price loading error:",
            error
        );


        // Keep fallback prices if
        // backend is temporarily unavailable.

        updateTotal();

    }

}


// ==================================================
// FORM SUBMISSION
// ==================================================

if (
    bookingForm
) {

    bookingForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            // ------------------------------------------
            // GET VALUES
            // ------------------------------------------

            const name =
                document
                    .getElementById(
                        "name"
                    )
                    .value
                    .trim();


            const phone =
                document
                    .getElementById(
                        "phone"
                    )
                    .value
                    .trim();


            const email =
                document
                    .getElementById(
                        "email"
                    )
                    .value
                    .trim();


            const pass =
                passSelect.value;


            const quantity =
                Number(
                    quantityInput.value
                );


            const screenshot =
                screenshotInput.files[0];


            // ------------------------------------------
            // NAME VALIDATION
            // ------------------------------------------

            if (
                !name
            ) {

                showMessage(
                    "Please enter your full name.",
                    "error"
                );

                return;

            }


            // ------------------------------------------
            // PHONE VALIDATION
            // ------------------------------------------

            if (
                !/^[0-9]{10}$/.test(
                    phone
                )
            ) {

                showMessage(
                    "Please enter a valid 10-digit mobile number.",
                    "error"
                );

                return;

            }


            // ------------------------------------------
            // EMAIL VALIDATION
            // ------------------------------------------

            if (
                !email
            ) {

                showMessage(
                    "Please enter your email address.",
                    "error"
                );

                return;

            }


            // ------------------------------------------
            // QUANTITY VALIDATION
            // ------------------------------------------

            if (
                quantity < 1 ||
                quantity > 20
            ) {

                showMessage(
                    "Quantity must be between 1 and 20.",
                    "error"
                );

                return;

            }


            // ------------------------------------------
            // SCREENSHOT REQUIRED
            // ------------------------------------------

            if (
                !screenshot
            ) {

                showMessage(
                    "Please upload your payment screenshot.",
                    "error"
                );

                return;

            }


            // ------------------------------------------
            // FILE SIZE
            // ------------------------------------------

            if (
                screenshot.size >
                5 * 1024 * 1024
            ) {

                showMessage(
                    "Payment screenshot must be 5 MB or smaller.",
                    "error"
                );

                return;

            }


            // ------------------------------------------
            // FILE TYPE
            // ------------------------------------------

            const allowedTypes = [

                "image/jpeg",

                "image/png",

                "image/webp"

            ];


            if (
                !allowedTypes.includes(
                    screenshot.type
                )
            ) {

                showMessage(
                    "Please upload a JPG, PNG or WEBP image.",
                    "error"
                );

                return;

            }


            // ------------------------------------------
            // CREATE FORM DATA
            // ------------------------------------------

            const formData =
                new FormData();


            formData.append(
                "name",
                name
            );


            formData.append(
                "phone",
                phone
            );


            formData.append(
                "email",
                email
            );


            formData.append(
                "pass",
                pass
            );


            formData.append(
                "quantity",
                quantity
            );


            formData.append(
                "paymentScreenshot",
                screenshot
            );


            // ------------------------------------------
            // DISABLE SUBMIT BUTTON
            // ------------------------------------------

            submitButton.disabled =
                true;


            submitButton.innerHTML =
                "SUBMITTING...";


            showMessage(
                "Submitting your booking...",
                "success"
            );


            try {

                // --------------------------------------
                // SEND TO BACKEND
                // --------------------------------------

                const response =
                    await fetch(
                        `${API_URL}/api/bookings`,
                        {
                            method: "POST",

                            body:
                                formData
                        }
                    );


                const contentType = response.headers.get("content-type") || "";
                const data = contentType.includes("application/json")
                    ? await response.json()
                    : {};


                // --------------------------------------
                // HANDLE ERROR
                // --------------------------------------

                if (
                    !response.ok || !data.success || !data.booking?.ticketId
                ) {

                    throw new Error(
                        data.message ||
                        "Booking service is unavailable. Please try again shortly."
                    );

                }


                // --------------------------------------
                // SAVE BOOKING
                // --------------------------------------

                sessionStorage.setItem(

                    "garbaBooking",

                    JSON.stringify(
                        data.booking
                    )

                );

                sessionStorage.setItem("ticketId", data.booking.ticketId);


                // --------------------------------------
                // REDIRECT
                // --------------------------------------

                window.location.href =
                    `success.html?ticketId=${encodeURIComponent(data.booking.ticketId)}`;


            } catch (error) {

                console.error(
                    "Booking submission error:",
                    error
                );


                showMessage(
                    error.message ||
                    "Something went wrong. Please try again.",
                    "error"
                );


                submitButton.disabled =
                    false;


                submitButton.innerHTML =
                    "SUBMIT PAYMENT <span>→</span>";

            }

        }
    );

}


// ==================================================
// MOBILE NAVIGATION
// ==================================================

if (
    menuToggle &&
    navLinks
) {

    menuToggle.addEventListener(
        "click",
        function () {

            navLinks.classList.toggle(
                "active"
            );

        }
    );


    const navItems =
        navLinks.querySelectorAll(
            "a"
        );


    navItems.forEach(
        function (link) {

            link.addEventListener(
                "click",
                function () {

                    navLinks.classList.remove(
                        "active"
                    );

                }
            );

        }
    );

}


// ==================================================
// INITIAL PAGE LOAD
// ==================================================

updateTotal();

loadCurrentPrices();
