import {
    FETCH_PLANS_REQUEST,
    FETCH_PLANS_SUCCESS,
    FETCH_PLANS_FAIL,
    CREATE_CHECKOUT_REQUEST,
    CREATE_CHECKOUT_SUCCESS,
    CREATE_CHECKOUT_FAIL,
} from "../actions/paymentActions";

const initialState = {
    plans: [],
    loading: false,
    error: null,
};

const paymentReducer = (state = initialState, action) => {
    switch (action.type) {
        case FETCH_PLANS_REQUEST:
        case CREATE_CHECKOUT_REQUEST:
            return {
                ...state,
                loading: true,
                error: null,
            };

        case FETCH_PLANS_SUCCESS:
            return {
                ...state,
                loading: false,
                plans: action.payload,
            };

        case CREATE_CHECKOUT_SUCCESS:
            return {
                ...state,
                loading: false,
            };

        case FETCH_PLANS_FAIL:
        case CREATE_CHECKOUT_FAIL:
            return {
                ...state,
                loading: false,
                error: action.payload,
            };

        default:
            return state;
    }
};

export default paymentReducer;
