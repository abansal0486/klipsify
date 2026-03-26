import {
  FETCH_BRANDS_REQUEST, FETCH_BRANDS_SUCCESS, FETCH_BRANDS_FAIL,
  CREATE_BRAND_REQUEST, CREATE_BRAND_SUCCESS, CREATE_BRAND_FAIL,
  UPDATE_BRAND_REQUEST, UPDATE_BRAND_SUCCESS, UPDATE_BRAND_FAIL,
  DELETE_BRAND_REQUEST, DELETE_BRAND_SUCCESS, DELETE_BRAND_FAIL,
  ADD_PRODUCT_SUCCESS,
  UPDATE_PRODUCT_SUCCESS,
  DELETE_PRODUCT_SUCCESS,
} from "../actions/brandAction";

const initialState = {
  loading: false,
  brands: [],
  error: null,
};

const brandReducer = (state = initialState, action) => {
  switch (action.type) {

    // loading states
    case FETCH_BRANDS_REQUEST:
    case CREATE_BRAND_REQUEST:
    case UPDATE_BRAND_REQUEST:
    case DELETE_BRAND_REQUEST:
      return { ...state, loading: true, error: null };

    case FETCH_BRANDS_SUCCESS:
      return { ...state, loading: false, brands: action.payload };

    case CREATE_BRAND_SUCCESS:
      return {
        ...state,
        loading: false,
        brands: [{ ...action.payload, products: [] }, ...state.brands],
      };

    case UPDATE_BRAND_SUCCESS:
      return {
        ...state,
        loading: false,
        brands: state.brands.map((b) =>
          b._id === action.payload._id
            ? { ...action.payload, products: b.products }
            : b
        ),
      };

    case DELETE_BRAND_SUCCESS:
      return {
        ...state,
        loading: false,
        brands: state.brands.filter((b) => b._id !== action.payload),
      };

    // product mutations (no full refetch needed)
    case ADD_PRODUCT_SUCCESS:
      return {
        ...state,
        brands: state.brands.map((b) =>
          b._id === action.payload.brandId
            ? { ...b, products: [...(b.products || []), action.payload.product] }
            : b
        ),
      };

    case UPDATE_PRODUCT_SUCCESS:
      return {
        ...state,
        brands: state.brands.map((b) =>
          b._id === action.payload.brandId
            ? {
                ...b,
                products: (b.products || []).map((p) =>
                  p._id === action.payload.product._id ? action.payload.product : p
                ),
              }
            : b
        ),
      };

    case DELETE_PRODUCT_SUCCESS:
      return {
        ...state,
        brands: state.brands.map((b) =>
          b._id === action.payload.brandId
            ? { ...b, products: (b.products || []).filter((p) => p._id !== action.payload.productId) }
            : b
        ),
      };

    case FETCH_BRANDS_FAIL:
    case CREATE_BRAND_FAIL:
    case UPDATE_BRAND_FAIL:
    case DELETE_BRAND_FAIL:
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
};

export default brandReducer;
