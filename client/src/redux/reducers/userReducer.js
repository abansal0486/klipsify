import { GET_USER_REQUEST, GET_USER_SUCCESS, GET_USER_FAIL, UPDATE_USER_REQUEST, UPDATE_USER_SUCCESS, UPDATE_USER_FAIL } from "../actions/userActions";


const initialState = {
    profile: null,
    loading: false,
    error: null
}

const userReducer = (state = initialState, action) => {
    switch (action.type) {
        case GET_USER_REQUEST:
            return {
                ...state,
                loading: true
            }
        case GET_USER_SUCCESS:
            return {
                ...state,
                loading: false,
                profile: action.payload
            }
        case GET_USER_FAIL:
            return {
                ...state,
                loading: false,
                error: action.payload
            }
        case UPDATE_USER_REQUEST:
            return {
                ...state,
                loading: true
            }
        case UPDATE_USER_SUCCESS:
            return {
                ...state,
                loading: false,
                profile: action.payload
            }
        case UPDATE_USER_FAIL:
            return {
                ...state,
                loading: false,
                error: action.payload
            }
        default:
            return state
    }
}

export default userReducer
