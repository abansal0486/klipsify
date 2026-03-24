import api from "../../api/axios";

export const createCheckoutSession = (priceId, email, userId) => async (dispatch) => {
    try {
        const { data } = await api.post("/payment/create-checkout-session", {
            priceId,
            email,
            userId
        });

        if (data.url) {
            window.location.href = data.url;
        } else {
            console.error("No URL returned from checkout session");
        }
    } catch (error) {
        console.error("Error creating checkout session:", error.response?.data?.message || error.message);
        alert("Failed to initiate checkout. Please try again.");
    }
};
