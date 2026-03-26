import api from "../../api/axios";

// Action Types
export const FETCH_PLANS_REQUEST = "FETCH_PLANS_REQUEST";
export const FETCH_PLANS_SUCCESS = "FETCH_PLANS_SUCCESS";
export const FETCH_PLANS_FAIL = "FETCH_PLANS_FAIL";

export const CREATE_CHECKOUT_REQUEST = "CREATE_CHECKOUT_REQUEST";
export const CREATE_CHECKOUT_SUCCESS = "CREATE_CHECKOUT_SUCCESS";
export const CREATE_CHECKOUT_FAIL = "CREATE_CHECKOUT_FAIL";

// Actions
export const fetchPlans = () => async (dispatch) => {
    try {
        dispatch({ type: FETCH_PLANS_REQUEST });

        const { data } = await api.get("/payment/plans/details");

        if (data.success) {
            dispatch({
                type: FETCH_PLANS_SUCCESS,
                payload: data.plans,
            });
        }
    } catch (error) {
        dispatch({
            type: FETCH_PLANS_FAIL,
            payload: error.response?.data?.message || error.message,
        });
    }
};

export const createCheckoutSession = (priceId, email, userId) => async (dispatch) => {
    try {
        dispatch({ type: CREATE_CHECKOUT_REQUEST });

        const { data } = await api.post("/payment/create-checkout-session", {
            priceId,
            email,
            userId
        });

        if (data.url) {
            dispatch({ type: CREATE_CHECKOUT_SUCCESS });
            window.location.href = data.url;
        } else {
            throw new Error("No URL returned from checkout session");
        }
    } catch (error) {
        dispatch({
            type: CREATE_CHECKOUT_FAIL,
            payload: error.response?.data?.message || error.message,
        });
        console.error("Error creating checkout session:", error.response?.data?.message || error.message);
        alert("Failed to initiate checkout. Please try again.");
    }
};
